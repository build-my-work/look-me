# Timeline 事件模型 V2

| 事件 | 事件类型 | 含义 |
|---|---|---|
| 眨眼 | `blink.detected` | 检测到一次完整眨眼。 |
| 坐姿开始 | `seated.started` | 坐姿区间开始；本次会话首次确认已坐下时也记录。 |
| 坐姿结束 | `seated.ended` | 坐姿区间结束；确认完整站起轨迹时携带 `reason: stand_up`，采集中断或无法确认离座方向时携带 `reason: tracking_lost`。 |
| 看屏开始 | `screen.started` | 开始有效看屏。 |
| 看屏结束 | `screen.ended` | 结束有效看屏。 |
| 打哈欠 | `yawn.detected` | 检测到一次哈欠。 |
