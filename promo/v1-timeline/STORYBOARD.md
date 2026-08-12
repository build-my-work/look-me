---
format: 1920x1080
duration: 56s
message: "猫咪伙伴住进你的桌面，在泪膜告急之前把你拉回来"
arc: Timeline day journey（09:00 → 10:24 → 14:07 → 18:30 → 现在）
audience: 长时间盯屏的开发者与办公人群（猫咪伙伴 IP 受众）
mode: autonomous
music: none
---

## Video direction

- **palette**（frame.md 为唯一色彩真相）：cream `#eef5f3` 纸面为 canvas；ink `#1e3f45` 正文与标题；coral `#9b563f` 是唯一强调色，只给关键字、破裂线与 ✗（稀缺 voltage）；tile `#EFE9DE` 暖沙只用于陪伴/小剧场段落；tile-strong `#b69a63` 只用于 mono 数字与时间标签；navy `#181615` 只用于暗场过渡（F2 中段）。类型按角色引用：display/number-hero 用 display ramp，mono-label/kicker 用 SF Mono。
- **motion grammar**：全部 power3 长尾平滑，无 bounce 无 overshoot。reveal 模型：本片无 VO，以每帧「字幕文案」的分拍为 cue 锚——每条字幕/卡片/数字在其 cue 时点首次出现，reveal 分布在整个镜头后 ~50%，严禁 t=0 倾倒全部内容。sprite 帧动画（拍手/坐下/转圈）用 GSAP stepped 离散换帧，一轮 finite 播完不 repeat；官网 CSS steps() 仅作视觉参考，不得用 CSS animation 驱动。
- **rhythm / held 分配**：F4 远眺之窗是全片 breather（reveal 少、以 conic 环倒计时为唯一持续运动）；F6 收尾 settle hold。其余帧按 cue 正常 reveal。
- **negative list**：无 slideshow（前 25% 倾倒后冻结）、无 screensaver（元素各自漂浮）、无 lazy breathing、无后半程慢推拉；不出现浏览器 chrome/滚动条/真实光标；字幕排布于上 ~83% 画幅（底部 17% caption keep-out）；不出现任何疗效/医疗表述。

## Frame 1 — 09:00 开工·没人在意你的眼睛

- scene: 清晨桌面实景（preview-workspace），猫咪立绘安静站在右下角；官网签名 Timeline 脊柱线从左缘生长，09:00 圆形节点亮起；字幕逐句落下
- voiceover: ""
- duration: 9s
- transition_in: cut
- status: animated
- src: compositions/frames/01-morning.html
- type: hook
- persuasion: Pain validation（屏幕知道你在看它，但没人在意你的眼睛）
- beat: 共鸣 → 好奇
- blueprint: kinetic-type-beats (Adapt)
- focal: assets/heterochromia-cat-idle.png
- asset_candidates: assets/preview-workspace.webp — 桌面工作区实景底图; assets/heterochromia-cat-idle.png — 猫咪站姿立绘
- roles: preview-workspace = background（dim ~30% + 暖色 grade）· heterochromia-cat-idle = cutout（右下舞台位）· 脊柱线与 09:00 节点 = supporting

narrativeRole: 用官网的开场判断开场——先说中盯屏者的处境，猫咪以「在场但不打扰」的姿态亮相，Timeline 脊柱点明全片结构。
keyMessage: 盯屏的一天开始了，只有猫咪在意你的眼睛。
字幕文案（分 3 拍落下）: ① 屏幕知道你在看它 ② 但没人在意你的眼睛 ③ 直到现在

Adapt：保留「词拍接力」骨架，但入场只有桌面与脊柱——三条字幕在各自 cue 上 per-word 落下替换，签名 word-swap 保留。
Scene 1 (0.0–1.6s): 桌面底图渐显（dim ~30%），Timeline 脊柱沿左侧 1/3 处自上而下 SVG self-draw（`svg-path-draw`），09:00 玻璃节点淡入；猫咪立绘右下 spring-pop 平滑落位（`spring-pop-entrance`，长尾 settle）。Asymmetric 70/30，3 层景深（底图 / 脊柱 / 立绘+字幕区）。
Scene 2 (1.6–4.0s): 字幕①「屏幕知道你在看它」上 1/3 处 per-word staggered reveal（`dynamic-content-sequencing`）。
Scene 3 (4.0–6.4s): 字幕② 在同一位置 hard-cut word-swap 接替（`discrete-text-sequence`），「没人在意」以 keyword glow 点亮 coral（`asr-keyword-glow`）。
Scene 4 (6.4–9.0s): 字幕③「直到现在」短拍落下；猫咪眼睑眨一次（finite scaleY）；settle hold，至多 subtle jitter。

## Frame 2 — 10:24 守护泪膜

- scene: 统计胶囊卡从猫咪身旁浮起：绿点脉冲 + 「近 1 分钟眨眼」数字 count-up 到 14 次/分钟；随后场景一暗，猫咪挂着眼泪沿注意力轨道缓缓降落——字幕「25 秒没眨眼，他就来了」
- voiceover: ""
- duration: 10s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-tearfilm.html
- type: pain_point
- persuasion: Statistical proof + Show-don't-tell
- beat: 紧张 → 被照顾的安心
- blueprint: dataviz-countup (Adapt)
- focal: 玻璃胶囊统计卡（count-up 主体）
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘; assets/cat-tear.png — 泪流与泪滴贴片; assets/preview-workspace.webp — 桌面底图
- roles: heterochromia-cat-idle = cutout（降落主体）· cat-tear = supporting（泪流/泪滴贴片）· preview-workspace = background（暗化转场）

narrativeRole: 把「守护泪膜」翻译成可见剧场：先是真实统计（count-up），再是 25 秒不眨眼时猫咪的掉泪降落——提醒不是弹窗，是他来了。
keyMessage: 25 秒没眨眼，猫咪带着眼泪来陪你眨 2 下。
字幕文案: ① 近 1 分钟眨眼 14 次（count-up）② 盯屏超过 25 秒没眨眼——泪膜已经破了两次 ③ 陪我慢慢眨 2 下

Adapt：保留签名 push-through——从统计卡直接推穿进入暗场问题；泪膜条 bars fill 承担「破了两次」。
Scene 1 (0.0–1.2s): 玻璃胶囊卡自猫咪身旁浮起居中偏左（Centered, ~40% 画幅），live 绿点 pulse（`svg-icon-enrichment`，finite）。
Scene 2 (1.2–3.6s): 「近 1 分钟眨眼」value-scaled counter 0→14 count-up（`counting-dynamic-scale`）；count 落定后副行「有效看屏 12:41 · 坐姿 26 分钟」mono 数字落位。
Scene 3 (3.6–6.0s): push-through 签名（`multi-phase-camera` steady-push + `motion-blur-streak`）推穿卡片进入 navy 暗场；泪膜 refill 条两次跌破破裂线转 coral（`stat-bars-and-fills`）；字幕② word-swap 落。
Scene 4 (6.0–10.0s): 猫咪挂泪自右上沿虚线轨道缓缓降落（多段 translateY，泪滴 finite 两坠）；举牌「陪我慢慢眨 2 下」平滑落位；settle hold + subtle jitter。

## Frame 3 — 14:07 他真的是活的

- scene: 暖沙色小剧场，三块圆角 tile 依次点亮：拍手 sprite 8 帧连播、坐下 sprite、转圈 sprite；每块 tile 下方官网同款标签（拍手 · 一次 6 连拍 / 坐下 · 再站起来 / 原地转圈圈）
- voiceover: ""
- duration: 10s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/03-theater.html
- type: benefit_highlight
- persuasion: Delight by association（情感转移）
- beat: 惊喜 → 喜爱
- blueprint: grid-card-assemble (Adapt)
- focal: assets/heterochromia-cat-clap-sprite.png（第一块 tile）
- asset_candidates: assets/heterochromia-cat-clap-sprite.png — 拍手 8 帧精灵图; assets/heterochromia-cat-sit-sprite.png — 坐下 8 帧; assets/heterochromia-cat-spin-sprite.png — 转圈 11 帧
- roles: clap-sprite / sit-sprite / spin-sprite = 三块 tile 主体（cutout 级权重）；暖沙 tile 底 = background

narrativeRole: 证明「提醒之外，他真的是活的」——sprite 帧动画官网同款技术直接复用，没人理他的时候他也在自己玩。
keyMessage: 他不只是提醒器，是桌面上的活物。
字幕文案: ① 提醒之外，他真的是活的 ② 没人理他的时候，他也会自己玩

Adapt：保留 staggered cascade 组装成网格的签名；每块 tile 组装后 sprite 播一轮（stepped 离散换帧，finite）。
Scene 1 (0.0–1.4s): 暖沙底（tile 色场）上字幕①「提醒之外，他真的是活的」上 1/3 per-word reveal；三块空 hairline tile 框 stagger 浮现。
Scene 2 (1.4–4.2s): tile1 自中心微弹组装（`center-outward-expansion` 之一格）→ 拍手 sprite 8 帧一轮连播；标签「拍手 · 一次 6 连拍」mono 落位。
Scene 3 (4.2–6.8s): tile2 坐下 sprite 一轮 + 标签「坐下 · 再站起来」。
Scene 4 (6.8–9.0s): tile3 转圈 sprite 一轮（11 帧）+ 标签「原地转圈圈」。
Scene 5 (9.0–10.0s): 字幕②「没人理他的时候，他也会自己玩」落；triptych hold。

## Frame 4 — 20-20-20 远眺之窗

- scene: horizon-break 远眺图全幅展开（从桌面暗场推开一扇窗），玻璃拟态提示卡浮于其上：conic-gradient 倒计时环从 20s 走到 0，字幕「满 20 分钟，他为你展开一扇 20 秒的远眺小窗」
- voiceover: ""
- duration: 9s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/04-horizon.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: 舒缓 → 释然
- blueprint: titlecard-reveal (Adapt)
- focal: assets/horizon-break.webp
- asset_candidates: assets/horizon-break.webp — 20-20-20 远眺场景全幅
- roles: horizon-break = background（全幅 hero）· 倒计时提示卡 = supporting focal

narrativeRole: 全片 breather——用一扇真的「窗」呈现远眺提醒的温柔；20-20-20 以倒计时环可视化，reveal 克制。
keyMessage: 每 20 分钟，望向 6 米外 20 秒——节奏猫咪替你记着。
字幕文案: ① 20-20-20：放松睫状肌最好的动作 ② 满 20 分钟，他为你展开一扇 20 秒的远眺小窗

Adapt：titlecard 的「一个克制动效 + 静读」即本片节奏位；窗外展开为唯一大动效。
Scene 1 (0.0–1.4s): 暗场中一扇「窗」自中心 clip 扩张展开（`svg-path-draw` 或 clip-path 展开），blur-crossfade 意向内露出 horizon 全幅（layered-depth：窗框前景/景致中景/天光渐层）。
Scene 2 (1.4–3.4s): 字幕①「20-20-20：放松睫状肌最好的动作」上 1/3 两行滑入（slide-up crossfade，titlecard 的克制 move）。
Scene 3 (3.4–6.2s): 玻璃提示卡浮起下三分之一上方，conic 倒计时环 20→0 走完（SVG self-draw dash，`stat-bars-and-fills`），mono 数字 count-down 同步。
Scene 4 (6.2–9.0s): 字幕②「满 20 分钟，他为你展开一扇 20 秒的远眺小窗」落；环归零后 still hold（breather 的静即 payload）。

## Frame 5 — 18:30 陪伴日记·守口如瓶

- scene: 左半：30 天时间轴泳道（六条 lane）事件点如星落般记录；右半：隐私两列对照卡——「他在本机看的」三条逐条打勾（脸在不在画面 / 眼睛有没有闭上 / 有没有起身），「他永远不会」三条逐条画叉（保存任何一帧画面 / 把画面传出你的电脑 / 偷看你的屏幕内容）
- voiceover: ""
- duration: 10s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-diary.html
- type: social_proof
- persuasion: Risk reversal（隐私承诺）
- beat: 信任 → 安心
- blueprint: comparison-split (Adapt)
- focal: 两列隐私对照卡（右半）
- asset_candidates: assets/heterochromia-cat-idle.png — 猫咪立绘（角落守着日记）
- roles: heterochromia-cat-idle = supporting（卡旁守望）· 时间轴泳道 = 左半背景叙事

narrativeRole: 收束信任——他记得你的每一天，但日记只锁在你电脑里。隐私两列是官网原文，必须逐字准确。
keyMessage: 他看得见你，但守口如瓶；不上传、不保存。
字幕文案: ① 他记得你的每一天 ② 但日记只锁在你电脑里 ③ 不上传 · 不保存 · 没有云端

Adapt：签名 split-tilt 双卡对进保留；左侧泳道星落作为对比卡入场前的铺垫层。
Scene 1 (0.0–1.6s): 左半 60%：六条 lane 泳道 hairline 展开，事件点 stagger 星落（`dynamic-content-sequencing`，mono 日期轴）；字幕①「他记得你的每一天」随之落。
Scene 2 (1.6–3.2s): 字幕②「但日记只锁在你电脑里」word-swap 接替；泳道收入左侧小图。
Scene 3 (3.2–7.2s): 签名 split-tilt（`split-tilt-cards`）：两卡自左右翼 mirrored rotateY 对进；左卡「他在本机看的」三条逐条 reveal 打 ✓（0.6s/条），右卡「他永远不会」三条逐条画 ✗（coral），内外边 pill 徽记平滑点出。
Scene 4 (7.2–10.0s): 底行字幕③「不上传 · 不保存 · 没有云端」三拍落；猫咪立绘于卡侧守望；hold。

## Frame 6 — 现在·把他带回家

- scene: 雾白底收尾：猫咪立绘中央落位（带一次拍手 sprite 彩蛋），字标「Look Me · 看看我」+ 副题「猫咪伙伴住进你的桌面」，三平台按钮（macOS / Windows / Linux）依次点亮
- voiceover: ""
- duration: 8s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/06-cta.html
- type: cta
- persuasion: Risk reversal（下载即用，全平台）+ 品牌记忆
- beat: 拥有 → 行动
- blueprint: cta-morph-press (Adapt)
- focal: assets/heterochromia-cat-idle.png
- asset_candidates: assets/heterochromia-cat-idle.png — 立绘; assets/heterochromia-cat-clap-sprite.png — 收尾拍手彩蛋
- roles: heterochromia-cat-idle = cutout（中央主体）· clap-sprite = 彩蛋叠层 · 字标与按钮 = supporting

narrativeRole: 官网同款收尾——从 Timeline 的「现在」节点到下载；一句医疗边界小字（个人健康习惯工具）保持克制。
keyMessage: 下载即用，全平台；从今天起，有人在意你的眼睛。
字幕文案: ① Look Me · 看看我 ② 猫咪伙伴住进你的桌面：提醒眨眼、远眺、起身 ③ macOS · Windows · Linux 下载即用

Adapt：签名 condense-morph 保留——猫咪+字标让位压缩，CTA 按钮组在同一中心生长出来。
Scene 1 (0.0–1.2s): 雾白 cream 底，「现在」mono 节点字样自上一帧余韵淡入后隐去；猫咪立绘中央 spring-pop 落位（Centered, ~45% 高）。
Scene 2 (1.2–2.8s): 拍手 sprite 一轮彩蛋（finite）；字标「Look Me · 看看我」per-word reveal。
Scene 3 (2.8–4.6s): 副题「猫咪伙伴住进你的桌面：提醒眨眼、远眺、起身」lead 行滑入。
Scene 4 (4.6–6.4s): 签名 morph：猫咪+字标整体轻微上移收缩，同一中心三个平台按钮自下依序生长点亮（`press-release-spring` 触感，平滑）。
Scene 5 (6.4–8.0s): 底部小字「个人健康习惯工具」hairline 灰度落位；猫咪最后眨一次眼；settle hold 至终帧。
