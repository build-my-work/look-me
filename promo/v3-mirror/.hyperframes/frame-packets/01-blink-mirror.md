# Frame packet: 01-blink-mirror

## Project inputs

- Project: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror
- Design tokens: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror/frame.md
- RULES_DIR: /Users/zhihu/.claude/hyperframes/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 1 — 你眨眼，他也眨

- scene: 安静暖沙底，看山立绘居中站定；画面上方一只抽象「你的眼睛」图形缓缓闭合再睁开，0.4 秒后看山眼睑同步闭合睁开（官网 petMirrorBlink 同款 scaleY 动画）——镜像同步重复两轮
- voiceover: ""
- duration: 9s
- transition_in: cut
- status: outline
- src: compositions/frames/01-blink-mirror.html
- type: hook
- persuasion: Show-don't-tell（镜像即证明）
- beat: 好奇 → 温柔
- blueprint: panel-edit-live-sync (Adapt)
- focal: 「你的眼睛」图形与看山眼睑的同步对
- asset_candidates: assets/kanshan-distance-break.png — 立绘（眼睑为 CSS 覆盖层）
- roles: kanshan-distance-break = cutout（居中主体，眼睑为 CSS 覆盖层）

narrativeRole: 用最安静的方式开场：不做主张，只演示一次镜像。你看不见自己的眼睛——他替你看着。
keyMessage: 你眨眼，他也眨：每一次完整眨眼，他都跟着眨一次。
字幕文案: ① 你看不见自己的眼睛 ② 他替你看着 ③ 他眨了，就说明你刚才真的眨了

Adapt：签名 live-sync couple 保留——上「你」下「他」两个表面同拍变化；无面板 UI，以图形对代替。
Scene 1 (0.0–1.4s): 暖沙底纯场；看山立绘居中 spring-pop 平滑落位（Centered, ~45%）；上方「你的眼睛」抽象弧线图形 SVG self-draw 显形（上 1/3）。
Scene 2 (1.4–4.2s): 首轮镜像：你图形闭合-睁开（scaleY 0.35→1→0.35 的 finite 拍），0.4s 后看山眼睑同款 scaleY 回应——live-sync couple（上下同拍，回应延迟即「被看见」）。
Scene 3 (4.2–6.6s): 字幕①「你看不见自己的眼睛」per-word 落；②「他替你看着」word-swap 接替。
Scene 4 (6.6–9.0s): 第二轮镜像（节奏略快）；字幕③「他眨了，就说明你刚才真的眨了」落；settle hold。
