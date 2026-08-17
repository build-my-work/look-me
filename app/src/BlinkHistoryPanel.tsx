import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shiftLocalDateKey } from "./local-history-time";
import {
  buildTimelineBuckets,
  formatObservedDuration,
  selectTimelineBucketMs,
  summarizeTimeline,
  type TimelineBucket,
} from "./timeline-analytics";
import {
  getLocalDayRange,
  type TimelineEventType,
  type TimelineRange,
} from "./timeline";
import { useTimelineRange } from "./useTimeline";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const SECOND_MS = 1_000;
const SECOND_RESOLUTION_MAX_RANGE_MS = 5 * MINUTE_MS;
const LIVE_BLINK_MARKER_MS = 4_000;
const CHART_LEFT_AXIS_WIDTH = 42;
const CHART_RIGHT_AXIS_WIDTH = 34;
const CHART_AXIS_GUTTER = CHART_LEFT_AXIS_WIDTH + CHART_RIGHT_AXIS_WIDTH;
const WHEEL_ZOOM_SENSITIVITY = 0.0025;
const BLINK_EVENT_LANE_Y = 0.82;
const YAWN_EVENT_LANE_Y = 0.38;

type MetricKey = "blink" | "screen" | "yawn";
type MetricVisibility = Record<MetricKey, boolean>;

const METRIC_OPTIONS: ReadonlyArray<{
  key: MetricKey;
  label: string;
  color: string;
}> = [
  { key: "blink", label: "眨眼", color: "#315f66" },
  { key: "screen", label: "有效看屏", color: "#7697ad" },
  { key: "yawn", label: "打哈欠", color: "#9b7da3" },
];

const EVENT_LABELS: Partial<Record<TimelineEventType, string>> = {
  "yawn.detected": "判断为哈欠",
  "distance.due": "远眺到期",
  "blink-reminder.due": "眨眼提醒到期",
  "sedentary.due": "久坐提醒到期",
  "yawn-response.shown": "看山响应哈欠",
  "distance-reminder.shown": "展示远眺提醒",
  "distance-reminder.completed": "完成远眺",
  "distance-reminder.skipped": "跳过远眺",
  "distance-reminder.dismissed": "关闭远眺提醒",
  "blink-reminder.shown": "展示眨眼提醒",
  "blink-reminder.completed": "完成眨眼提醒",
  "blink-reminder.dismissed": "关闭眨眼提醒",
  "sedentary-reminder.shown": "展示久坐提醒",
  "sedentary-reminder.acknowledged": "确认起身",
  "sedentary-reminder.dismissed": "关闭久坐提醒",
};

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

interface ChartPoint extends TimelineBucket {
  screenSeries: number | null;
}

function clampViewWindow(
  startAt: number,
  durationMs: number,
  dayStart: number,
  dayEnd: number,
): ViewWindow {
  const duration = Math.min(dayEnd - dayStart, Math.max(MINUTE_MS, durationMs));
  const snappedStart =
    duration <= SECOND_RESOLUTION_MAX_RANGE_MS
      ? Math.round(startAt / SECOND_MS) * SECOND_MS
      : startAt;
  const clampedStart = Math.min(dayEnd - duration, Math.max(dayStart, snappedStart));
  return { startAt: clampedStart, endAt: clampedStart + duration };
}

function formatClock(timestamp: number, includeSeconds: boolean): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return includeSeconds
    ? `${hours}:${minutes}:${String(date.getSeconds()).padStart(2, "0")}`
    : `${hours}:${minutes}`;
}

function formatVisibleDuration(durationMs: number): { value: string; unit: string } {
  if (durationMs < MINUTE_MS) {
    return { value: (durationMs / SECOND_MS).toFixed(1), unit: "秒" };
  }
  return formatObservedDuration(durationMs);
}

function formatBucketGranularity(bucketMs: number): string {
  if (bucketMs < MINUTE_MS) {
    return `${bucketMs / SECOND_MS} 秒粒度`;
  }
  return `${bucketMs / MINUTE_MS} 分钟粒度`;
}

function TimelineTooltip({
  active,
  payload,
  metricVisibility,
  durationInMilliseconds,
  exactEventMode,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  metricVisibility: MetricVisibility;
  durationInMilliseconds: boolean;
  exactEventMode: boolean;
}) {
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) {
    return null;
  }
  const includeSeconds = point.endAt - point.startAt < MINUTE_MS;
  const tooltipLabel = exactEventMode
    ? point.label
    : `${formatClock(point.startAt, includeSeconds)}–${formatClock(
        point.endAt,
        includeSeconds,
      )}`;
  return (
    <div className="history-tooltip">
      <strong>{tooltipLabel}</strong>
      {metricVisibility.blink && (
        <span className="history-tooltip-value history-tooltip-value--blink">
          {exactEventMode ? "本秒眨眼" : "眨眼"} {point.blinkCount} 次
        </span>
      )}
      {metricVisibility.screen && (
        <span className="history-tooltip-value history-tooltip-value--screen">
          有效看屏 {durationInMilliseconds ? `${point.screenMs} ms` : `${point.screenSeconds.toFixed(1)} 秒`}
        </span>
      )}
      {metricVisibility.yawn && (
        <span className="history-tooltip-value history-tooltip-value--yawn">
          {exactEventMode ? "本秒哈欠" : "打哈欠"} {point.yawnCount} 次
        </span>
      )}
      {point.actionCount > 0 && (
        <small>动作 {point.actionCount} 个</small>
      )}
      {point.decisionTypes.length > 0 && (
        <small>
          判断 {point.decisionTypes.map((type) => EVENT_LABELS[type] ?? type).join("、")}
        </small>
      )}
      {point.actionTypes.length > 0 && (
        <small>
          动作 {point.actionTypes.map((type) => EVENT_LABELS[type] ?? type).join("、")}
        </small>
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
  const dayRange = useMemo(() => getLocalDayRange(selectedDate), [selectedDate]);
  const recordedRange = useTimelineRange(dayRange.startAt, dayRange.endAt);
  const timeline = demoRange ?? recordedRange;
  const selectedDateIsToday = selectedDate === todayDate;
  const initialViewEndAt = selectedDateIsToday
    ? Math.min(dayRange.endAt, Math.max(dayRange.startAt + MINUTE_MS, now))
    : dayRange.endAt;
  const [viewWindow, setViewWindow] = useState<ViewWindow>(() =>
    selectedDateIsToday
      ? clampViewWindow(
          initialViewEndAt - HOUR_MS,
          HOUR_MS,
          dayRange.startAt,
          dayRange.endAt,
        )
      : dayRange,
  );
  const [dragging, setDragging] = useState(false);
  const [plotWidth, setPlotWidth] = useState(720);
  const [metricVisibility, setMetricVisibility] = useState<MetricVisibility>({
    blink: true,
    screen: true,
    yawn: true,
  });
  const dragState = useRef<DragState | null>(null);
  const chartPlotRef = useRef<HTMLDivElement | null>(null);
  const followsLatest = useRef(selectedDateIsToday);
  const latestNow = useRef(now);
  latestNow.current = now;

  useEffect(() => {
    followsLatest.current = selectedDateIsToday;
    if (!selectedDateIsToday) {
      setViewWindow(dayRange);
      return;
    }
    const endAt = Math.min(
      dayRange.endAt,
      Math.max(dayRange.startAt + MINUTE_MS, latestNow.current),
    );
    setViewWindow(
      clampViewWindow(
        endAt - HOUR_MS,
        HOUR_MS,
        dayRange.startAt,
        dayRange.endAt,
      ),
    );
  }, [dayRange, selectedDateIsToday]);

  useEffect(() => {
    if (!followsLatest.current || !selectedDateIsToday) {
      return;
    }
    const endAt = Math.min(
      dayRange.endAt,
      Math.max(dayRange.startAt + MINUTE_MS, now),
    );
    setViewWindow((current) => {
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
  }, [dayRange.endAt, dayRange.startAt, now, selectedDateIsToday]);

  useEffect(() => {
    const element = chartPlotRef.current;
    if (!element) {
      return;
    }
    const updateWidth = () => {
      const nextWidth = Math.max(1, Math.round(element.getBoundingClientRect().width));
      setPlotWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const viewDuration = viewWindow.endAt - viewWindow.startAt;
  const bucketMs = selectTimelineBucketMs(
    viewDuration,
    Math.max(1, plotWidth - CHART_AXIS_GUTTER),
  );
  const showSeconds = bucketMs < MINUTE_MS;
  const exactEventMode = bucketMs === SECOND_MS;
  const durationInMilliseconds = exactEventMode;
  const durationCapacity = durationInMilliseconds
    ? bucketMs
    : bucketMs / SECOND_MS;
  const buckets = useMemo(
    () =>
      buildTimelineBuckets(
        timeline,
        viewWindow.startAt,
        viewWindow.endAt,
        bucketMs,
        now,
      ),
    [bucketMs, now, timeline, viewWindow.endAt, viewWindow.startAt],
  );
  const chartData = useMemo<ChartPoint[]>(
    () =>
      buckets.map((point) => ({
        ...point,
        screenSeries: point.hasData
          ? durationInMilliseconds
            ? point.screenMs
            : point.screenSeconds
          : null,
      })),
    [buckets, durationInMilliseconds],
  );
  const visibleAnnotations = useMemo(
    () =>
      timeline.events.filter(
        (event) =>
          (event.layer === "decision" || event.layer === "action") &&
          event.at >= viewWindow.startAt &&
          event.at < viewWindow.endAt,
      ),
    [timeline.events, viewWindow.endAt, viewWindow.startAt],
  );
  const exactBlinkPoints = useMemo(() => {
    if (!exactEventMode) {
      return [];
    }
    return timeline.events
      .filter(
        (event) =>
          event.type === "blink.detected" &&
          event.at >= viewWindow.startAt &&
          event.at < viewWindow.endAt,
      )
      .map((event) => ({ id: event.id, at: event.at }));
  }, [exactEventMode, timeline.events, viewWindow.endAt, viewWindow.startAt]);
  const exactYawnPoints = useMemo(() => {
    if (!exactEventMode) {
      return [];
    }
    return timeline.events
      .filter(
        (event) =>
          event.type === "yawn.detected" &&
          event.at >= viewWindow.startAt &&
          event.at < viewWindow.endAt,
      )
      .map((event) => ({ id: event.id, at: event.at }));
  }, [exactEventMode, timeline.events, viewWindow.endAt, viewWindow.startAt]);
  const liveBlinkPoint = useMemo(() => {
    const bucket = buckets.reduce<TimelineBucket | null>((latest, point) => {
      if (
        point.latestBlinkAt === null ||
        point.latestBlinkAt > now ||
        now - point.latestBlinkAt > LIVE_BLINK_MARKER_MS
      ) {
        return latest;
      }
      if (latest === null || latest.latestBlinkAt === null) {
        return point;
      }
      return latest.latestBlinkAt > point.latestBlinkAt ? latest : point;
    }, null);
    if (bucket === null || bucket.latestBlinkAt === null) {
      return null;
    }
    return {
      at: bucket.latestBlinkAt,
    };
  }, [buckets, now]);
  const summary = useMemo(
    () =>
      summarizeTimeline(
        timeline,
        viewWindow.startAt,
        viewWindow.endAt,
        now,
      ),
    [now, timeline, viewWindow.endAt, viewWindow.startAt],
  );
  const screenDuration = formatVisibleDuration(summary.screenMs);
  const seatedDuration = formatObservedDuration(summary.seatedMs);
  const awayDuration = formatObservedDuration(summary.awayMs);
  const hasData = chartData.some((point) => point.hasData);
  const countAxisMax = exactEventMode
    ? 1
    : Math.max(
        1,
        ...chartData.map((point) =>
          Math.max(
            metricVisibility.blink ? point.blinkCount : 0,
            metricVisibility.yawn ? point.yawnCount : 0,
          ),
        ),
      );
  const hasCountMetric = metricVisibility.blink || metricVisibility.yawn;
  const bucketUnitLabel =
    bucketMs < MINUTE_MS
      ? `${bucketMs / SECOND_MS}秒`
      : `${bucketMs / MINUTE_MS}分钟`;
  const countUnitLabel = exactEventMode ? "事件" : `次/${bucketUnitLabel}`;
  const durationUnitLabel = exactEventMode
    ? "秒内时长"
    : `秒/${bucketUnitLabel}`;
  const fullDay = viewDuration >= dayRange.endAt - dayRange.startAt;
  const selectedDateLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${selectedDate}T12:00:00`));
  const granularityLabel = formatBucketGranularity(bucketMs);
  const rangeLabel = fullDay
    ? `全天 · ${granularityLabel}`
    : `${formatClock(viewWindow.startAt, showSeconds)}–${formatClock(
        viewWindow.endAt,
        showSeconds,
      )} · ${granularityLabel}`;
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
    const chartWidth = Math.max(1, bounds.width - CHART_AXIS_GUTTER);
    return Math.min(
      1,
      Math.max(
        0,
        (clientX - bounds.left - CHART_LEFT_AXIS_WIDTH) / chartWidth,
      ),
    );
  };

  const chartEvents = {
    onWheel: (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const deltaMultiplier =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
      const deltaY = Math.max(
        -120,
        Math.min(120, event.deltaY * deltaMultiplier),
      );
      if (deltaY === 0) {
        return;
      }
      followsLatest.current = false;
      const ratio = getChartRatio(event.clientX, event.currentTarget);
      setViewWindow((current) => {
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
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startAt: viewWindow.startAt,
        endAt: viewWindow.endAt,
        moved: false,
      };
      setDragging(true);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const chartWidth = Math.max(1, bounds.width - CHART_AXIS_GUTTER);
      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) >= 4) {
        drag.moved = true;
        followsLatest.current = false;
      }
      if (drag.moved) {
        const duration = drag.endAt - drag.startAt;
        setViewWindow(
          clampViewWindow(
            drag.startAt - (deltaX / chartWidth) * duration,
            duration,
            dayRange.startAt,
            dayRange.endAt,
          ),
        );
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      dragState.current = null;
      setDragging(false);
    },
    onPointerCancel: () => {
      dragState.current = null;
      setDragging(false);
    },
  };

  const commonChart = {
    data: chartData,
    margin: { top: 9, right: 0, bottom: 0, left: 0 },
  };
  const commonXAxis = {
    dataKey: "startAt",
    type: "number" as const,
    domain: [viewWindow.startAt, viewWindow.endAt] as [number, number],
  };

  return (
    <article className="history-panel" data-interactive aria-label={`${selectedDateLabel}行为时间轴`}>
      <header className="history-header">
        <div className="history-heading">
          <span className="history-mark" aria-hidden><ChartLineUp size={18} weight="bold" /></span>
          <div><h2>行为时间轴</h2><p>{selectedDateLabel} · {rangeLabel}</p></div>
        </div>

        <div className="history-toolbar">
          <div className="history-date-nav" aria-label="切换统计日期">
            <button className="history-nav-button" type="button" aria-label="前一天" disabled={selectedDate <= firstDate} onClick={() => onSelectDate(shiftLocalDateKey(selectedDate, -1))}>
              <CaretLeft size={14} weight="bold" aria-hidden />
            </button>
            <label className="history-date-select">
              <CalendarBlank size={14} weight="bold" aria-hidden />
              <select value={selectedDate} aria-label="统计日期" onChange={(event) => onSelectDate(event.target.value)}>
                {availableDates.map((dateKey) => <option key={dateKey} value={dateKey}>{dateKey}</option>)}
              </select>
            </label>
            <button className="history-nav-button" type="button" aria-label="后一天" disabled={selectedDate >= todayDate} onClick={() => onSelectDate(shiftLocalDateKey(selectedDate, 1))}>
              <CaretRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        <button className="history-close" type="button" aria-label="关闭行为时间轴" onClick={onClose}>
          <X size={15} weight="bold" aria-hidden />
        </button>
      </header>

      <dl className="history-summary">
        <div><dt>眨眼</dt><dd>{summary.blinkCount}<span>次</span></dd></div>
        <div><dt>有效看屏</dt><dd>{screenDuration.value}<span>{screenDuration.unit}</span></dd></div>
        <div><dt>打哈欠</dt><dd>{summary.yawnCount}<span>次</span></dd></div>
      </dl>

      <div className="history-chart-frame">
        <div className="history-series-bar" role="group" aria-label="显示指标">
          {METRIC_OPTIONS.map((metric) => (
            <label
              key={metric.key}
              className={`history-series-toggle${metricVisibility[metric.key] ? " history-series-toggle--active" : ""}`}
              style={{ "--series-color": metric.color } as React.CSSProperties}
            >
              <input
                type="checkbox"
                checked={metricVisibility[metric.key]}
                aria-label={`显示${metric.label}`}
                onChange={() =>
                  setMetricVisibility((current) => ({
                    ...current,
                    [metric.key]: !current[metric.key],
                  }))
                }
              />
              <span
                className={`history-series-swatch${
                  metric.key !== "screen"
                    ? exactEventMode
                      ? " history-series-swatch--event"
                      : " history-series-swatch--aggregate"
                    : ""
                }`}
                aria-hidden
              />
              <strong>{metric.label}</strong>
              <small>
                {metric.key === "screen" ? durationUnitLabel : countUnitLabel}
              </small>
            </label>
          ))}
        </div>

        <div
          ref={chartPlotRef}
          className={`history-chart-plot${dragging ? " history-chart-plot--dragging" : ""}`}
          data-mode={exactEventMode ? "events" : "aggregate"}
          data-view-duration-ms={Math.round(viewDuration)}
          role="img"
          aria-label="所选范围眨眼次数、有效看屏时长、打哈欠次数与业务事件"
          {...chartEvents}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart {...commonChart}>
              <CartesianGrid
                stroke="rgba(70, 105, 106, 0.12)"
                strokeDasharray="2 5"
                vertical={false}
              />
              <XAxis
                {...commonXAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#829895", fontSize: 8, fontWeight: 650 }}
                tickFormatter={(value) => formatClock(Number(value), showSeconds)}
                interval="preserveStartEnd"
                minTickGap={48}
                height={22}
              />
              <YAxis
                yAxisId="duration"
                domain={[0, durationCapacity]}
                ticks={[0, durationCapacity]}
                axisLine={false}
                tickLine={false}
                tick={
                  metricVisibility.screen
                    ? { fill: "#829895", fontSize: 8, fontWeight: 650 }
                    : false
                }
                width={CHART_LEFT_AXIS_WIDTH}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                domain={[0, countAxisMax]}
                ticks={[0, countAxisMax]}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={
                  hasCountMetric && !exactEventMode
                    ? { fill: "#55777b", fontSize: 8, fontWeight: 700 }
                    : false
                }
                width={CHART_RIGHT_AXIS_WIDTH}
              />
              {metricVisibility.blink && exactEventMode && (
                <ReferenceLine
                  className="history-blink-event-lane"
                  yAxisId="count"
                  y={BLINK_EVENT_LANE_Y}
                  stroke="#315f66"
                  strokeDasharray="2 5"
                  strokeOpacity={0.2}
                  ifOverflow="hidden"
                />
              )}
              {metricVisibility.yawn && exactEventMode && (
                <ReferenceLine
                  className="history-yawn-event-lane"
                  yAxisId="count"
                  y={YAWN_EVENT_LANE_Y}
                  stroke="#9b7da3"
                  strokeDasharray="2 5"
                  strokeOpacity={0.2}
                  ifOverflow="hidden"
                />
              )}
              {visibleAnnotations.map((event) => (
                <ReferenceLine
                  key={event.id}
                  className={`history-annotation history-annotation--${event.layer}`}
                  yAxisId="duration"
                  x={event.at}
                  stroke={event.layer === "decision" ? "#bc765e" : "#477f6f"}
                  strokeDasharray={event.layer === "decision" ? "4 4" : undefined}
                  strokeOpacity={0.76}
                  strokeWidth={1.2}
                  ifOverflow="hidden"
                />
              ))}
              <Tooltip
                content={
                  <TimelineTooltip
                    metricVisibility={metricVisibility}
                    durationInMilliseconds={durationInMilliseconds}
                    exactEventMode={exactEventMode}
                  />
                }
                cursor={{ stroke: "rgba(36, 77, 83, 0.42)", strokeWidth: 1 }}
                filterNull={false}
              />
              {metricVisibility.blink && !exactEventMode && (
                <Bar
                  className="history-blink-aggregate"
                  yAxisId="count"
                  dataKey="blinkCount"
                  name="眨眼次数"
                  fill="#315f66"
                  fillOpacity={0.28}
                  stroke="#315f66"
                  strokeOpacity={0.64}
                  strokeWidth={0.8}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              )}
              {metricVisibility.yawn && !exactEventMode && (
                <Bar
                  className="history-yawn-aggregate"
                  yAxisId="count"
                  dataKey="yawnCount"
                  name="打哈欠次数"
                  fill="#9b7da3"
                  fillOpacity={0.3}
                  stroke="#9b7da3"
                  strokeOpacity={0.68}
                  strokeWidth={0.8}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              )}
              {metricVisibility.blink && exactEventMode && (
                <Line
                  className="history-tooltip-carrier"
                  yAxisId="count"
                  type="stepAfter"
                  dataKey="blinkCount"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              {metricVisibility.yawn && exactEventMode && (
                <Line
                  className="history-tooltip-carrier history-tooltip-carrier--yawn"
                  yAxisId="count"
                  type="stepAfter"
                  dataKey="yawnCount"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              {metricVisibility.screen && (
                <Line
                  className="history-duration-line history-duration-line--screen"
                  yAxisId="duration"
                  type="stepAfter"
                  dataKey="screenSeries"
                  name="有效看屏"
                  stroke="#7697ad"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: "#7697ad", stroke: "#f7fbf8" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              {metricVisibility.blink && exactEventMode &&
                exactBlinkPoints.map((point) => (
                  <ReferenceDot
                    key={point.id}
                    className="history-blink-dot"
                    yAxisId="count"
                    x={point.at}
                    y={BLINK_EVENT_LANE_Y}
                    r={3.2}
                    fill="#315f66"
                    stroke="#f7fbf8"
                    strokeWidth={1}
                  />
                ))}
              {metricVisibility.yawn && exactEventMode &&
                exactYawnPoints.map((point) => (
                  <ReferenceDot
                    key={point.id}
                    className="history-yawn-dot"
                    yAxisId="count"
                    x={point.at}
                    y={YAWN_EVENT_LANE_Y}
                    r={3.4}
                    fill="#9b7da3"
                    stroke="#f7fbf8"
                    strokeWidth={1}
                  />
                ))}
              {metricVisibility.blink && exactEventMode && liveBlinkPoint && (
                <ReferenceDot
                  className="history-live-blink-dot"
                  yAxisId="count"
                  x={liveBlinkPoint.at}
                  y={BLINK_EVENT_LANE_Y}
                  r={4}
                  fill="#d06b4f"
                  stroke="#fffaf5"
                  strokeWidth={2}
                  zIndex={1_000}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          {!hasData && <div className="history-empty"><ChartLineUp size={17} weight="bold" aria-hidden /><span>这个时间范围还没有事件</span></div>}
        </div>
      </div>

      <footer className="history-footer">
        <p className="history-posture-summary">
          坐姿 {seatedDuration.value} {seatedDuration.unit}<span aria-hidden>·</span>
          离座 {awayDuration.value} {awayDuration.unit}<span aria-hidden>·</span>
          起身 {summary.standUps} 次
        </p>
        <p className="history-event-legend">
          <span><i className="history-event-dot history-event-dot--decision" />业务判断</span>
          <span><i className="history-event-dot history-event-dot--action" />实际动作</span>
        </p>
        <p className="history-footnote">本地事件 · 最近 30 天</p>
      </footer>
    </article>
  );
}
