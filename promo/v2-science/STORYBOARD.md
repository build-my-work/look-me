---
format: 1920x1080
duration: 55s
message: "泪膜只能撑 10 秒——盯屏时你已经 30–60 秒没眨眼了"
arc: PAS（数字钩子 → 机制失灵 → 看山出手）
audience: 长时间盯屏的开发者与办公人群（知乎刘看山 IP 受众）
mode: autonomous
music: none
---

## Video direction

- **palette**（frame.md 为唯一色彩真相）：本版走「深→浅」弧线——F1/F3 用 navy `#181615` / ink `#1e3f45` 深底承载数据的冷，F4 起回暖至 cream `#eef5f3` 纸面；coral `#9b563f` 唯一强调，只给破裂线、恶化数字与 ✗；tile-strong `#b69a63` 只用于 mono 数字；tile `#EFE9DE` 用于 F4 后的暖场。类型按角色引用：number-hero 承载数字冲击，mono-label 承载单位与时间标签。
- **motion grammar**：全部 power3 长尾平滑。无 VO：以每帧「字幕文案」分拍为 cue 锚，reveal 分布于镜头后 ~50%，严禁 t=0 倾倒。数字运动（count-up/count-down/refill）一律 finite，seek-safe；sprite 帧动画 stepped 离散换帧。
- **rhythm / held 分配**：F1 结尾大数字定格 hold（数据的静即张力）；F6 收尾 settle hold。F3 是全片情绪最暗帧，运动最密。
- **negative list**：无 slideshow、无 screensaver、无 lazy breathing、无后半程慢推拉；无浏览器 chrome/光标；不出现疗效或医疗表述；数字呈现必须与官网口径一致（10 秒 / 4 秒 / 30–60 秒 / 25 秒），不得夸大改写。

## Frame 1 — 10 秒

- scene: 墨青深底冷开场，一个数字 count-up 从 0 冲到 10 并定格放大——「10 秒 · 一层泪膜保护眼睛的极限时间」；无产品、无 Logo，只有数字与事实
- voiceover: ""
- duration: 7s
- transition_in: cut
- status: animated
- src: compositions/frames/01-ten-seconds.html
- type: hook
- persuasion: Statistical shock
- beat: 震动 → 好奇
- blueprint: dataviz-countup (Reproduce)
- focal: 中央大数字 10（number-hero）
- roles: （纯排版帧，无图片资产）

narrativeRole: 冷数据开场。一个数字建立全片张力——你眼睛表面的保护膜，每 10 秒就要重刷一次。
keyMessage: 泪膜只能撑 10 秒。
字幕文案: ① 10 秒 ② 一层泪膜保护眼睛的极限时间

Reproduce：cold-open counter 的标准形。
Scene 1 (0.0–0.8s): navy 深底纯场；mono 小单位「秒」在中央以 hairline 灰度先坐落（占位锚点，Centered）。
Scene 2 (0.8–3.6s): number-hero 大数字 0→10 value-scaled counter（`counting-dynamic-scale`），字号随值爬升放大；期间无任何其他元素。
Scene 3 (3.6–5.4s): 副题「一层泪膜保护眼睛的极限时间」lead 行自下方滑入（slide-up）；数字定格后轻微 lean-in 收势。
Scene 4 (5.4–7.0s): still hold——大数字与副题静读，至多 subtle jitter；这是全片第一记静。

## Frame 2 — 4 秒一次，刚好续上

- scene: 健康眨眼节律可视化：一条时间轴上，眨眼波形每 4 秒一次规律跳动，每次跳动脉膜条重新铺满（进度条 refill）；「每 4 秒一次——刚好赶在它破裂前续上」
- voiceover: ""
- duration: 8s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-four-seconds.html
- type: pain_point
- persuasion: Mechanism explanation（精密的天然保湿机制）
- beat: 理解 → 认同
- blueprint: kinetic-type-beats (Adapt)
- focal: 眨眼波形 + 泪膜 refill 条（中部数据带）
- roles: （纯排版 + 数据可视化帧，无图片资产）

narrativeRole: 建立「正常」基线——眨眼是精密的天然保湿机制，正常人每 4 秒一次，刚好续上。为下一幕的失灵做铺垫。
keyMessage: 每 4 秒眨一次，是一套精密的天然保湿机制。
字幕文案: ① 每 4 秒一次 ② 每眨一次，泪膜重新铺满眼球表面 ③ 刚好赶在它破裂前续上

Adapt：词拍接力的骨架，但每拍与一次波形跳动对齐（词拍=波拍）。
Scene 1 (0.0–1.6s): cream 纸面转场；水平时间轴 hairline 自左向右 SVG self-draw（`svg-path-draw`）；mono 刻度「4s · 8s · 12s」stagger 落位。
Scene 2 (1.6–4.0s): 字幕①「每 4 秒一次」per-word 落（上 1/3）；第一记眨眼波峰 pop（discrete beat），其下泪膜条 refill 满（`stat-bars-and-fills`）；随后两记波峰 stagger 重复同一拍（波形=节拍器）。
Scene 3 (4.0–6.0s): 字幕②「每眨一次，泪膜重新铺满眼球表面」word-swap 接替；第四记波峰 + refill 同拍呼应。
Scene 4 (6.0–8.0s): 字幕③「刚好赶在它破裂前续上」落；波形与 refill 进入稳定交替，hold 静读。

## Frame 3 — 盯屏时，机制失灵

- scene: 画面切换盯屏语境（代码屏光），眨眼波形逐渐拉平停摆，泪膜进度条跌破破裂线后变陶土红闪烁；三个数字逐个砸出：30–60 秒（可以一直不眨）/ 干涩 / 视疲劳
- voiceover: ""
- duration: 10s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/03-staring.html
- type: pain_point
- persuasion: Pain agitation
- beat: 焦虑 → 紧张
- blueprint: overwhelm-surround (Adapt)
- focal: 拉平停摆的眨眼波形 + coral 破裂线
- asset_candidates: assets/preview-workspace.webp — 盯屏语境底图（暗化处理）
- roles: preview-workspace = background（dim ~50% 暗化为代码屏光）

narrativeRole: 把问题推到顶点——聚精会神时人会 30–60 秒忘记眨眼，泪膜破了，角膜开始「裸奔」。
keyMessage: 盯屏入神时，你可以 30–60 秒不眨眼。
字幕文案: ① 盯屏入神时 ② 30–60 秒，忘记眨眼 ③ 泪膜破了——干涩、异物感、视疲劳随之而来

Adapt：签名「中心 morph」保留——中央「屏幕卡」淡出内容重塑为一只干涩的眼睛意象（主语从物换成人）。
Scene 1 (0.0–2.0s): zoom-through 落入暗场：preview-workspace dim ~50% 成代码屏光；字幕①「盯屏入神时」短拍落（上 1/3）；上一帧的波形延续入画但逐渐拉平（速度递减至停摆）。
Scene 2 (2.0–5.0s): 泪膜条跌破破裂线——线转 coral 并有限闪烁（finite 3 拍）；「30–60 秒」大数字 hard-cut 砸出（`discrete-text-sequence`），字号大于上一帧的「10 秒」形成升级。
Scene 3 (5.0–7.5s): 签名 morph：中央屏幕卡 content 淡出、容器 reshape 为一只干涩眼睛的意象图形（SVG self-draw），主语换成「人」。
Scene 4 (7.5–10.0s): 「干涩 · 异物感 · 视疲劳」三词 beat-slam 逐拍围落（`kinetic-beat-slam`，长尾 settle 不弹跳）；settle hold，画面最暗处留给下一帧的转折。

## Frame 4 — 25 秒，看山出手

- scene: 画面骤静：看山挂着眼泪沿注意力轨道从右上角缓缓降落到屏幕中央，举牌「陪我慢慢眨 2 下」；观众眨眼（眨眼波形恢复跳动），他立刻擦泪回升——字幕「赶在伤害累积之前」
- voiceover: ""
- duration: 10s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/04-kanshan-steps.html
- type: product_intro
- persuasion: Show-don't-tell proof（真提醒，非计时器）
- beat: 被看见 → 安心
- blueprint: device-surface-showcase (Adapt)
- focal: assets/kanshan-distance-break.png
- asset_candidates: assets/kanshan-distance-break.png — 立绘; assets/kanshan-tear.png — 泪流泪滴贴片
- roles: kanshan-distance-break = cutout（降落主体）· kanshan-tear = supporting（泪流/泪滴）

narrativeRole: 产品第一次出手——25 秒不是弹窗，是他来了。眨 2 下 = 重新镀上保护膜；眨满两次他才安心走开。
keyMessage: 25 秒没眨眼，他带着眼泪来陪你眨 2 下。
字幕文案: ① 25 秒 · 看山出手的时机 ② 眨一次眼，就是重新镀上一层保护膜 ③ 眨满 2 下，他才安心走开

Adapt：不适用设备框——以「注意力轨道」为 held surface（右上→中央的虚线轨道即舞台），保留屏幕循环的 stepwise 节奏：降落→举牌→回应→回升。
Scene 1 (0.0–1.6s): 画面骤静回暖（tile 暖沙底自边缘渗入）；右上角虚线轨道 SVG self-draw；看山挂泪流出现于轨道顶端（`spring-pop-entrance` 平滑落位）。
Scene 2 (1.6–4.6s): 看山沿轨道缓缓降落（多段 translateY 长尾，泪滴 finite 两坠）；字幕①「25 秒 · 看山出手的时机」per-word 落。
Scene 3 (4.6–6.8s): 小牌「陪我慢慢眨 2 下」平滑举出；字幕②「眨一次眼，就是重新镀上一层保护膜」word-swap 接替。
Scene 4 (6.8–8.6s): 回应拍：底部波形恢复一记跳动，看山擦泪（tear 贴片淡出）沿轨道回升。
Scene 5 (8.6–10.0s): 字幕③「眨满 2 下，他才安心走开」落；settle hold。

## Frame 5 — 看得见你，守口如瓶

- scene: 机制与信任：左列「他在本机看的」三条打勾（脸在不在画面 / 眼睛有没有闭上 / 有没有起身），右列「他永远不会」三条画叉（保存任何一帧画面 / 把画面传出你的电脑 / 偷看你的屏幕内容）；底部一行「检测全在本机完成」
- voiceover: ""
- duration: 10s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-privacy.html
- type: social_proof
- persuasion: Risk reversal（隐私承诺）
- beat: 信任 → 安心
- blueprint: comparison-split (Reproduce)
- focal: 两列隐私对照卡
- asset_candidates: assets/kanshan-distance-break.png — 看山立绘（守在两列之间）
- roles: kanshan-distance-break = supporting（两卡之间守望）

narrativeRole: 回答「摄像头检测」的天然疑虑——用官网逐字原文的隐私对照，把不安转为信任。
keyMessage: 检测全在本机：不上传、不保存。
字幕文案: ① 他看得见你，但守口如瓶 ② 所有检测都在本机完成——不上传、不保存

Reproduce：split-tilt 双卡对进签名完整保留。
Scene 1 (0.0–1.4s): cream 纸面；标题「他看得见你，但守口如瓶」两行 relay 滑入（上 1/3）。
Scene 2 (1.4–2.6s): 签名 split-tilt（`split-tilt-cards`）：左卡「他在本机看的」自左翼、右卡「他永远不会」自右翼 mirrored rotateY 对进（split-screen 对比，等权重）。
Scene 3 (2.6–6.6s): 左卡三条逐条 reveal 打 ✓（0.6s/条，`dynamic-content-sequencing`）；右卡三条逐条画 ✗（coral）；两列节奏交替形成对话感。
Scene 4 (6.6–8.6s): 内外边 pill 徽记平滑点出；看山立绘自两卡间隙步入守望位（小位移，不抢戏）。
Scene 5 (8.6–10.0s): 底行「所有检测都在本机完成——不上传、不保存」落；hold。

## Frame 6 — Look Me

- scene: 墨青底翻雾白：巨大「Look Me · 看看我」字标落位，看山立绘拍手 sprite 彩蛋，副题「泪膜只能撑 10 秒——有人替你记着」+ 三平台下载按钮
- voiceover: ""
- duration: 10s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/06-cta.html
- type: cta
- persuasion: Brand recall + 下载即用
- beat: 释然 → 行动
- blueprint: logo-assemble-lockup (Adapt)
- focal: 「Look Me · 看看我」字标
- asset_candidates: assets/kanshan-distance-break.png — 立绘; assets/kanshan-clap-sprite.png — 拍手彩蛋
- roles: kanshan-distance-break = cutout（字标旁）· clap-sprite = 彩蛋叠层

narrativeRole: 数字开场的对称收尾：把「10 秒」的知识留给观众，把「有人替你记着」的安心换成行动。
keyMessage: 别等眼睛干掉——下载即用，全平台。
字幕文案: ① Look Me · 看看我 ② 别等眼睛干掉 ③ macOS · Windows · Linux

Adapt：保留 CTA push-through 签名——推向字标负空间的快推 + motion-blur streak，落到大号 CTA 行。
Scene 1 (0.0–1.6s): navy 深底 within-frame wipe 翻至 cream；「Look Me」字标 per-word 组装落位（Centered）。
Scene 2 (1.6–3.2s): 「看看我」append 落位；✱ coral spike 点睛平滑点出；看山立绘于字标右侧 spring-pop 落位 + 拍手 sprite 一轮。
Scene 3 (3.2–5.2s): 签名 CTA push-through（`multi-phase-camera` + `motion-blur-streak`）：快推向字标负空间，穿过后落到大号「别等眼睛干掉」impact line。
Scene 4 (5.2–7.2s): 三平台按钮（macOS / Windows / Linux）依次生长点亮（`press-release-spring` 平滑触感）。
Scene 5 (7.2–10.0s): settle hold——完整 lockup 静读至终帧（titlecard 式的静收）。
