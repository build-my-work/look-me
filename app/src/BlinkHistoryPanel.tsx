import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  X,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type BlinkHistory,
  type BlinkHistoryPoint,
  formatMinuteLabel,
  formatObservedDuration,
  getDaySeries,
  shiftLocalDateKey,
  summarizeDay,
} from "./blink-history";

interface BlinkHistoryPanelProps {
  history: BlinkHistory;
  selectedDate: string;
  firstDate: string;
  todayDate: string;
  onSelectDate: (dateKey: string) => void;
  onClose: () => void;
}

export default function BlinkHistoryPanel({
  history,
  selectedDate,
  firstDate,
  todayDate,
  onSelectDate,
  onClose,
}: BlinkHistoryPanelProps) {
  const series = useMemo(
    () => getDaySeries(history, selectedDate),
    [history, selectedDate],
  );
  const summary = useMemo(
    () => summarizeDay(history, selectedDate),
    [history, selectedDate],
  );
  const availableDates = useMemo(() => {
    const dates: string[] = [];
    let dateKey = todayDate;
    while (dateKey >= firstDate) {
      dates.push(dateKey);
      dateKey = shiftLocalDateKey(dateKey, -1);
    }
    return dates;
  }, [firstDate, todayDate]);
  const selectedDateLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${selectedDate}T12:00:00`));
  const observedDuration = formatObservedDuration(summary.observedMs);
  const hasObservedData = series.some(
    (point) => point.observedMs > 0 || point.blinkCount !== null,
  );

  return (
    <article
      className="history-panel"
      data-interactive
      aria-label={`${selectedDateLabel}每分钟眨眼次数与有效看屏时长`}
    >
      <header className="history-header">
        <div className="history-heading">
          <span className="history-mark" aria-hidden>
            <ChartLineUp size={18} weight="bold" />
          </span>
          <div>
            <h2>眨眼与看屏趋势</h2>
            <p>{selectedDateLabel}</p>
          </div>
        </div>

        <div className="history-date-nav" aria-label="切换统计日期">
          <button
            className="history-nav-button"
            type="button"
            aria-label="前一天"
            disabled={selectedDate <= firstDate}
            onClick={() => onSelectDate(shiftLocalDateKey(selectedDate, -1))}
          >
            <CaretLeft size={14} weight="bold" aria-hidden />
          </button>
          <label className="history-date-select">
            <CalendarBlank size={14} weight="bold" aria-hidden />
            <select
              value={selectedDate}
              aria-label="统计日期"
              onChange={(event) => {
                const dateKey = event.target.value;
                onSelectDate(dateKey);
              }}
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
            aria-label="后一天"
            disabled={selectedDate >= todayDate}
            onClick={() => onSelectDate(shiftLocalDateKey(selectedDate, 1))}
          >
            <CaretRight size={14} weight="bold" aria-hidden />
          </button>
        </div>

        <button
          className="history-close"
          type="button"
          aria-label="关闭眨眼与看屏趋势"
          onClick={onClose}
        >
          <X size={15} weight="bold" aria-hidden />
        </button>
      </header>

      <dl className="history-summary">
        <div>
          <dt>全天记录</dt>
          <dd>{summary.totalBlinks}<span>次眨眼</span></dd>
        </div>
        <div>
          <dt>有效看屏</dt>
          <dd>{observedDuration.value}<span>{observedDuration.unit}</span></dd>
        </div>
        <div>
          <dt>观察时段平均</dt>
          <dd>{summary.averageRate ?? "—"}<span>次/分</span></dd>
        </div>
      </dl>

      <div className="history-charts">
        <section
          className="history-track"
          aria-label={`${selectedDateLabel}每分钟实际眨眼次数曲线`}
        >
          <div className="history-track-label history-track-label--blink">
            <strong>眨眼次数</strong>
            <span>每分钟 · 次</span>
          </div>
          <div className="history-track-chart" role="img">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                syncId="daily-history"
                data={series}
                margin={{ top: 3, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(70, 105, 106, 0.12)"
                  strokeDasharray="2 5"
                />
                <XAxis
                  dataKey="minuteIndex"
                  type="number"
                  domain={[0, 1439]}
                  hide
                />
                <YAxis
                  domain={[0, "auto"]}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#829895", fontSize: 7, fontWeight: 650 }}
                  width={20}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(49, 95, 102, 0.22)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as
                      | BlinkHistoryPoint
                      | undefined;
                    if (!active || !point || point.blinkCount === null) {
                      return null;
                    }
                    return (
                      <div className="history-tooltip">
                        <strong>{point.label}</strong>
                        <span>{point.blinkCount} 次眨眼</span>
                        <small>
                          本分钟有效看屏 {point.screenSeconds ?? 0} 秒
                        </small>
                      </div>
                    );
                  }}
                />
                <Line
                  type="linear"
                  dataKey="blinkCount"
                  stroke="#3f7d83"
                  strokeWidth={2.1}
                  dot={false}
                  activeDot={{
                    r: 3,
                    fill: "#f8fcf9",
                    stroke: "#315f66",
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          className="history-track"
          aria-label={`${selectedDateLabel}每分钟有效看屏秒数曲线`}
        >
          <div className="history-track-label history-track-label--screen">
            <strong>有效看屏</strong>
            <span>每分钟 · 秒</span>
          </div>
          <div className="history-track-chart" role="img">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                syncId="daily-history"
                data={series}
                margin={{ top: 3, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(86, 116, 143, 0.11)"
                  strokeDasharray="2 5"
                />
                <XAxis
                  dataKey="minuteIndex"
                  type="number"
                  domain={[0, 1439]}
                  ticks={[0, 360, 720, 1080, 1439]}
                  tickFormatter={(value) => formatMinuteLabel(Number(value))}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#829895", fontSize: 7, fontWeight: 650 }}
                  interval="preserveStartEnd"
                  height={15}
                />
                <YAxis
                  domain={[0, 60]}
                  ticks={[0, 30, 60]}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#829895", fontSize: 7, fontWeight: 650 }}
                  width={20}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(86, 116, 143, 0.22)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as
                      | BlinkHistoryPoint
                      | undefined;
                    if (!active || !point || point.screenSeconds === null) {
                      return null;
                    }
                    return (
                      <div className="history-tooltip">
                        <strong>{point.label}</strong>
                        <span>{point.screenSeconds} 秒看屏</span>
                        <small>本分钟 {point.blinkCount ?? 0} 次眨眼</small>
                      </div>
                    );
                  }}
                />
                <Line
                  type="linear"
                  dataKey="screenSeconds"
                  stroke="#7697ad"
                  strokeWidth={2.1}
                  dot={false}
                  activeDot={{
                    r: 3,
                    fill: "#f8fcf9",
                    stroke: "#587c96",
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {!hasObservedData && (
          <div className="history-empty">
            <ChartLineUp size={17} weight="bold" aria-hidden />
            <span>这一天还没有有效观察</span>
          </div>
        )}
      </div>

      <p className="history-footnote">
        看屏时长按本地人脸可见估算 · 数据仅存本机 30 天
      </p>
    </article>
  );
}
