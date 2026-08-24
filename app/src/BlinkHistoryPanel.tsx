import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { shiftLocalDateKey } from "./local-history-time";
import {
  buildTimelineCountBuckets,
  getTimelineCountBucketMs,
  type TimelineCountBucket,
} from "./timeline-analytics";
import {
  getLocalDayRange,
  mergeTimelineEvents,
  mergeTimelineSessions,
  type TimelineEvent,
  type TimelineEventType,
  type TimelineRange,
} from "./timeline";
import { useTimelineRange } from "./useTimeline";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const EVENT_AXIS_STEP_MS = 10_000;
const EVENT_WINDOW_MS = 5 * MINUTE_MS;
const CHART_Y_AXIS_WIDTH = 70;
const EVENT_CHART_RIGHT_MARGIN = 8;
const COUNT_CHART_RIGHT_MARGIN = 12;
const DEFAULT_CHART_WIDTH = 720;
const WHEEL_ZOOM_SENSITIVITY = 0.0025;

type HistoryView = "events" | "minutes";
type MinuteMetric =
  | "blinkCount"
  | "yawnCount"
  | "standUpCount"
  | "sitDownCount";

interface EventLane {
  type: TimelineEventType;
  labelKey: string;
  lane: number;
  color: string;
}

const EVENT_LANES: readonly EventLane[] = [
  { type: "blink.detected", labelKey: "history.lanes.blinkDetected", lane: 6, color: "#315f66" },
  { type: "seated.started", labelKey: "history.lanes.seatedStarted", lane: 5, color: "#53826f" },
  { type: "seated.ended", labelKey: "history.lanes.seatedEnded", lane: 4, color: "#bc765e" },
  { type: "screen.started", labelKey: "history.lanes.screenStarted", lane: 3, color: "#527f9a" },
  { type: "screen.ended", labelKey: "history.lanes.screenEnded", lane: 2, color: "#8696a6" },
  { type: "yawn.detected", labelKey: "history.lanes.yawnDetected", lane: 1, color: "#91749a" },
];

const EVENT_LANE_BY_TYPE = new Map(
  EVENT_LANES.map((lane) => [lane.type, lane]),
);

const MINUTE_METRICS: ReadonlyArray<{
  key: MinuteMetric;
  labelKey: string;
  color: string;
}> = [
  { key: "blinkCount", labelKey: "history.metrics.blinkCount", color: "#315f66" },
  { key: "yawnCount", labelKey: "history.metrics.yawnCount", color: "#91749a" },
  { key: "standUpCount", labelKey: "history.metrics.standUpCount", color: "#bc765e" },
  { key: "sitDownCount", labelKey: "history.metrics.sitDownCount", color: "#53826f" },
];

const SEATED_END_REASON_KEYS = {
  stand_up: "history.reasons.standUp",
  tracking_lost: "history.reasons.trackingLost",
} as const;

interface BlinkHistoryPanelProps {
  selectedDate: string;
  firstDate: string;
  todayDate: string;
  now: number;
  demoRange?: TimelineRange;
  onSelectDate: (dateKey: string) => void;
  onClose: () => void;
}

interface ViewWindow {
  startAt: number;
  endAt: number;
}

interface DragState extends ViewWindow {
  pointerId: number;
  startX: number;
  moved: boolean;
}

interface EventPoint {
  id: string;
  at: number;
  lane: number;
  size: number;
  event: TimelineEvent;
}

interface MinutePoint extends TimelineCountBucket {
  value: number | null;
}

interface EventHover {
  event: TimelineEvent;
  x: number;
  placeBeforeCursor: boolean;
}

function clampViewWindow(
  startAt: number,
  durationMs: number,
  dayStart: number,
  dayEnd: number,
): ViewWindow {
  const duration = Math.min(dayEnd - dayStart, Math.max(MINUTE_MS, durationMs));
  const clampedStart = Math.min(
    dayEnd - duration,
    Math.max(dayStart, startAt),
  );
  return { startAt: clampedStart, endAt: clampedStart + duration };
}

function getEventViewWindow(
  endAt: number,
  dayStart: number,
  dayEnd: number,
): ViewWindow {
  const alignedEndAt = Math.ceil(endAt / EVENT_AXIS_STEP_MS) * EVENT_AXIS_STEP_MS;
  return clampViewWindow(
    alignedEndAt - EVENT_WINDOW_MS,
    EVENT_WINDOW_MS,
    dayStart,
    dayEnd,
  );
}

function formatClock(timestamp: number, includeSeconds = false): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (!includeSeconds) {
    return `${hours}:${minutes}`;
  }
  return `${hours}:${minutes}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function formatCountInterval(intervalMs: number, t: TFunction): string {
  const minutes = intervalMs / MINUTE_MS;
  if (minutes < 60) {
    return minutes === 1
      ? t("history.interval.minute")
      : t("history.interval.minutes", { count: minutes });
  }
  const hours = minutes / 60;
  return hours === 1
    ? t("history.interval.hour")
    : t("history.interval.hours", { count: hours });
}

function EventTooltip({ event }: { event: TimelineEvent }) {
  const { t } = useTranslation();
  const lane = EVENT_LANE_BY_TYPE.get(event.type);
  return (
    <div className="history-tooltip">
      <strong>{formatClock(event.at, true)}</strong>
      <span style={{ color: lane?.color }}>
        {lane ? t(lane.labelKey) : event.type}
      </span>
      {event.type === "seated.ended" && (
        <small>{t(SEATED_END_REASON_KEYS[event.reason])}</small>
      )}
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  metricLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MinutePoint }>;
  metricLabel: string;
}) {
  const { t } = useTranslation();
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) {
    return null;
  }
  const startDate = new Date(point.startAt);
  const endDate = new Date(point.endAt);
  const crossesLocalDate =
    startDate.getFullYear() !== endDate.getFullYear() ||
    startDate.getMonth() !== endDate.getMonth() ||
    startDate.getDate() !== endDate.getDate();
  const bucketLabel =
    point.endAt - point.startAt === MINUTE_MS
      ? formatClock(point.startAt)
      : `${formatClock(point.startAt)}–${
          crossesLocalDate ? t("history.nextDayPrefix") : ""
        }${formatClock(point.endAt)}`;
  return (
    <div className="history-tooltip">
      <strong>{bucketLabel}</strong>
      {point.hasCoverage ? (
        <span>
          {t("history.metricCount", {
            metric: metricLabel,
            count: point.value ?? 0,
          })}
        </span>
      ) : (
        <small>{t("history.bucketNoCoverage")}</small>
      )}
    </div>
  );
}

export default function BlinkHistoryPanel({
  selectedDate,
  firstDate,
  todayDate,
  now,
  demoRange,
  onSelectDate,
  onClose,
}: BlinkHistoryPanelProps) {
  const { t, i18n } = useTranslation();
  const dayRange = useMemo(() => getLocalDayRange(selectedDate), [selectedDate]);
  const recordedRange = useTimelineRange(dayRange.startAt, dayRange.endAt);
  const timeline = useMemo<TimelineRange>(
    () =>
      demoRange
        ? {
            events: mergeTimelineEvents(demoRange.events, recordedRange.events),
            sessions: mergeTimelineSessions(
              demoRange.sessions,
              recordedRange.sessions,
            ),
            activeSessionId: recordedRange.activeSessionId,
          }
        : recordedRange,
    [demoRange, recordedRange],
  );
  const selectedDateIsToday = selectedDate === todayDate;
  const latestRecordedEvent =
    recordedRange.events[recordedRange.events.length - 1];
  const timelineNow = selectedDateIsToday
    ? Math.min(
        dayRange.endAt,
        Math.max(now, latestRecordedEvent ? latestRecordedEvent.at + 1 : now),
      )
    : now;
  const latestTimelineEventAt = useMemo(() => {
    for (let index = timeline.events.length - 1; index >= 0; index -= 1) {
      const event = timeline.events[index];
      if (event.at >= dayRange.startAt && event.at < dayRange.endAt) {
        return event.at;
      }
    }
    return null;
  }, [dayRange.endAt, dayRange.startAt, timeline.events]);
  const eventAnchorAt = selectedDateIsToday
    ? timelineNow
    : latestTimelineEventAt !== null
      ? latestTimelineEventAt + 1
      : dayRange.startAt + EVENT_WINDOW_MS;
  const eventNavigationEndAt = selectedDateIsToday
    ? getEventViewWindow(
        eventAnchorAt,
        dayRange.startAt,
        dayRange.endAt,
      ).endAt
    : dayRange.endAt;
  const initialMinuteEndAt = selectedDateIsToday
    ? Math.min(
        dayRange.endAt,
        Math.max(dayRange.startAt + MINUTE_MS, timelineNow),
      )
    : dayRange.endAt;
  const [view, setView] = useState<HistoryView>("events");
  const [minuteMetric, setMinuteMetric] =
    useState<MinuteMetric>("blinkCount");
  const [countChartWidth, setCountChartWidth] = useState(DEFAULT_CHART_WIDTH);
  const [eventWindow, setEventWindow] = useState<ViewWindow>(() =>
    getEventViewWindow(eventAnchorAt, dayRange.startAt, dayRange.endAt),
  );
  const [minuteWindow, setMinuteWindow] = useState<ViewWindow>(() =>
    selectedDateIsToday
      ? clampViewWindow(
          initialMinuteEndAt - HOUR_MS,
          HOUR_MS,
          dayRange.startAt,
          dayRange.endAt,
        )
      : dayRange,
  );
  const [dragging, setDragging] = useState(false);
  const [eventHover, setEventHover] = useState<EventHover | null>(null);
  const dragState = useRef<DragState | null>(null);
  const eventCursor = useRef<HTMLDivElement | null>(null);
  const eventFollowsLatest = useRef(true);
  const minuteFollowsLatest = useRef(selectedDateIsToday);
  const latestEventAnchorAt = useRef(eventAnchorAt);
  const latestNow = useRef(timelineNow);
  latestEventAnchorAt.current = eventAnchorAt;
  latestNow.current = timelineNow;

  useEffect(() => {
    eventFollowsLatest.current = true;
    setEventWindow(
      getEventViewWindow(
        latestEventAnchorAt.current,
        dayRange.startAt,
        dayRange.endAt,
      ),
    );
    minuteFollowsLatest.current = selectedDateIsToday;
    if (!selectedDateIsToday) {
      setMinuteWindow(dayRange);
      return;
    }
    const endAt = Math.min(
      dayRange.endAt,
      Math.max(dayRange.startAt + MINUTE_MS, latestNow.current),
    );
    setMinuteWindow(
      clampViewWindow(
        endAt - HOUR_MS,
        HOUR_MS,
        dayRange.startAt,
        dayRange.endAt,
      ),
    );
  }, [dayRange, selectedDateIsToday]);

  useEffect(() => {
    if (!eventFollowsLatest.current) {
      return;
    }
    const next = getEventViewWindow(
      eventAnchorAt,
      dayRange.startAt,
      dayRange.endAt,
    );
    setEventWindow((current) =>
      next.startAt === current.startAt && next.endAt === current.endAt
        ? current
        : next,
    );
  }, [dayRange.endAt, dayRange.startAt, eventAnchorAt]);

  useEffect(() => {
    if (!minuteFollowsLatest.current || !selectedDateIsToday) {
      return;
    }
    const endAt = Math.min(
      dayRange.endAt,
      Math.max(dayRange.startAt + MINUTE_MS, timelineNow),
    );
    setMinuteWindow((current) => {
      const duration = current.endAt - current.startAt;
      const next = clampViewWindow(
        endAt - duration,
        duration,
        dayRange.startAt,
        dayRange.endAt,
      );
      return next.startAt === current.startAt && next.endAt === current.endAt
        ? current
        : next;
    });
  }, [dayRange.endAt, dayRange.startAt, selectedDateIsToday, timelineNow]);

  const visibleEvents = useMemo(
    () =>
      timeline.events.filter(
        (event) =>
          event.at >= eventWindow.startAt && event.at < eventWindow.endAt,
      ),
    [eventWindow.endAt, eventWindow.startAt, timeline.events],
  );
  const eventSeries = useMemo(
    () =>
      EVENT_LANES.map((lane) => ({
        ...lane,
        label: t(lane.labelKey),
        points: visibleEvents
          .filter((event) => event.type === lane.type)
          .map(
            (event): EventPoint => ({
              id: event.id,
              at: event.at,
              lane: lane.lane,
              size: 1,
              event,
            }),
          ),
      })),
    [t, visibleEvents],
  );
  const minuteViewDuration = minuteWindow.endAt - minuteWindow.startAt;
  const countBucketMs = getTimelineCountBucketMs(
    minuteViewDuration,
    Math.max(
      1,
      countChartWidth - CHART_Y_AXIS_WIDTH - COUNT_CHART_RIGHT_MARGIN,
    ),
  );
  const countIntervalLabel = formatCountInterval(countBucketMs, t);
  const countBuckets = useMemo(
    () =>
      buildTimelineCountBuckets(
        timeline,
        minuteWindow.startAt,
        minuteWindow.endAt,
        timelineNow,
        countBucketMs,
      ),
    [
      countBucketMs,
      minuteWindow.endAt,
      minuteWindow.startAt,
      timeline,
      timelineNow,
    ],
  );
  const countData = useMemo<MinutePoint[]>(
    () =>
      countBuckets.map((bucket) => ({
        ...bucket,
        value: bucket.hasCoverage ? bucket[minuteMetric] : null,
      })),
    [countBuckets, minuteMetric],
  );
  const selectedMinuteMetric =
    MINUTE_METRICS.find(({ key }) => key === minuteMetric) ?? MINUTE_METRICS[0];
  const selectedMinuteMetricLabel = t(selectedMinuteMetric.labelKey);
  const minuteAxisMax = Math.max(
    1,
    ...countData.map((point) => point.value ?? 0),
  );
  const hasCountCoverage = countData.some((point) => point.hasCoverage);
  const activeWindow = view === "events" ? eventWindow : minuteWindow;
  const viewDuration = activeWindow.endAt - activeWindow.startAt;
  const showSeconds = view === "events" || viewDuration <= 5 * MINUTE_MS;
  const fullDay = viewDuration >= dayRange.endAt - dayRange.startAt;
  const selectedDateLabel = new Intl.DateTimeFormat(
    i18n.resolvedLanguage ?? "en-US",
    {
    month: "long",
    day: "numeric",
    weekday: "short",
    },
  ).format(new Date(`${selectedDate}T12:00:00`));
  const rangeLabel = fullDay
    ? t("history.allDay")
    : `${formatClock(activeWindow.startAt, showSeconds)}–${formatClock(
        activeWindow.endAt,
        showSeconds,
      )}`;
  const eventTicks = useMemo(() => {
    const ticks = [eventWindow.startAt];
    let tickAt = Math.ceil(eventWindow.startAt / MINUTE_MS) * MINUTE_MS;
    while (tickAt < eventWindow.endAt) {
      if (tickAt > eventWindow.startAt) {
        ticks.push(tickAt);
      }
      tickAt += MINUTE_MS;
    }
    if (ticks[ticks.length - 1] !== eventWindow.endAt) {
      ticks.push(eventWindow.endAt);
    }
    return ticks;
  }, [eventWindow.endAt, eventWindow.startAt]);
  const availableDates = useMemo(() => {
    const dates: string[] = [];
    let dateKey = todayDate;
    while (dateKey >= firstDate) {
      dates.push(dateKey);
      dateKey = shiftLocalDateKey(dateKey, -1);
    }
    return dates;
  }, [firstDate, todayDate]);

  const getChartRatio = (clientX: number, element: HTMLDivElement): number => {
    const bounds = element.getBoundingClientRect();
    const chartWidth = Math.max(1, bounds.width - CHART_Y_AXIS_WIDTH);
    return Math.min(
      1,
      Math.max(0, (clientX - bounds.left - CHART_Y_AXIS_WIDTH) / chartWidth),
    );
  };

  const hideEventCursor = () => {
    if (eventCursor.current) {
      eventCursor.current.hidden = true;
    }
    setEventHover(null);
  };

  const chartEvents = {
    onWheel: (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const deltaMultiplier =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
      if (view === "events") {
        const rawDelta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;
        const delta = Math.max(
          -120,
          Math.min(120, rawDelta * deltaMultiplier),
        );
        if (delta === 0) {
          return;
        }
        hideEventCursor();
        eventFollowsLatest.current = false;
        const bounds = event.currentTarget.getBoundingClientRect();
        const chartWidth = Math.max(1, bounds.width - CHART_Y_AXIS_WIDTH);
        setEventWindow((current) =>
          clampViewWindow(
            Math.round(
              (current.startAt + (delta / chartWidth) * EVENT_WINDOW_MS) /
                EVENT_AXIS_STEP_MS,
            ) * EVENT_AXIS_STEP_MS,
            EVENT_WINDOW_MS,
            dayRange.startAt,
            eventNavigationEndAt,
          ),
        );
        return;
      }
      const deltaY = Math.max(
        -120,
        Math.min(120, event.deltaY * deltaMultiplier),
      );
      if (deltaY === 0) {
        return;
      }
      minuteFollowsLatest.current = false;
      const ratio = getChartRatio(event.clientX, event.currentTarget);
      setMinuteWindow((current) => {
        const duration = current.endAt - current.startAt;
        const dayDuration = dayRange.endAt - dayRange.startAt;
        const nextDuration = Math.min(
          dayDuration,
          Math.max(
            MINUTE_MS,
            duration * Math.exp(deltaY * WHEEL_ZOOM_SENSITIVITY),
          ),
        );
        const anchorAt = current.startAt + duration * ratio;
        return clampViewWindow(
          anchorAt - nextDuration * ratio,
          nextDuration,
          dayRange.startAt,
          dayRange.endAt,
        );
      });
    },
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      hideEventCursor();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startAt: activeWindow.startAt,
        endAt: activeWindow.endAt,
        moved: false,
      };
      setDragging(true);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      const bounds = event.currentTarget.getBoundingClientRect();
      const cursorX = event.clientX - bounds.left;
      const chartRight = bounds.width - EVENT_CHART_RIGHT_MARGIN;
      if (
        view === "events" &&
        !drag &&
        cursorX >= CHART_Y_AXIS_WIDTH &&
        cursorX <= chartRight &&
        visibleEvents.length > 0 &&
        eventCursor.current
      ) {
        const chartWidth = Math.max(
          1,
          chartRight - CHART_Y_AXIS_WIDTH,
        );
        const pointerAt =
          eventWindow.startAt +
          ((cursorX - CHART_Y_AXIS_WIDTH) / chartWidth) * EVENT_WINDOW_MS;
        const nearestEvent = visibleEvents.reduce((nearest, candidate) =>
          Math.abs(candidate.at - pointerAt) < Math.abs(nearest.at - pointerAt)
            ? candidate
            : nearest,
        );
        const snappedX =
          CHART_Y_AXIS_WIDTH +
          ((nearestEvent.at - eventWindow.startAt) / EVENT_WINDOW_MS) *
            chartWidth;
        eventCursor.current.hidden = false;
        eventCursor.current.style.transform = `translateX(${Math.round(snappedX)}px)`;
        setEventHover((current) => {
          const nextX = Math.round(snappedX);
          const placeBeforeCursor =
            nextX > bounds.width - EVENT_CHART_RIGHT_MARGIN - 112;
          return current?.event.id === nearestEvent.id &&
            current.x === nextX &&
            current.placeBeforeCursor === placeBeforeCursor
            ? current
            : { event: nearestEvent, x: nextX, placeBeforeCursor };
        });
      } else {
        hideEventCursor();
      }
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const chartWidth = Math.max(1, bounds.width - CHART_Y_AXIS_WIDTH);
      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) >= 4) {
        drag.moved = true;
      }
      if (drag.moved) {
        const duration = drag.endAt - drag.startAt;
        const nextStartAt =
          drag.startAt - (deltaX / chartWidth) * duration;
        if (view === "events") {
          eventFollowsLatest.current = false;
          setEventWindow(
            clampViewWindow(
              Math.round(nextStartAt / EVENT_AXIS_STEP_MS) * EVENT_AXIS_STEP_MS,
              EVENT_WINDOW_MS,
              dayRange.startAt,
              eventNavigationEndAt,
            ),
          );
        } else {
          minuteFollowsLatest.current = false;
          setMinuteWindow(
            clampViewWindow(
              nextStartAt,
              duration,
              dayRange.startAt,
              dayRange.endAt,
            ),
          );
        }
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragState.current?.pointerId !== event.pointerId) {
        return;
      }
      dragState.current = null;
      setDragging(false);
    },
    onPointerCancel: () => {
      dragState.current = null;
      setDragging(false);
      hideEventCursor();
    },
    onPointerLeave: hideEventCursor,
  };

  const xAxisStyleProps = {
    type: "number" as const,
    axisLine: false,
    tickLine: false,
    tick: { fill: "#829895", fontSize: 8, fontWeight: 650 },
    interval: "preserveStartEnd" as const,
    minTickGap: 48,
    height: 22,
  };
  const eventXAxisProps = {
    ...xAxisStyleProps,
    domain: [eventWindow.startAt, eventWindow.endAt] as [number, number],
    ticks: eventTicks,
    tickFormatter: (value: number) => formatClock(value, true),
  };
  const minuteXAxisProps = {
    ...xAxisStyleProps,
    domain: [minuteWindow.startAt, minuteWindow.endAt] as [number, number],
    tickFormatter: (value: number) => formatClock(value, showSeconds),
  };

  return (
    <article
      className="history-panel"
      data-interactive
      data-history-view={view}
      data-locale={i18n.resolvedLanguage}
      aria-label={t("history.panelAria", { date: selectedDateLabel })}
    >
      <header className="history-header">
        <div className="history-heading">
          <span className="history-mark" aria-hidden>
            <ChartLineUp size={18} weight="bold" />
          </span>
          <div>
            <h2>{t("history.title")}</h2>
            <p>{selectedDateLabel} · {rangeLabel}</p>
          </div>
        </div>

        <div className="history-toolbar">
          <div className="history-date-nav" aria-label={t("history.dateNav")}>
            <button
              className="history-nav-button"
              type="button"
              aria-label={t("history.previousDay")}
              disabled={selectedDate <= firstDate}
              onClick={() =>
                onSelectDate(shiftLocalDateKey(selectedDate, -1))
              }
            >
              <CaretLeft size={14} weight="bold" aria-hidden />
            </button>
            <label className="history-date-select">
              <CalendarBlank size={14} weight="bold" aria-hidden />
              <select
                value={selectedDate}
                aria-label={t("history.date")}
                onChange={(event) => onSelectDate(event.target.value)}
              >
                {availableDates.map((dateKey) => (
                  <option key={dateKey} value={dateKey}>
                    {dateKey}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="history-nav-button"
              type="button"
              aria-label={t("history.nextDay")}
              disabled={selectedDate >= todayDate}
              onClick={() =>
                onSelectDate(shiftLocalDateKey(selectedDate, 1))
              }
            >
              <CaretRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        <button
          className="history-close"
          type="button"
          aria-label={t("history.close")}
          onClick={onClose}
        >
          <X size={15} weight="bold" aria-hidden />
        </button>
      </header>

      <div className="history-view-bar">
        <div className="history-mode-switch" role="tablist" aria-label={t("history.viewAria")}>
          <button
            type="button"
            role="tab"
            data-history-mode="events"
            aria-selected={view === "events"}
            className={view === "events" ? "is-active" : ""}
            onClick={() => setView("events")}
          >
            {t("history.events")}
          </button>
          <button
            type="button"
            role="tab"
            data-history-mode="minutes"
            aria-selected={view === "minutes"}
            className={view === "minutes" ? "is-active" : ""}
            onClick={() => {
              hideEventCursor();
              setView("minutes");
            }}
          >
            {t("history.counts")}
          </button>
        </div>
        {view === "minutes" && (
          <div className="history-metric-switch" aria-label={t("history.metricsAria")}>
            {MINUTE_METRICS.map((metric) => (
              <button
                key={metric.key}
                type="button"
                data-history-metric={metric.key}
                aria-pressed={minuteMetric === metric.key}
                className={minuteMetric === metric.key ? "is-active" : ""}
                style={{ "--metric-color": metric.color } as React.CSSProperties}
                onClick={() => setMinuteMetric(metric.key)}
              >
                <i aria-hidden />
                {t(metric.labelKey)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="history-chart-frame">
        <div
          className={`history-chart-plot${
            dragging ? " history-chart-plot--dragging" : ""
          }`}
          data-mode={view}
          data-view-duration-ms={Math.round(viewDuration)}
          data-view-start-at={activeWindow.startAt}
          data-event-axis-step-ms={
            view === "events" ? EVENT_AXIS_STEP_MS : undefined
          }
          data-count-bucket-ms={view === "minutes" ? countBucketMs : undefined}
          data-count-point-count={
            view === "minutes" ? countData.length : undefined
          }
          data-event-lanes={EVENT_LANES.map(({ type }) => type).join(",")}
          data-latest-visible-event-at={
            view === "events" && visibleEvents.length > 0
              ? visibleEvents[visibleEvents.length - 1].at
              : undefined
          }
          role="img"
          aria-label={
            view === "events"
              ? t("history.eventsChartAria")
              : t("history.countsChartAria", {
                  interval: countIntervalLabel,
                  metric: selectedMinuteMetricLabel,
                })
          }
          {...chartEvents}
        >
          {view === "events" ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 12,
                  right: EVENT_CHART_RIGHT_MARGIN,
                  bottom: 0,
                  left: 0,
                }}
              >
                <CartesianGrid
                  stroke="rgba(70, 105, 106, 0.12)"
                  strokeDasharray="2 5"
                  vertical={false}
                />
                <XAxis {...eventXAxisProps} dataKey="at" />
                <YAxis
                  type="number"
                  dataKey="lane"
                  domain={[0.5, 6.5]}
                  ticks={EVENT_LANES.map(({ lane }) => lane)}
                  tickFormatter={(value) => {
                    const eventLane = EVENT_LANES.find(
                      ({ lane }) => lane === value,
                    );
                    return eventLane ? t(eventLane.labelKey) : "";
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#55777b", fontSize: 9, fontWeight: 700 }}
                  width={CHART_Y_AXIS_WIDTH}
                />
                <ZAxis dataKey="size" range={[12, 12]} />
                {EVENT_LANES.map((lane) => (
                  <ReferenceLine
                    key={lane.type}
                    y={lane.lane}
                    stroke={lane.color}
                    strokeOpacity={0.18}
                    strokeDasharray="2 5"
                    ifOverflow="hidden"
                  />
                ))}
                {eventSeries.map((series) => (
                  <Scatter
                    key={series.type}
                    name={series.label}
                    data={series.points}
                    fill={series.color}
                    line={false}
                    shape="circle"
                    isAnimationActive={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              debounce={50}
              onResize={(width) => {
                const nextWidth = Math.round(width);
                setCountChartWidth((current) =>
                  current === nextWidth ? current : nextWidth,
                );
              }}
            >
              <LineChart
                data={countData}
                margin={{
                  top: 12,
                  right: COUNT_CHART_RIGHT_MARGIN,
                  bottom: 0,
                  left: 0,
                }}
              >
                <CartesianGrid
                  stroke="rgba(70, 105, 106, 0.12)"
                  strokeDasharray="2 5"
                  vertical={false}
                />
                <XAxis {...minuteXAxisProps} dataKey="startAt" />
                <YAxis
                  domain={[0, minuteAxisMax]}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#55777b", fontSize: 9, fontWeight: 700 }}
                  width={CHART_Y_AXIS_WIDTH}
                />
                <Tooltip
                  content={
                    <CountTooltip metricLabel={selectedMinuteMetricLabel} />
                  }
                  cursor={{ stroke: "rgba(36, 77, 83, 0.34)", strokeWidth: 1 }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name={selectedMinuteMetricLabel}
                  stroke={selectedMinuteMetric.color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: selectedMinuteMetric.color, strokeWidth: 0 }}
                  activeDot={{
                    r: 4,
                    fill: selectedMinuteMetric.color,
                    stroke: "#f7fbf8",
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {view === "events" && (
            <div
              ref={eventCursor}
              className="history-event-cursor"
              aria-hidden
              hidden
            />
          )}
          {view === "events" && eventHover && (
            <div
              className={`history-event-tooltip${
                eventHover.placeBeforeCursor
                  ? " history-event-tooltip--before"
                  : ""
              }`}
              style={{ left: eventHover.x }}
            >
              <EventTooltip event={eventHover.event} />
            </div>
          )}
          {view === "events" && visibleEvents.length === 0 && (
            <div className="history-empty">
              <ChartLineUp size={17} weight="bold" aria-hidden />
              <span>{t("history.emptyEvents")}</span>
            </div>
          )}
          {view === "minutes" && !hasCountCoverage && (
            <div className="history-empty">
              <ChartLineUp size={17} weight="bold" aria-hidden />
              <span>{t("history.emptyCoverage")}</span>
            </div>
          )}
        </div>
      </div>

      <footer className="history-footer">
        <p className="history-view-note" data-note-kind={view}>
          {view === "events"
            ? t("history.eventNote")
            : t("history.countNote", { interval: countIntervalLabel })}
        </p>
        <p className="history-footnote">{t("history.footnote")}</p>
      </footer>
    </article>
  );
}
