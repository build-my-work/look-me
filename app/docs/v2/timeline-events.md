# Timeline 事件模型 V2

| 事件 | 事件类型 | 含义 |
|---|---|---|
| 眨眼 | `blink.detected` | 检测到一次完整眨眼。 |
| 站起 | `stand-up.detected` | 检测到从坐下进入站起或离座状态。 |
| 坐下 | `sit-down.detected` | 检测到进入坐下状态；本次会话首次确认已坐下时也记录。 |
| 看屏开始 | `screen.started` | 开始有效看屏。 |
| 看屏结束 | `screen.ended` | 结束有效看屏。 |
| 打哈欠 | `yawn.detected` | 检测到一次哈欠。 |
