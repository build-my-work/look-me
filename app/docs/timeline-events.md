# Timeline 事件清单

## 事件化原则

| 原则 | 说明 |
|---|---|
| 只记录事件 | Timeline 不直接存“区间”或“统计值”，只存某个时间点发生的事实、判断或动作。 |
| 基于事件分析 | 看屏时长、嘴部张开时长、坐姿/离座时长、提醒结果都从事件序列推导。 |
| 不重复记录 | 如果下一条事件已经能表达上一段状态结束，就不再额外记录一个结束事件。 |
| 互斥状态只记进入 | 姿态同一时刻只能是 `seated`、`away`、`unknown` 之一，所以只记录进入某状态的事件。 |
| 不记录内部到期点 | 提醒是否到期由事实和规则推导，不单独记录 `*.due` 事件。 |

## Fact

| 事件 | 含义 | 关键数据 / 备注 |
|---|---|---|
| `screen.started` | 有效看屏开始 | `spanId` 标识区间。 |
| `screen.ended` | 有效看屏结束 | `spanId`，`reason`。 |
| `blink.detected` | 检测到一次完整眨眼 | `closedAt`、`openedAt`、`closedDurationMs`、`peakLeftBlend`、`peakRightBlend`、`minimumEar`。 |
| `mouth.opened` | 嘴部张开 | `spanId`，`jawOpen`。 |
| `mouth.closed` | 嘴部闭合 | `spanId`，`jawOpen`，`reason`。 |
| `posture.seated.started` | 开始处于坐姿 | 姿态状态互斥；坐姿区间结束时间由下一条 `posture.*.started` 推导。 |
| `posture.away.started` | 开始处于离座 | 姿态状态互斥；离座区间结束时间由下一条 `posture.*.started` 推导。离座是人脸离开座位区域的代理，不是精确站立；离座次数由该事件计数。 |
| `posture.unknown.started` | 开始处于无法判断 | 姿态状态互斥；未知区间结束时间由下一条 `posture.*.started` 推导。 |

## Decision

| 事件 | 含义 | 关键数据 / 备注 |
|---|---|---|
| `yawn.detected` | 判断为一次哈欠 | `openedAt`、`openDurationMs`、`thresholdMs`。 |

## Action

| 事件 | 含义 | 关键数据 / 备注 |
|---|---|---|
| `yawn-response.shown` | 看山展示哈欠响应 | `response: mouth-sync`。 |
| `distance-reminder.shown` | 展示远眺提醒 | `durationMs`。 |
| `distance-reminder.completed` | 远眺提醒自然完成 | 远眺流程的正常结束。 |
| `distance-reminder.skipped` | 用户跳过远眺提醒 | `accumulatedScreenMs`。 |
| `distance-reminder.dismissed` | 远眺提醒被系统关闭 | `reason: monitoring-unavailable / reminder-disabled`；不包含自然完成或用户跳过。 |
| `blink-reminder.shown` | 展示眨眼提醒 | 当前无数据。 |
| `blink-reminder.completed` | 眨眼提醒完成 | `blinkCount`；表示提醒流程完成，不替代 `blink.detected`。 |
| `blink-reminder.dismissed` | 眨眼提醒被系统关闭 | `reason: sensing-or-setting-changed`；不包含完成。 |
| `sedentary-reminder.shown` | 展示久坐提醒 | 当前无数据。 |
| `sedentary-reminder.acknowledged` | 用户点击“知道了” | 当前无数据。 |
| `sedentary-reminder.dismissed` | 久坐提醒被系统关闭 | 不包含用户点击“知道了”。 |

## `screen.ended.reason`

| reason | 含义 |
|---|---|
| `monitoring-stopped` | 监测停止。 |
| `distance-break` | 进入远眺休息。 |
| `sensing-unavailable` | 本地检测不可用。 |
| `face-lost` | 未检测到可信人脸。 |
| `observation-gap` | 连续观察间隔超出允许范围。 |
| `not-observing` | 兜底原因。 |

## `mouth.closed.reason`

| reason | 含义 |
|---|---|
| `detected` | 检测到嘴部闭合。 |
| `face-lost` | 张嘴期间人脸丢失。 |
| `sensing-unavailable` | 张嘴期间本地检测不可用。 |
| `monitoring-stopped` | 张嘴期间监测停止。 |
