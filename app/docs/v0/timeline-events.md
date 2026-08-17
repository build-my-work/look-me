# Timeline 事件模型 V0

当前代码共实现 26 个事件。

## 通用字段

| 字段 | 含义 |
|---|---|
| `id` | 事件唯一标识，由存储层生成。 |
| `sessionId` | 所属采集会话，由存储层写入。 |
| `at` | 事件发生时间。 |
| `layer` | 事件层级：`fact`、`decision` 或 `action`。 |
| `type` | 事件类型。 |
| `spanId` | 可选，用于配对看屏或张嘴的开始、结束事件。 |
| `causedBy` | 可选，记录前置事件 ID。 |
| `data` | 可选，记录事件自身的数据。 |

## Fact

| 事件 | 含义 | 实际写入的数据 |
|---|---|---|
| `monitoring.started` | 监测进入启用状态。 | 无。 |
| `monitoring.stopped` | 监测进入停用状态。 | 无。 |
| `distance-reminder.enabled` | 远眺提醒进入开启状态。 | 无。 |
| `distance-reminder.disabled` | 远眺提醒进入关闭状态。 | 无。 |
| `screen.started` | 有效看屏开始。 | `spanId`。 |
| `screen.ended` | 有效看屏结束。 | `spanId`、`causedBy`；`data.reason: monitoring-stopped / distance-break / sensing-unavailable / face-lost / observation-gap / not-observing`。 |
| `blink.detected` | 检测到一次完整眨眼。 | `data.closedAt`、`openedAt`、`closedDurationMs`、`peakLeftBlend`、`peakRightBlend`、`minimumEar`。 |
| `mouth.opened` | 嘴部进入张开状态。 | `spanId`；`data.jawOpen`。 |
| `mouth.closed` | 嘴部进入闭合状态。 | `spanId`、`causedBy`；`data.jawOpen`、`reason: detected / face-lost / sensing-unavailable / monitoring-stopped`。 |
| `posture.changed` | 姿态状态发生变化。 | `data.state: calibrating / seated / away / unknown`。 |
| `stand-up.detected` | 检测到一次站起。 | 无。 |

## Decision

| 事件 | 含义 | 实际写入的数据 |
|---|---|---|
| `yawn.detected` | 判断发生一次哈欠。 | 可选 `causedBy`；`data.openedAt`、`openDurationMs`、`thresholdMs`。 |
| `distance.due` | 判断远眺提醒到期。 | `data.accumulatedScreenMs`、`thresholdMs`。 |
| `blink-reminder.due` | 判断眨眼提醒到期。 | `data.thresholdMs`。 |
| `sedentary.due` | 判断久坐提醒到期。 | `data.thresholdMs`。 |

## Action

| 事件 | 含义 | 实际写入的数据 |
|---|---|---|
| `yawn-response.shown` | 看山展示哈欠响应。 | 可选 `causedBy`；`data.response: mouth-sync`。 |
| `distance-reminder.shown` | 展示远眺提醒。 | `causedBy`；`data.durationMs`。 |
| `distance-reminder.completed` | 远眺提醒自然完成。 | 无。 |
| `distance-reminder.skipped` | 用户跳过远眺提醒。 | `data.accumulatedScreenMs`。 |
| `distance-reminder.dismissed` | 远眺提醒提前被系统关闭。 | `data.reason: monitoring-unavailable / reminder-disabled`。 |
| `blink-reminder.shown` | 展示眨眼提醒。 | `causedBy`。 |
| `blink-reminder.completed` | 用户完成眨眼提醒。 | `data.blinkCount`。 |
| `blink-reminder.dismissed` | 眨眼提醒提前被系统关闭。 | `data.reason: sensing-or-setting-changed`。 |
| `sedentary-reminder.shown` | 展示久坐提醒。 | `causedBy`。 |
| `sedentary-reminder.acknowledged` | 用户点击久坐提醒的“知道了”。 | 无。 |
| `sedentary-reminder.dismissed` | 久坐提醒被关闭，且不是用户刚刚点击“知道了”。 | 无。 |
