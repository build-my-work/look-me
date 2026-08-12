# Frame packet: 04-idle-theater

## Project inputs

- Project: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror
- Design tokens: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror/frame.md
- RULES_DIR: /Users/zhihu/.claude/hyperframes/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 4 — 没人理他的时候，他也会自己玩

- scene: 三连小剧场快切：暖沙 tile 里拍手 8 帧连播 → 坐下 8 帧 → 转圈 11 帧（官网 sprite steps() 同款技术），节奏轻快，下方标签逐条点亮
- voiceover: ""
- duration: 10s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/04-idle-theater.html
- type: benefit_highlight
- persuasion: 情感陪伴的价值（活的桌面宠物）
- beat: 轻快 → 喜爱
- blueprint: grid-card-assemble (Reproduce)
- focal: assets/kanshan-clap-sprite.png（第一块 tile）
- asset_candidates: assets/kanshan-clap-sprite.png — 拍手 8 帧; assets/kanshan-sit-sprite.png — 坐下 8 帧; assets/kanshan-spin-sprite.png — 转圈 11 帧
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

## Selected motion rule: center-outward-expansion

---
name: center-outward-expansion
description: Elements start clustered at screen center and expand outward to their final positions, driven by a shared progress value.
metadata:
  tags: expansion, scatter, center, reveal, layout, sync, burst
---

# Center-Outward Expansion

Elements begin at one shared center point and radiate outward to their final positions — the entry beat itself, or motion driven by another animation's progress (a counting number, a beat). Flat 2D cousin of [depth-scatter-assemble.md](depth-scatter-assemble.md) (per-element 3D cloud): here every element shares the SAME origin.

## How It Works

Each element carries its final offset as `data-target-x/y`. Its position lerps between center and target: `x = targetX × progress`. Self-centering is baked as `xPercent/yPercent: -50` so the tweened `x`/`y` are pure offsets from the stage center. Standalone burst = per-item staggered `fromTo`; driven burst = one shared proxy (see Variations).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="burst-wrap">
  <div class="burst-item" data-target-x="-360" data-target-y="-180">{itemA}</div>
  <div class="burst-item" data-target-x="360" data-target-y="-180">{itemB}</div>
  <div class="burst-item" data-target-x="0" data-target-y="360">{itemC}</div>
</div>
```

```css
.burst-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.burst-item {
  position: absolute;
  top: 50%;
  left: 50%; /* GSAP xPercent/yPercent -50 bakes the centering; x/y tween the offset */
  will-change: transform;
}
```

```js
document.querySelectorAll(".burst-item").forEach((el, i) => {
  tl.fromTo(
    el,
    { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.6, opacity: 0 },
    {
      x: Number(el.dataset.targetX),
      y: Number(el.dataset.targetY),
      scale: 1,
      opacity: 1,
      duration: EXPAND_DUR,
      ease: EXPAND_EASE,
    },
    ENTRY_AT + i * STAGGER,
  );
});
```

## Variations

- **Synced to a driver (chord)**: when the burst shadows a counter / beat, drop the stagger and drive all items from ONE 0→1 proxy tween with the driver's exact duration AND ease; `onUpdate` writes `translate(-50%,-50%) translate(targetX*p, targetY*p)` per item — the two read as one beat.
- **Partially-spread start**: with 6+ items the full cluster piles up — start from `{ x: targetX * START_PROGRESS, ... }`.
- **Idle micro-float**: hand off to [sine-wave-loop.md](sine-wave-loop.md) after landing instead of freezing.

## Values

| token          | range                | notes                                                            |
| -------------- | -------------------- | ---------------------------------------------------------------- |
| ITEM_COUNT     | 3–8                  | > 8 = visual chaos mid-expansion; low counts want wider spread   |
| EXPAND_DUR     | 1.0–1.8s             | must equal the driver's duration in the synced variant           |
| EXPAND_EASE    | `power3.out` default | `power2.out` gentler, `expo.out` dramatic stop; NEVER `in` eases |
| STAGGER        | 0.04–0.08s           | tighter = chord; looser = lazy arpeggio                          |
| ENTRY_AT       | 0–0.5s               | a beat of compositional quiet before the burst                   |
| START_PROGRESS | 0–0.5                | 0 = dramatic full cluster; ~0.3 avoids the pile-up               |

## Critical Constraints

- **Tween `x`/`y` over the baked `xPercent/yPercent: -50`** — mutating `left`/`top` fights the centering and causes pixel jitter.
- **Out-easing only** — `in` easings read as items being sucked back mid-air.
- **No other absolute-positioned siblings inside `.burst-wrap`** — they'd steal the centered baseline.
- **❗ The burst IS the beat** — don't park a "real headline" label below it (the eye snaps to the label and ignores the burst). If a label is needed, reveal it post-burst in the same stack.
- Synced variant: identical duration + ease as the driver, or the chord falls apart.

## See also

`counting-dynamic-scale` (the classic chord driver) · `depth-scatter-assemble` (3D per-element cloud) · `card-morph-anchor` (burst out of a morphed card) · `sine-wave-loop` (post-landing life).
