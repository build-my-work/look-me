# Frame packet: 02-yawn-mirror

## Project inputs

- Project: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror
- Design tokens: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror/frame.md
- RULES_DIR: /Users/zhihu/.claude/hyperframes/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 2 — 你打哈欠，他先困给你看

- scene: 同一舞台，节奏放缓：上方「你」图形打出一个大哈欠（嘴部张大保持约 1 秒），看山嘴部贴片同步张开（官网 petYawnMouth 同款 scale 动画），眼睑跟着眯起
- voiceover: ""
- duration: 8s
- transition_in: crossfade
- status: outline
- src: compositions/frames/02-yawn-mirror.html
- type: benefit_highlight
- persuasion: Delight by association（小彩蛋的拟真）
- beat: 会心一笑
- blueprint: panel-edit-live-sync (Reproduce)
- focal: 看山张大的嘴（yawn-mouth 贴片）
- asset_candidates: assets/kanshan-distance-break.png — 立绘; assets/kanshan-yawn-mouth.png — 哈欠嘴部贴片
- roles: kanshan-distance-break = cutout · kanshan-yawn-mouth = supporting（嘴部贴片，官网坐标 142,127 @260×325 壳）

narrativeRole: 第二个镜像瞬间——真哈欠（张嘴保持约 0.9 秒）不是说话张嘴；你困的时候，他先困给你看。
keyMessage: 你打哈欠，他也跟着张嘴打一个。
字幕文案: ① 你打了个哈欠 ② 他也跟着张嘴打一个 ③ 你困的时候，他先困给你看

Reproduce：live-sync couple 完整呈现——你的哈欠是「编辑」，看山的哈欠是「表面」。
Scene 1 (0.0–1.6s): 字幕①「你打了个哈欠」落（上 1/3）；你图形的嘴部弧线张大（scale .08→1，官网哈欠节奏，保持 ~1s）。
Scene 2 (1.6–4.0s): 看山嘴部贴片同步张开（finite scale 动画），眼睑随之眯起（scaleY 半闭）——同拍回应，couple 成立。
Scene 3 (4.0–6.0s): 双双回正（嘴合、眼开）；字幕②「他也跟着张嘴打一个」word-swap。
Scene 4 (6.0–8.0s): 字幕③「你困的时候，他先困给你看」落；hold 静读。
