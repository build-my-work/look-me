# Frame packet: 03-theater

## Project inputs

- Project: /Users/zhihu/code/m_code/ai/look-me/promo/v1-timeline
- Design tokens: /Users/zhihu/code/m_code/ai/look-me/promo/v1-timeline/frame.md
- RULES_DIR: /Users/zhihu/.claude/hyperframes/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 3 — 14:07 他真的是活的

- scene: 暖沙色小剧场，三块圆角 tile 依次点亮：拍手 sprite 8 帧连播、坐下 sprite、转圈 sprite；每块 tile 下方官网同款标签（拍手 · 一次 6 连拍 / 坐下 · 再站起来 / 原地转圈圈）
- voiceover: ""
- duration: 10s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/03-theater.html
- type: benefit_highlight
- persuasion: Delight by association（情感转移）
- beat: 惊喜 → 喜爱
- blueprint: grid-card-assemble (Adapt)
- focal: assets/kanshan-clap-sprite.png（第一块 tile）
- asset_candidates: assets/kanshan-clap-sprite.png — 拍手 8 帧精灵图; assets/kanshan-sit-sprite.png — 坐下 8 帧; assets/kanshan-spin-sprite.png — 转圈 11 帧
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
