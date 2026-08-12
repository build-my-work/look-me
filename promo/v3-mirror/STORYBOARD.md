---
format: 1920x1080
duration: 56s
message: "他真的看得见你——你眨眼他也眨，守口如瓶"
arc: Future Pacing（陪伴的五个瞬间 → 他住进你的桌面）
audience: 长时间盯屏的开发者与办公人群（猫咪伙伴 IP 受众）
mode: autonomous
music: none
---

## Video direction

- **palette**（frame.md 为唯一色彩真相）：本版全程暖场——cream `#eef5f3` 与 tile `#EFE9DE` 暖沙纸面为主 canvas（陪伴段全用暖沙），ink `#1e3f45` 文字；coral `#9b563f` 唯一强调且更克制（✗ 与个别关键字）；tile-strong `#b69a63` mono 数字。类型按角色引用：display 承载情感字幕，mono-label 承载「你 / 他」对照标签。
- **motion grammar**：全部 power3 长尾平滑，无 bounce。镜像动作（眨眼镜像/哈欠镜像）是本版的运动母题——上下两表面同拍变化，延迟 0.3–0.5s 的「回应感」优先于严格同步。无 VO：以字幕分拍为 cue 锚，reveal 分布于后 ~50%。sprite stepped 离散换帧，finite。
- **rhythm / held 分配**：全片节奏整体放缓；F5 隐私帧是最低动效帧（titlecard 的静即 payload）；F6 收尾最后一眨眼是全片最后一个动作。
- **negative list**：无 slideshow、无 screensaver、无 lazy breathing、无后半程慢推拉；无浏览器 chrome/光标；「你」的图形必须是抽象示意（弧线眼睛/嘴部图形），不得出现真人或写实人脸；不出现疗效或医疗表述。

## Frame 1 — 你眨眼，他也眨

- scene: 安静暖沙底，猫咪立绘居中站定；画面上方一只抽象「你的眼睛」图形缓缓闭合再睁开，0.4 秒后猫咪眼睑同步闭合睁开（官网 petMirrorBlink 同款 scaleY 动画）——镜像同步重复两轮
- voiceover: ""
- duration: 9s
- transition_in: cut
- status: animated
- src: compositions/frames/01-blink-mirror.html
- type: hook
- persuasion: Show-don't-tell（镜像即证明）
- beat: 好奇 → 温柔
- blueprint: panel-edit-live-sync (Adapt)
- focal: 「你的眼睛」图形与猫咪眼睑的同步对
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘（眼睑为 CSS 覆盖层）
- roles: heterochromia-cat-idle = cutout（居中主体，眼睑为 CSS 覆盖层）

narrativeRole: 用最安静的方式开场：不做主张，只演示一次镜像。你看不见自己的眼睛——他替你看着。
keyMessage: 你眨眼，他也眨：每一次完整眨眼，他都跟着眨一次。
字幕文案: ① 你看不见自己的眼睛 ② 他替你看着 ③ 他眨了，就说明你刚才真的眨了

Adapt：签名 live-sync couple 保留——上「你」下「他」两个表面同拍变化；无面板 UI，以图形对代替。
Scene 1 (0.0–1.4s): 暖沙底纯场；猫咪立绘居中 spring-pop 平滑落位（Centered, ~45%）；上方「你的眼睛」抽象弧线图形 SVG self-draw 显形（上 1/3）。
Scene 2 (1.4–4.2s): 首轮镜像：你图形闭合-睁开（scaleY 0.35→1→0.35 的 finite 拍），0.4s 后猫咪眼睑同款 scaleY 回应——live-sync couple（上下同拍，回应延迟即「被看见」）。
Scene 3 (4.2–6.6s): 字幕①「你看不见自己的眼睛」per-word 落；②「他替你看着」word-swap 接替。
Scene 4 (6.6–9.0s): 第二轮镜像（节奏略快）；字幕③「他眨了，就说明你刚才真的眨了」落；settle hold。

## Frame 2 — 你打哈欠，他先困给你看

- scene: 同一舞台，节奏放缓：上方「你」图形打出一个大哈欠（嘴部张大保持约 1 秒），猫咪全身哈欠精灵图同步切换（闭口 → 张嘴 → 恢复）
- voiceover: ""
- duration: 8s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-yawn-mirror.html
- type: benefit_highlight
- persuasion: Delight by association（小彩蛋的拟真）
- beat: 会心一笑
- blueprint: panel-edit-live-sync (Reproduce)
- focal: 猫咪张大的嘴（yawn-mouth 贴片）
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘; assets/heterochromia-cat-yawn-sprite.png — 哈欠全身精灵图
- roles: heterochromia-cat-idle = cutout · heterochromia-cat-yawn-sprite = full-body pose sequence（与基础立绘使用同一 512×640 画布）

narrativeRole: 第二个镜像瞬间——真哈欠（张嘴保持约 0.9 秒）不是说话张嘴；你困的时候，他先困给你看。
keyMessage: 你打哈欠，他也跟着张嘴打一个。
字幕文案: ① 你打了个哈欠 ② 他也跟着张嘴打一个 ③ 你困的时候，他先困给你看

Reproduce：live-sync couple 完整呈现——你的哈欠是「编辑」，猫咪的哈欠是「表面」。
Scene 1 (0.0–1.6s): 字幕①「你打了个哈欠」落（上 1/3）；你图形的嘴部弧线张大（scale .08→1，官网哈欠节奏，保持 ~1s）。
Scene 2 (1.6–4.0s): 猫咪全身哈欠精灵图按 3 帧切换（闭口 → 张嘴 → 恢复）——同拍回应，couple 成立。
Scene 3 (4.0–6.0s): 双双回正（嘴合、眼开）；字幕②「他也跟着张嘴打一个」word-swap。
Scene 4 (6.0–8.0s): 字幕③「你困的时候，他先困给你看」落；hold 静读。

## Frame 3 — 25 秒没眨眼，他掉着眼泪来

- scene: 注意力轨道剧场（官网 rail-demo 同款）：猫咪从右上角沿虚线轨道缓缓降落、泪流挂脸（tear 贴片 + 泪滴反复坠落）；字幕「25 秒不眨眼——」；眨眼瞬间（画面闪一次眼睑），他立刻擦泪、沿轨道回升，字幕「你一眨眼，他立刻擦泪回升」
- voiceover: ""
- duration: 11s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-rail-tears.html
- type: pain_point
- persuasion: Pain validation + 即时回应的安心
- beat: 愧疚 → 被在乎
- blueprint: camera-journey (Adapt)
- focal: 降落中的猫咪 + 泪流
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘; assets/cat-tear.png — 泪流与泪滴
- roles: heterochromia-cat-idle = cutout（轨道主体）· cat-tear = supporting（泪流 + 泪滴）

narrativeRole: 情感最高点——提醒不是弹窗，是一只为你的眼睛着急的小狐狸。降落（担心）与回升（安心）是一次完整的情绪弧。
keyMessage: 25 秒不眨眼他掉泪提醒，你一眨眼他擦泪回升。
字幕文案: ① 25 秒不眨眼，他从屏幕角落缓缓降落 ② 掉着眼泪提醒你 ③ 你一眨眼——他立刻擦泪回升，然后安静 25 秒

Adapt：sub-shape B 无光标飞行——相机跟随猫咪沿轨道的两段旅程（降→升），旅程本身就是叙事。
Scene 1 (0.0–1.6s): 舞台建立：右上角虚线轨道 SVG self-draw；猫咪挂泪流出现在顶端（`spring-pop-entrance` 平滑）。
Scene 2 (1.6–5.0s): 相机缓慢下移跟随（`multi-phase-camera` drift）猫咪沿轨道降落；泪滴 finite 两坠（`dynamic-content-sequencing`）；字幕①「25 秒不眨眼，他从屏幕角落缓缓降落」per-word 随降随落。
Scene 3 (5.0–6.8s): 字幕②「掉着眼泪提醒你」word-swap；降落到位定格半拍（情绪最低点）。
Scene 4 (6.8–9.2s): 回应拍：画面轻闪一拍 + 你图形眼睑一闭一开；猫咪擦泪（tear 淡出）；字幕③前半「你一眨眼——」落。
Scene 5 (9.2–11.0s): 猫咪沿轨道回升（相机 drift 回上）；字幕③后半「他立刻擦泪回升，然后安静 25 秒」落；settle hold。

## Frame 4 — 没人理他的时候，他也会自己玩

- scene: 三连小剧场快切：暖沙 tile 里拍手 8 帧连播 → 坐下 8 帧 → 转圈 11 帧（官网 sprite steps() 同款技术），节奏轻快，下方标签逐条点亮
- voiceover: ""
- duration: 10s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-idle-theater.html
- type: benefit_highlight
- persuasion: 情感陪伴的价值（活的桌面宠物）
- beat: 轻快 → 喜爱
- blueprint: grid-card-assemble (Reproduce)
- focal: assets/heterochromia-cat-clap-sprite.png（第一块 tile）
- asset_candidates: assets/heterochromia-cat-clap-sprite.png — 拍手 8 帧; assets/heterochromia-cat-sit-sprite.png — 坐下 8 帧; assets/heterochromia-cat-spin-sprite.png — 转圈 11 帧
- roles: clap / sit / spin sprite = 三块 tile 主体；暖沙底 = background

narrativeRole: 释放上幕情绪，展示「提醒之外，他真的是活的」——待机行为让陪伴成立。
keyMessage: 工作间隙抬头一看，他可能正在自己玩。
字幕文案: ① 提醒之外，他真的是活的 ② 拍手 · 坐下 · 转圈——没人理他的时候，他也会自己玩

Reproduce：staggered cascade 组装签名完整保留；每块 tile 组装后 sprite 播一轮。
Scene 1 (0.0–1.4s): 字幕①「提醒之外，他真的是活的」per-word 落（上 1/3）；三块空 tile 框 stagger 浮现（triptych）。
Scene 2 (1.4–4.0s): tile1 组装（`center-outward-expansion` 一格）→ 拍手 sprite 8 帧一轮；标签「拍手 · 一次 6 连拍」mono 落。
Scene 3 (4.0–6.6s): tile2 坐下 sprite 一轮 + 标签「坐下 · 再站起来」。
Scene 4 (6.6–8.8s): tile3 转圈 sprite 一轮 + 标签「原地转圈圈」。
Scene 5 (8.8–10.0s): 字幕②「拍手 · 坐下 · 转圈——没人理他的时候，他也会自己玩」落；hold。

## Frame 5 — 他看得见你，但守口如瓶

- scene: 舞台安静收拢：中央一张玻璃卡，两列逐条落定——「他在本机看的」（你的脸在不在画面里 / 眼睛有没有闭上 / 你有没有起身）与「他永远不会」（保存任何一帧画面 / 把画面传出你的电脑 / 偷看你的屏幕内容）；猫咪立绘守在卡旁
- voiceover: ""
- duration: 10s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/05-sealed-lips.html
- type: social_proof
- persuasion: Risk reversal（隐私承诺逐字原文）
- beat: 信任 → 安心
- blueprint: titlecard-reveal (Adapt)
- focal: 中央玻璃卡（两列隐私对照）
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘
- roles: heterochromia-cat-idle = supporting（卡旁守望）

narrativeRole: 把「看得见你」的伏笔收束成隐私承诺——看得见，但守口如瓶；陪伴不以让渡隐私为代价。
keyMessage: 检测全在本机，不上传、不保存。
字幕文案: ① 他看得见你，但守口如瓶 ② 不上传 · 不保存 · 没有云端

Adapt：titlecard 的「一个克制动效 + 静」即本帧全部策略——wipe 揭示后即静读，最低动效帧。
Scene 1 (0.0–1.6s): 中央玻璃卡 wipe-away-to-reveal（单一克制 move）；标题「他看得见你，但守口如瓶」随卡落位（Centered, ~55% 画幅）。
Scene 2 (1.6–5.6s): 两列条目逐条落定：左「他在本机看的」三条 ✓（0.6s/条），右「他永远不会」三条 ✗（coral），交替 stagger。
Scene 3 (5.6–7.6s): 猫咪立绘自卡侧小步入守望位（一次小位移，无其它运动）。
Scene 4 (7.6–10.0s): 底行「不上传 · 不保存 · 没有云端」三拍落；still hold——静是 payload。

## Frame 6 — 让他住进你的桌面

- scene: 雾白底：猫咪立绘落位并拍一次手（sprite 彩蛋），字标「Look Me · 看看我」+ 副题「猫咪伙伴住进你的桌面」，三平台按钮依次亮起；最后一拍：猫咪眼睑眨一下，全片终
- voiceover: ""
- duration: 8s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/06-cta.html
- type: cta
- persuasion: 陪伴具象化 + 下载即用
- beat: 不舍 → 行动
- blueprint: logo-assemble-lockup (Reproduce)
- focal: 「Look Me · 看看我」字标 + 猫咪 lockup
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘; assets/heterochromia-cat-clap-sprite.png — 拍手彩蛋
- roles: heterochromia-cat-idle = cutout · clap-sprite = 彩蛋叠层

narrativeRole: 情感向收尾——不是「买产品」，是「带他回家」；最后一眨眼呼应 Frame 1 的镜像。
keyMessage: 下载即用，全平台；从今天起，有人在意你的眼睛。
字幕文案: ① Look Me · 看看我 ② 猫咪伙伴住进你的桌面：提醒眨眼、远眺、起身 ③ macOS · Windows · Linux

Reproduce：lockup 组装 + 卫星元素清除的收尾形态。
Scene 1 (0.0–1.2s): cream 雾白底；猫咪立绘 spring-pop 落位中央偏左（asymmetric 60/40 留字标位）。
Scene 2 (1.2–2.8s): 字标「Look Me · 看看我」per-word 组装（display ramp）；猫咪拍手 sprite 一轮彩蛋。
Scene 3 (2.8–4.6s): 副题「猫咪伙伴住进你的桌面：提醒眨眼、远眺、起身」lead 滑入；三平台按钮依次生长点亮（`press-release-spring` 平滑）。
Scene 4 (4.6–6.4s): settle hold——完整 lockup 静读。
Scene 5 (6.4–8.0s): 最后一拍：猫咪眼睑眨一下（呼应 F1），定格至终帧。
