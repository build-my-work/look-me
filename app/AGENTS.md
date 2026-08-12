# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Look Me product decisions

- The selected visual target is displayed ideation option 2: tactile 3D 刘看山 beside a small ambient horizon portal for a 20-second distance break.
- The product is a local-first desktop wellness coach, not a diagnostic medical device. Raw camera frames are processed ephemerally and never uploaded or saved.
- The always-on-top native mode stays compact and transparent. Browser preview mode supplies a defocused workspace only to make the overlay inspectable.
- Reminders are silent and non-punitive by default. Do not add streaks, scores, medical claims, or a dashboard.
- Blink detection uses MediaPipe Face Landmarker locally. Low-confidence sensing must fall back to timer-only coaching rather than claiming the user failed to blink.
- Blink statistics show a rolling one-minute estimate, current visible-segment average, and session total in a compact readout.
- The user explicitly approved local history on 2026-08-12: retain sparse minute-level blink counts plus valid observation duration for 30 days, never raw frames or exact blink timestamps. Show unobserved minutes as gaps and do not add health scores.
- The user explicitly expects the native companion window to be draggable. 刘看山 is the bounded drag handle; buttons remain clickable and transparent areas keep desktop click-through behavior.
- Native drag movement must keep the complete pet handle inside the active display's work area so the frameless window always has a visible recovery surface.
- Each detector-confirmed complete blink should replay one short blink on 刘看山's visible eye. Timer fallback and manual “眨好了” actions must not fabricate a mirrored blink.
- Pet sizing is pet-only: expose small, standard, and large presets in the tray at `41% / 100% / 110%`, remember the selection locally, and keep cards and controls at their existing size. The pet image, eyelid, renderer drag region, and native edge-clamp geometry must scale together.
- Distant-face blink recovery must preserve two-signal confidence: weak bilateral blendshape peaks may count only when a strong relative EAR drop confirms closure. Do not globally lower the normal blink threshold or remove wink and duration guards.
- Daily-chart visibility is a persistent tray setting. Tray show/hide, the in-app chart entry, and the chart close button must stay synchronized; hiding the chart must never stop local history aggregation.
- The user approved the whole-display right-edge attention rail on 2026-08-12. Run it only while the camera is ready, a face is confidently visible, the coach is idle, and no stats/history panel is open; losing face confidence resets escalation, while manual panels and dragging pause it.
- Rail timing is fixed: hidden for the first 10 seconds after a confirmed blink, descend from the current display's upper-right during seconds 10–25, cry at the lower-right during seconds 25–30, then repeat two 5.5-second Y-axis flight rounds followed by a 2-second crying rest. Any detector-confirmed blink stops tears, mirrors the blink, recovers upward, and starts a 25-second quiet cooldown.
- Respect Reduce Motion by replacing full-display rail flight with one static crying pose near the lower-right. The generated tear PNG is a real raster asset and must remain visibly legible in the 41% small-pet preset.
- Blink coaching has no manual “眨好了” completion control. When camera sensing is unavailable, show the quiet three-blink prompt for 6 seconds and return to idle automatically; when sensing is available, keep requiring three detector-confirmed blinks.
- “看山常驻” is a persistent tray setting and defaults off. When enabled, hidden and post-blink cooldown phases become a visible resting pose at the current display's upper-right; descent, tears, rampage, recovery, and manual panels keep their existing behavior.
- The pet drag region must share the pet shell's bottom transform origin in every size and rail state. Native drag QA must start inside the visible pet/handle overlap and include the 41% preset on a secondary display.
- The right edge is only the default automatic attention rail. After a user drags the pet in rail mode, preserve the dropped X coordinate and run later descent, crying, rampage, and recovery vertically at that user-selected anchor; never snap it back to the display edge on pointer release.
