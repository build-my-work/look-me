---
workflow: product-launch-video
flow: automation
storyboard: no
message: "泪膜只能撑 10 秒——盯屏时你已经 30–60 秒没眨眼了"
destination: website
aspect: 1920x1080
language: zh
length: 55s
angle: data-science
narration: no
---

## Intent

Look Me（看看我）官方宣传视频，三个平行版本中的「泪膜倒计时·科学向」版。用户委托："做 3 个版本，然后给我看"——autonomous 信号，直接交付成品 MP4。产品是猫咪伙伴 IP 的桌面护眼陪伴应用：透明置顶小宠物常驻桌面，本地摄像头视觉检测（不上传），提醒眨眼、远眺（20-20-20）、起身。调性：安静、温和、不打扰——"只在该出现的时候出现"。官网数据条是本版的主线素材：10 秒（泪膜极限）/ 4 秒（正常眨眼间隔）/ 30–60 秒（盯屏不眨眼）/ 25 秒（猫咪出手时机）——大数字逐个砸出，问题 → 机制 → 猫咪出手。

## Assets

素材源目录：`/Users/zhihu/code/m_code/ai/look-me/site/assets/`（已复制到 `capture/assets/`）
- heterochromia-cat-idle.png — 猫咪伙伴站姿立绘（512×640 比例），主角形象
- heterochromia-cat-clap-sprite.png — 拍手精灵图，8 帧横排（800% 宽），官网 steps() 播放
- heterochromia-cat-sit-sprite.png — 坐下精灵图，8 帧横排
- heterochromia-cat-spin-sprite.png — 转圈精灵图，11 帧横排（1100% 宽）
- heterochromia-cat-yawn-sprite.png — 3 帧全身哈欠精灵图
- cat-tear.png — 眼泪贴片（泪流 + 泪滴）
- preview-workspace.webp — 桌面工作区实景背景（hero 舞台用）
- horizon-break.webp — 20-20-20 远眺场景图（窗外地平线）
- look-me-cover-16x9-v2.png — 官方 16:9 封面图

## Customizations

- 官网 CSS 动画技术原生复用：sprite steps() 硬切帧、眨眼镜像（eyelid scaleY）、哈欠镜像（mouth 贴片）、注意力轨道降落（translateY + 擦泪回升）——官网源码（site/index.html）就是参考实现
- 统计胶囊卡（cap-title/cap-num）用 count-up 数字动画呈现真实数据感
- 结尾三平台下载按钮（macOS / Windows / Linux）+ 产品名 Look Me·看看我

## Notes

- 静音版：无 VO、无 BGM（HeyGen 未登录、本地 Kokoro/MusicGen 未安装）。SCRIPT.md 不存在，STORYBOARD music: none
- 品牌色以 site/index.html 的 :root token 为准，中文字体 PingFang SC（系统可用），数字/代码用 mono
- 隐私表述必须准确：检测全在本机完成，不上传、不保存画面——不说"保护视力/治疗干眼"之类医疗功效
- 医疗边界文案（官网 footer）：个人健康习惯工具，不用于诊断或治疗干眼症
