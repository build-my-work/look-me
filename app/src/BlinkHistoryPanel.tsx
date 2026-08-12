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

  return (
    <article
      className="history-panel"
      data-interactive
      aria-label={`${selectedDateLabel}每分钟眨眼频率`}
    >
      <header className="history-header">
        <div className="history-heading">
          <span className="history-mark" aria-hidden>
            <ChartLineUp size={18} weight="bold" />
          </span>
          <div>
            <h2>全天眨眼曲线</h2>
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
          aria-label="关闭全天眨眼曲线"
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
          <dt>有效分钟</dt>
          <dd>{summary.validMinuteCount}<span>分钟</span></dd>
        </div>
        <div>
          <dt>观察时段平均</dt>
          <dd>{summary.averageRate ?? "—"}<span>次/分</span></dd>
        </div>
      </dl>

      <div
        className="history-chart"
        role="img"
        aria-label={`${selectedDateLabel}从零点到二十四点的每分钟眨眼频率曲线`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="rgba(70, 105, 106, 0.12)"
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
              tick={{ fill: "#829895", fontSize: 8, fontWeight: 650 }}
              interval="preserveStartEnd"
              height={18}
            />
            <YAxis
              domain={[0, "auto"]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#829895", fontSize: 8, fontWeight: 650 }}
              width={24}
            />
            <Tooltip
              cursor={{ stroke: "rgba(49, 95, 102, 0.22)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as BlinkHistoryPoint | undefined;
                if (!active || !point || point.rate === null) {
                  return null;
                }
                return (
                  <div className="history-tooltip">
                    <strong>{point.label}</strong>
                    <span>{point.rate} 次/分</span>
                    <small>{point.blinkCount} 次 · 观察 {Math.round(point.observedMs / 1_000)} 秒</small>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#3f7d83"
              strokeWidth={2.4}
              dot={false}
              activeDot={{ r: 3.2, fill: "#f8fcf9", stroke: "#315f66", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {summary.validMinuteCount === 0 && (
          <div className="history-empty">
            <ChartLineUp size={17} weight="bold" aria-hidden />
            <span>这一天还没有足够的有效观察</span>
          </div>
        )}
      </div>

      <p className="history-footnote">
        空白处表示未检测到足够的有效观察 · 数据仅存本机 30 天
      </p>
    </article>
  );
}
