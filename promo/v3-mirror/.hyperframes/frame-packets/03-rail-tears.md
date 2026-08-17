# Frame packet: 03-rail-tears

## Project inputs

- Project: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror
- Design tokens: /Users/zhihu/code/m_code/ai/look-me/promo/v3-mirror/frame.md
- RULES_DIR: /Users/zhihu/.claude/hyperframes/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 3 — 25 秒没眨眼，他掉着眼泪来

- scene: 注意力轨道剧场（官网 rail-demo 同款）：看山从右上角沿虚线轨道缓缓降落、泪流挂脸（tear 贴片 + 泪滴反复坠落）；字幕「25 秒不眨眼——」；眨眼瞬间（画面闪一次眼睑），他立刻擦泪、沿轨道回升，字幕「你一眨眼，他立刻擦泪回升」
- voiceover: ""
- duration: 11s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-rail-tears.html
- type: pain_point
- persuasion: Pain validation + 即时回应的安心
- beat: 愧疚 → 被在乎
- blueprint: camera-journey (Adapt)
- focal: 降落中的看山 + 泪流
- asset_candidates: assets/kanshan-distance-break.png — 立绘; assets/kanshan-tear.png — 泪流与泪滴
- roles: kanshan-distance-break = cutout（轨道主体）· kanshan-tear = supporting（泪流 + 泪滴）

narrativeRole: 情感最高点——提醒不是弹窗，是一只为你的眼睛着急的小狐狸。降落（担心）与回升（安心）是一次完整的情绪弧。
keyMessage: 25 秒不眨眼他掉泪提醒，你一眨眼他擦泪回升。
字幕文案: ① 25 秒不眨眼，他从屏幕角落缓缓降落 ② 掉着眼泪提醒你 ③ 你一眨眼——他立刻擦泪回升，然后安静 25 秒

Adapt：sub-shape B 无光标飞行——相机跟随看山沿轨道的两段旅程（降→升），旅程本身就是叙事。
Scene 1 (0.0–1.6s): 舞台建立：右上角虚线轨道 SVG self-draw；看山挂泪流出现在顶端（`spring-pop-entrance` 平滑）。
Scene 2 (1.6–5.0s): 相机缓慢下移跟随（`multi-phase-camera` drift）看山沿轨道降落；泪滴 finite 两坠（`dynamic-content-sequencing`）；字幕①「25 秒不眨眼，他从屏幕角落缓缓降落」per-word 随降随落。
Scene 3 (5.0–6.8s): 字幕②「掉着眼泪提醒你」word-swap；降落到位定格半拍（情绪最低点）。
Scene 4 (6.8–9.2s): 回应拍：画面轻闪一拍 + 你图形眼睑一闭一开；看山擦泪（tear 淡出）；字幕③前半「你一眨眼——」落。
Scene 5 (9.2–11.0s): 看山沿轨道回升（相机 drift 回上）；字幕③后半「他立刻擦泪回升，然后安静 25 秒」落；settle hold。

## Selected motion rule: dynamic-content-sequencing

---
name: dynamic-content-sequencing
description: Auto-calculate timeline start/end times from content length + per-item duration config — longer content gets more screen time without hardcoded numbers.
metadata:
  tags: timeline, sequencing, dynamic, duration, content-aware, utility
---

# Dynamic Content Sequencing

A utility pattern (not a motion rule in itself) for scenes that show a SEQUENCE of items (cards, phrases, stats): each item's duration is computed from its content length + per-item config, and the sequencer assigns absolute start/end times automatically — no hardcoded offsets per item. Distinct from [discrete-text-sequence](discrete-text-sequence.md) (one text element changing states) — this rule swaps between distinct content blocks.

## How It Works

A content array of `{ eyebrow, title, body, speedFactor, hold }` entries is reduced once at build time into a flat `TIMELINE` of `{ …entry, start, end }` — duration per entry is `BASE_DURATION + body.length × SEC_PER_CHAR + hold`, so longer text earns more reading time. A single linear driver's `onUpdate` reverse-searches the active entry and swaps the DOM **only on transitions** (a `lastTitle` guard — per-frame `textContent` writes flicker in render); an optional progress bar fills 0→100% across the whole run.

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="display">
  <div class="eyebrow" id="eyebrow"></div>
  <div class="title" id="title"></div>
  <div class="body" id="body"></div>
  <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
</div>
```

```css
.body {
  min-height: 160px; /* reserve space — content height varies; without this, layout jumps */
}
.progress-fill {
  height: 100%;
  width: 0%;
}
```

```js
// N entries, each with its own pacing (optionally a speedFactor multiplier);
// the final entry uses a larger hold (closing beat).
const CONTENT = [
  { eyebrow: "{eyebrow1}", title: "{title1}", body: "{body1}", hold: HOLD_MID },
  // …
  { eyebrow: "{eyebrowN}", title: "{titleN}", body: "{bodyN}", hold: HOLD_FINAL },
];

// Pre-compute absolute start/end ONCE — never in onUpdate.
let cumulative = 0;
const TIMELINE = CONTENT.map((entry) => {
  const dur = BASE_DURATION + entry.body.length * SEC_PER_CHAR + entry.hold;
  const start = cumulative;
  cumulative += dur;
  return { ...entry, start, end: cumulative };
});

function entryAt(time) {
  for (let i = TIMELINE.length - 1; i >= 0; i--) {
    if (time >= TIMELINE[i].start) return TIMELINE[i];
  }
  return TIMELINE[0];
}

const eyebrowEl = document.getElementById("eyebrow");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const progressEl = document.getElementById("progress-fill");

const TOTAL_DURATION = cumulative + TAIL_PAD;
const driver = { t: 0 };
let lastTitle = "";

tl.to(
  driver,
  {
    t: TOTAL_DURATION,
    duration: TOTAL_DURATION,
    ease: "none",
    onUpdate: () => {
      const entry = entryAt(driver.t);
      // Swap content only on transitions — no per-frame DOM thrash
      if (entry.title !== lastTitle) {
        eyebrowEl.textContent = entry.eyebrow;
        titleEl.textContent = entry.title;
        bodyEl.textContent = entry.body;
        lastTitle = entry.title;
      }
      progressEl.style.width = `${(driver.t / TOTAL_DURATION) * 100}%`;
    },
  },
  0,
);
```

## Variations

- **Crossfade between items** — return BOTH adjacent entries during an overlap window (`time ≥ e.start − overlap && time ≤ e.end + overlap`, overlap ≈ 0.3s) and render them with opacities computed from distance to the boundary.
- **Per-item motion variation** — map an `entry.style` key to an existing rule per chapter (e.g. `3d-text-depth-layers` → `hacker-flip-3d` → `counting-dynamic-scale`); the sequencer only orchestrates timing.
- **Auto-extend composition duration** — you can set `data-duration` from the computed `TOTAL_DURATION` in script, but HF reads `data-duration` at composition load and setting it after init may not take effect — author the duration manually from a rough total.

### Accelerating cadence (geometric hold decay)

For rhetorical escalation — "everyone says…", a roll-call, a praise flurry — the beat grid itself accelerates: early entries hold ~1s (read speed), then windows shrink geometrically into a ~0.15–0.3s flurry, braking on an emphasis state before the resolve. The acceleration is pre-computed into the same flat `TIMELINE` — still content-driven, still deterministic, no speed-up tween anywhere:

```js
// Geometric decay on the hold, clamped at a flurry floor; the brake state holds longest.
const HOLDS = CONTENT.map((entry, i) => Math.max(FLURRY_FLOOR, HOLD_START * Math.pow(DECAY, i)));
HOLDS[CONTENT.length - 1] = HOLD_FINAL;

let cumulative = 0;
const TIMELINE = CONTENT.map((entry, i) => {
  // Past ~0.5s states are glanced as motion texture, not read —
  // drop the per-char term or you never reach flurry speed.
  const readable = HOLDS[i] >= READ_THRESHOLD;
  const dur = HOLDS[i] + (readable ? entry.body.length * SEC_PER_CHAR : 0);
  const start = cumulative;
  cumulative += dur;
  return { ...entry, start, end: cumulative };
});
```

Worked example — **praise-chip flurry**: ~16 short quotes hard-cut through a chip beside a pinned wordmark. First 3 states at `HOLD_START = 1.0` (each reads fully); `DECAY = 0.8` shrinks every following window until `FLURRY_FLOOR = 0.2` catches it (≈12 states over ~2.5s — a churn of acclaim, individually glanced); the longest phrase takes `HOLD_FINAL ≈ 1.6` as the brake before the closing lockup.

Values: `HOLD_START` 0.8–1.2s; `DECAY` 0.75–0.88 (higher = longer runway before the flurry bites); `FLURRY_FLOOR` 0.15–0.3s (below ~0.15s swaps strobe); `READ_THRESHOLD` ~0.5s; brake ≥ 4× the floor or the stop doesn't register as a beat. The 3–6 entry guidance relaxes here — 12–18 states are legal precisely because flurry states aren't individually read. The hard-cut discipline (`lastTitle` guard, instant swaps) is what lets 0.2s states render clean.

## Values

| token         | range                 | notes                                                                                                                 |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| BASE_DURATION | 0.6–1.5s              | minimum per entry regardless of length — even one-word entries get read time                                          |
| SEC_PER_CHAR  | 0.03–0.06 s/char      | ≈17–33 chars/sec; uniform across the sequence so the pace reads as one engine; lean high for wide-character languages |
| HOLD_MID      | 0.5–1.0s              | dwell on a non-final entry; `< HOLD_FINAL`                                                                            |
| HOLD_FINAL    | 1.0–2.0s              | climax dwell — must exceed HOLD_MID by a clear margin so the close reads as a beat                                    |
| SPEED_FACTOR  | 0.5–2.0 (default 1.0) | per-entry only; if every entry shares a factor, fold it into SEC_PER_CHAR                                             |
| TAIL_PAD      | 0.0–1.0s              | quiet beat after the last entry; prefer 0 when the next composition owns the breath                                   |
| CONTENT N     | 3–6 entries           | <3 isn't a sequence; >6 drags (accelerating cadence relaxes this — see above)                                         |

Reference: `../../examples/messaging-multi-phrase.html`.

## Critical Constraints

- **Pre-compute the TIMELINE once at build** — never recompute in `onUpdate`; the reverse search over the flat array is the whole per-frame cost.
- **DOM swap only on entry transition** (`lastTitle`/key guard) — per-frame `textContent` assignment flickers in HF render.
- **`min-height` on the body element** — without reservation, downstream elements (progress bar, brand) jitter as content height varies.
- **Sequential only** — for parallel tracks use a different reduction.
- **Titles fit one line at the chosen size; bodies fit inside `min-height` after wrapping.**

## See also

`discrete-text-sequence` (per-entry typewriter on the body) · `context-sensitive-cursor` (cursor color per chapter) · `vertical-spring-ticker` (animated word swap instead of hard cut) · `scale-swap-transition` (visual morph between entries).

## Selected motion rule: multi-phase-camera

---
name: multi-phase-camera
description: Sequential camera zoom with 2-3 distinct phases (pull-back / focus / push) plus continuous micro-drift for organic cinematic feel.
metadata:
  tags: camera, zoom, phase, drift, scale, cinematic
---

# Multi-Phase Camera

A camera wrapper around the ENTIRE scene that progresses through discrete zoom phases at scripted triggers, with continuous sine-driven micro-drift overlaid so the camera never feels static between phases. Distinct from a single linear zoom — multi-phase creates cinematic pacing (anticipation → reveal → settle).

## How It Works

The camera is one wrapping `<div>` whose `transform: scale() translate(x, y)` is composed from two channels inside a single `onUpdate` writer:

1. **Phase scale** — a proxy object `{ scale }` stepped through phases at trigger times (`PHASE_1_SCALE` at t=0 → `PHASE_2_SCALE` at `PHASE_2_AT` → `PHASE_3_SCALE` at `PHASE_3_AT`).
2. **Drift offset** — a continuous sine-based `translateX` / `translateY` (small amplitude, slow frequency) ADDED to the phase transform. X and Y run at slightly different frequencies (`DRIFT_FREQ_RATIO ≈ 1.3`) — equal frequencies produce a perfect diagonal that reads mechanical; ~1.3 gives an organic Lissajous.

## Recipe

```html
<div class="camera" id="camera">
  <div class="content">
    <div class="hero">{Brand}</div>
    <div class="tagline">{tagline}</div>
    <div class="cta">{ctaText}</div>
  </div>
</div>
```

```css
.scene {
  overflow: hidden; /* REQUIRED — any phase scale < 1 exposes the content's edges */
  background: {sceneBgColor}; /* background on .scene, NOT .camera — a camera-borne
     background warps/translates with the transform and reveals the outer void */
}
.camera {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transform-origin: 50% 50%; /* off-center origin creates phase-to-phase drift */
  will-change: transform;
}
```

```js
const camera = document.getElementById("camera");

// Three-phase scale plan: pullback → focus → push.
const phase = { scale: PHASE_1_SCALE }; // Phase 1 is the initial value — no tween

// Phase 2 — settle to neutral focus
tl.to(phase, { scale: PHASE_2_SCALE, duration: PHASE_2_DUR, ease: PHASE_2_EASE }, PHASE_2_AT);

// Phase 3 — slow push-in for the climax
tl.to(phase, { scale: PHASE_3_SCALE, duration: PHASE_3_DUR, ease: PHASE_3_EASE }, PHASE_3_AT);

// Drift driver — continuous sine motion overlaid on the phase scale.
// The ONE writer of camera.style.transform.
const drift = { p: 0 };
tl.to(
  drift,
  {
    p: Math.PI * 2 * DRIFT_CYCLES,
    duration: TOTAL_DURATION, // spans the whole composition
    ease: "none",
    onUpdate: () => {
      const dx = Math.sin(drift.p) * DRIFT_AMP_X;
      const dy = Math.sin(drift.p * DRIFT_FREQ_RATIO) * DRIFT_AMP_Y;
      camera.style.transform = `scale(${phase.scale}) translate(${dx}px, ${dy}px)`;
    },
  },
  0,
);

// Content reveals happen INSIDE the camera frame (hero/tagline/cta beats).
```

## Phase Patterns

| Pattern             | Scale sequence (1 → 2 → 3)        | Feel                            | When to use                   |
| ------------------- | --------------------------------- | ------------------------------- | ----------------------------- |
| **Focus-in**        | back → neutral → slight push      | Approach → settle → slight push | Default product reveal        |
| **Dramatic reveal** | push → neutral → pull             | Wide → focus → settle back      | Hero shot with breathing room |
| **Steady push**     | neutral → slight push → more push | Gradual forward momentum        | Continuous narrative push     |
| **Bookend pull**    | neutral → strong push → neutral   | Settle → push → release         | CTA emphasis then release     |

## Variations

- **Phase trigger by content beat**: align a camera tween's start with a content tween's end (entry completes → push begins) rather than a fixed clock value.
- **Camera shake (panic / impact)**: a brief higher-amplitude, higher-frequency drift tween over a short window — same `drift` mechanism with `SHAKE_AMP` / `SHAKE_CYCLES` / `SHAKE_DUR` at `SHAKE_AT`.
- **Targeted zoom into an off-center element**: combine scale with counter-translation so the target lands at viewport center — divide the measured offset by the current scale before feeding it into the writer:

```js
const tRect = document.querySelector(".cta").getBoundingClientRect();
const offsetX = (STAGE_W / 2 - (tRect.left + tRect.width / 2)) / phase.scale;
const offsetY = (STAGE_H / 2 - (tRect.top + tRect.height / 2)) / phase.scale;
// then in onUpdate: translate(offsetX + dx, offsetY + dy)
```

(Full counter-translate doctrine: [coordinate-target-zoom.md](coordinate-target-zoom.md).)

## Values

| token                       | range                                    | notes                                                                               |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| PHASE_1 / 2 / 3_SCALE       | 0.88–0.96 / 0.98–1.02 / 1.04–1.15        | tighter spread = subtler camera; scale < 1 REQUIRES `overflow: hidden` on `.scene`  |
| PHASE_2_AT / PHASE_2_DUR    | 0.3–1.0s / 1.0–1.8s                      | longer DUR = slower settle, more cinematic                                          |
| PHASE_3_AT / PHASE_3_DUR    | 2.0–4.0s / 1.0–2.0s                      | PHASE_3_AT ≥ PHASE_2_AT + PHASE_2_DUR or focus is preempted                         |
| PHASE_2_EASE / PHASE_3_EASE | `power2.out` `power3.out` `power2.inOut` | spring/back easing on a camera feels uncomfortable; each later phase settles deeper |
| TOTAL_DURATION              | = `data-duration`                        | the drift tween must span the whole composition                                     |
| DRIFT_CYCLES                | 1–3                                      | 1 = one slow breath; high values read as mechanical wobble                          |
| DRIFT_AMP_X / DRIFT_AMP_Y   | 2–8 px / 1–4 px                          | imperceptible per-frame, visible over time — if it reads as a shake, it's too much  |
| DRIFT_FREQ_RATIO            | 1.2–1.5                                  | 1.0 = perfect diagonal (mechanical); ~1.3 = organic Lissajous                       |
| HERO_AT (etc.)              | after Phase-2 settle lands               | a hero fading in mid-pull-back feels like it's flying away                          |

## Critical Constraints

- **Camera wraps EVERYTHING in the scene** — a per-element camera creates parallax bugs and breaks the "one viewpoint" read.
- **One writer**: phase scale and drift compose inside the single drift `onUpdate`; nothing else touches `camera.style.transform`.
- **`overflow: hidden` on `.scene`** — required whenever any phase scale < 1.
- **`transform-origin: 50% 50%` on `.camera`** — off-center origin creates unpredictable phase-to-phase drift.
- **Scene background on `.scene`, not `.camera`** — otherwise scaling/translating reveals the outer void.
- **Hero reveal starts AFTER the initial pull-back ease lands** — otherwise the headline feels like it's flying away.

## See also

[coordinate-target-zoom.md](coordinate-target-zoom.md) (counter-translate math for the targeted variation) · [orbit-3d-entry.md](orbit-3d-entry.md) (orbit inside a drifting camera) · [counting-dynamic-scale.md](counting-dynamic-scale.md) (climax push synced to counter peak) · [3d-text-depth-layers.md](3d-text-depth-layers.md) (depth-stacked hero under camera moves) · [sine-wave-loop.md](sine-wave-loop.md) (element idle inside the camera).

## Selected motion rule: spring-pop-entrance

---
name: spring-pop-entrance
description: The canonical entrance pop — an element (or staggered group) arrives by scaling 0 → 1 on a smooth long-tail settle (power3 default); bouncy overshoot is a rare, explicitly-playful exception. fromTo so it's correct at t=0 under seek.
metadata:
  tags: spring, entrance, pop, scale, power3, settle, stagger, reveal, arrival
---

# Spring-Pop Entrance

> **Smooth beats bouncy.** This entrance defaults to a smooth long-tail settle — `power3.out` (or `expo.out` for a faster front) — that decelerates cleanly into the resting size with **no overshoot**. Bouncy `back.out` is the **#1 instant turn-off** in agent-made videos and is almost never executed well; it is a rare, explicitly-playful exception (consumer / fun brand), never the default. When unsure, settle smoothly.

THE entrance primitive: an element (or staggered group) arrives by springing from nothing — `scale: 0 → 1`, optional small `y` rise — and settles without bouncing. This is **arrival**, not reaction: distinct from [press-release-spring.md](press-release-spring.md) (a click/press → release feedback chain on an element that already rests on screen). Many blueprints used to borrow that rule to fake an entrance; reach for this instead.

## How It Works

One `fromTo` carries the whole arrival: from `{ scale: 0, opacity: 0 }` (explicit, so t=0 is correct under seek) to `{ scale: 1, opacity: 1, ease: "power3.out" }`. For a **group**, the same `fromTo` runs per element at `i * STAGGER`, capped so the group reads as one arriving beat. The `scale` grow is load-bearing; the `y` rise is garnish — drop everything else and it must still read as a clean entrance. Let the ease produce the settle: never hand-key a `scale: 1.1` mid-state (it double-bounces against the curve).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="pop-hero" id="hero">{heroLabel}</div>

<div class="pop-grid">
  <div class="pop-item">{itemA}</div>
  <div class="pop-item">{itemB}</div>
  <div class="pop-item">{itemC}</div>
</div>
```

```css
.pop-hero,
.pop-item {
  transform-origin: 50% 50%; /* in-place pop; move to the source point for the anchored variation */
  will-change: transform;
}
.pop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: GRID_GAP;
  place-items: center;
}
```

```js
// Single hero pop — smooth long-tail settle, no overshoot.
tl.fromTo(
  "#hero",
  { scale: 0, opacity: 0 },
  { scale: 1, opacity: 1, duration: POP_DUR, ease: "power3.out" },
  ENTRY_AT,
);

// Staggered group pop — one arriving beat.
gsap.utils.toArray(".pop-item").forEach((el, i) => {
  tl.fromTo(
    el,
    { scale: 0, opacity: 0, y: Y_RISE },
    { scale: 1, opacity: 1, y: 0, duration: POP_DUR, ease: "power3.out" },
    GROUP_ENTRY_AT + i * STAGGER,
  );
});
```

## Variations

- **Calm settle** (premium / enterprise): `power3.out`, no rotation, `Y_RISE` 0–12px — a weighted, confident landing for a hero wordmark or product shot.
- **Firm settle** (everyday default): `power3.out` or `expo.out` for a punchier front, `Y_RISE` ~24px — cards, icons, callouts.
- **Exact-physics settle**: when the settle IS the shot, swap the ease for `springEase({ response: 0.4 })` (critically damped) from `../adapters/gsap-easing-and-stagger.md` → Spring Eases; take `duration` from the helper.
- **Origin-anchored pop**: a callout growing out of a specific point (marker, pointer tip) sets `transform-origin` to that point (e.g. `0% 100%`) so `scale: 0 → 1` reads as "emerging from the source", not "inflating in place".
- **Pop into a held slot**: land the pop and hold still — no idle loop baked into the entrance. If the held frame genuinely needs life, hand off to [sine-wave-loop.md](sine-wave-loop.md) for subtle jitter on a separate later tween; prefer revealing the next element on its VO cue.
- **Bouncy pop (RARE — explicitly-playful only)**: swap the ease for `back.out(OVERSHOOT)` and optionally settle a small `rotation: ROT_FROM → 0` so elements look hand-placed. Only for a deliberately playful register — never product / enterprise / serious tone:

```js
tl.fromTo(
  el,
  { scale: 0, opacity: 0, rotation: ROT_FROM },
  { scale: 1, opacity: 1, rotation: 0, duration: POP_DUR, ease: `back.out(${OVERSHOOT})` },
  GROUP_ENTRY_AT + i * STAGGER,
);
```

Even here keep `OVERSHOOT ≤ ~2` — past that it reads as cartoon wobble. Better still: the baked spring at `dampingFraction: 0.6–0.7` (same adapters doc) gives ~5–10% overshoot that reads physical where `back.out` reads cartoon.

## Values

| token      | range                                     | notes                                                            |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------- |
| EASE       | `power3.out` default; `expo.out` punchier | `back.out(OVERSHOOT)` only in the playful variant                |
| POP_DUR    | 0.4–0.7s                                  | shorter = tight snap; hero must be visible by **t ≤ 0.5s**       |
| STAGGER    | 0.04–0.08s                                | `min(0.06, 0.5 / ITEM_COUNT)` — self-caps the window             |
| ITEM_COUNT | 3–9                                       | >9 makes the stagger vanish — switch to a wipe/sweep reveal      |
| Y_RISE     | 0–32px                                    | small; never large enough to read as a slide-up                  |
| ROT_FROM   | −10°–+10°                                 | playful variant only; alternate sign by index (`i % 2 ? 6 : -6`) |
| ENTRY_AT   | 0–0.4s                                    | a beat of quiet, but keep the subject landing by t ≤ 0.5s        |

## Critical Constraints

- Default ease `power3.out` (no overshoot); `back.out` only in the explicitly-playful variant, and there `OVERSHOOT ≤ ~2`.
- `ITEM_COUNT × STAGGER ≤ ~0.5s` — the group must land inside one beat.
- Entrances state the collapsed from-state in `fromTo` — never rely on a CSS-hidden start (it renders visible before the tween claims it under seek).
- `transform-origin: 50% 50%` for an in-place pop; the source point only for the anchored variation.
- This is a finite arrival — idle motion on a held element is a separate, later `sine-wave-loop` tween.

## See also

`center-outward-expansion` (pop while radiating to slots) · `press-release-spring` (the click-feedback counterpart) · `sine-wave-loop` (post-arrival jitter, sparingly).
