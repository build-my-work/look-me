# Findings & Decisions

## Requirements
- Desktop app for people with dry-eye risk or symptoms.
- Detect blinking and remind the user to blink and look into the distance.
- Persistent form should feel similar to Codex Pet.
- Remaining product details may be designed autonomously.
- Keep the first version focused, local-first, and non-diagnostic.
- The user selected displayed visual option 2: 3D 刘看山 plus an ambient horizon portal for 20-second distance breaks.
- The user selected pet-only sizing: three tray presets (small, standard, large), while statistics and distance-break panels retain their current size.
- The user reports that confirmed blinks stop being counted when their face occupies fewer camera pixels at a greater webcam distance.
- The user wants the daily frequency chart to be independently showable or hideable from the macOS tray without disabling history collection.
- The user found the original `82%` small pet still too large and explicitly requested that preset be halved again; the new small token is `41%`.
- The user approved a whole-display right-edge behavior: healthy rhythm hides the pet; 10–25 seconds without a confirmed blink descends it, 25–30 seconds cries at the bottom, and 30+ seconds repeats two Y-axis flight rounds plus a 2-second crying rest. A confirmed blink recovers upward and starts a quiet cooldown.
- The user considers the manual “眨好了” control redundant. Blink coaching should stay passive: detector-confirmed sessions complete from real blinks, while low-confidence/timer-only prompts disappear on their own.

## Research Findings
- Previous medical review established that reduced or incomplete blinking during prolonged screen use can destabilize the tear film and increase evaporation.
- A reminder product should support behavior change and symptom awareness, not claim to diagnose or treat dry-eye disease.
- The repository is effectively an empty GitLab starter: only `README.md` and two user-provided character asset archives exist in the initial commit/worktree.
- The local character references are 刘看山: a white dog-like mascot with a large black nose, tiny dot eyes, black limbs, and an optional red scarf. Both flat outlined turnarounds and soft 3D turnarounds are available.
- Public official OpenAI documentation searches did not surface a Codex desktop-pet feature page; an unrelated “Codex Pet Arena” showcase was the only exact official-domain result.
- The locally installed Codex pet contract is authoritative for the interaction vocabulary: idle, directional running, waving, jumping, failed, waiting, active/running, review, and 16 look directions. The key transferable idea is one-glance animated state, not a full control panel.
- The smallest useful loop is: calibrate locally → observe face/blink confidence → stay calm during healthy rhythm → demonstrate three slow complete blinks when cadence drops → prompt a 20-second distance break after sustained near work → acknowledge and return to idle.
- Sensor confidence must gate behavior. Face absent, occluded, poorly lit, camera busy, or uncertain landmarks should switch to timer-only/paused state instead of accusing the user of not blinking.
- The app can observe head/gaze moving away from the display as an optional proxy, but must not claim to verify true focal distance.
- Google MediaPipe's official Web Face Landmarker supports continuous `VIDEO` mode, 3D face landmarks, optional face blendshapes, configurable face-presence/tracking confidence, and `detectForVideo()`. Its synchronous detector can block the renderer, so inference should be rate-limited for the MVP and moved to a worker if profiling shows visible UI impact.
- Electron's official `BrowserWindow` API supports a secure renderer configuration with `nodeIntegration: false`, preload/context isolation, and native window customization. Expensive work should pause when the overlay becomes hidden or occluded.
- The implemented detector uses Face Landmarker blendshapes plus EAR in a separate temporal signal class. A balanced open-close-open sequence lasting 45–800 ms counts as a blink; winks and extended closures do not. Attenuated bilateral peaks are accepted only when a strong relative EAR drop independently confirms closure.
- The selected renderer includes permission, idle, three-blink coaching, 20-second distance break, and 25-minute paused states. Browser preview uses a project-owned defocused workspace; native mode stays transparent.
- The packaged Electron window was verified with a CommonJS sandbox preload. The final packaged smoke reported `isDesktop=true`, desktop shell styling, and the expected distance state.
- Session frequency is withheld for the first 15 seconds, resets its active segment after sustained face loss, and never maps the number to a health grade or universal target.
- The user explicitly requested a daily per-minute curve with date switching. The narrow persistence scope is sparse local minute aggregates only: blink count plus valid face-observation duration, retained for 30 days. Raw frames and exact blink timestamps remain ephemeral.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Separate sensing confidence from coaching behavior | Poor camera conditions must not produce false certainty or punitive feedback |
| Prefer an adaptive reminder loop over a rigid blink quota | Blink rate varies by task and person; rigid goals can create anxiety and distraction |
| Default reminder style: visual and silent | A persistent pet should not compete with work or meetings; sound is opt-in |
| Avoid streaks and punitive scores | The goal is sustainable behavior, not anxiety about a bodily function |
| Keep raw frames ephemeral and on-device | The core use case requires landmarks/events, not stored video |
| Use MediaPipe Face Landmarker in `VIDEO` mode with blendshapes | Officially supported browser API provides landmarks and expression coefficients needed for complete-blink events |
| Request 1280 × 720 at 24 FPS and rate-limit inference to approximately 20 FPS | More source detail and temporal samples improve small-face and short-blink coverage without running inference on every animation frame |
| Relax weak blendshape peaks only behind strong EAR confirmation | Recovers distant-face closures without globally lowering the ordinary close threshold or accepting weak expression noise |
| Keep model output separate from the coach reducer | Signal thresholds can evolve without changing reminder timing, pause, and fallback semantics |
| Use a custom secure `lookme://` protocol in production | Keeps model/WASM assets local while avoiding insecure renderer privileges |
| Use timer fallback whenever the face is not confidently present | Preserves utility without claiming the user failed to blink |
| Show statistics as a compact expandable readout | Gives the user useful feedback while preserving the low-distraction pet form |
| Persist sparse minute aggregates for 30 days after explicit user request | Supports daily comparison while bounding retention and avoiding raw-frame or exact-event history |
| Treat effective screen-facing duration as face-visible `observedMs`, not gaze tracking | A webcam cannot prove focal attention; excluding pause and distance-break intervals gives a conservative proxy while reusing already-retained local aggregates |
| Treat unobserved minutes as missing data, not zero | A zero would falsely imply the camera reliably observed no blinks |
| Plot actual minute blink counts instead of extrapolated per-minute rates | Scaling a short observed interval to 60 seconds creates misleading spikes; the adjacent 0–60-second observation track communicates sampling coverage directly |
| Stack blink and effective screen-facing tracks on a synchronized time axis | The metrics have incompatible units and ranges, so separate Y axes are clearer than overlaying them while still supporting time-by-time comparison |
| Reuse the tray `Menu` for Pet-body settings | One native menu keeps checked state and commands synchronized; a 6 px gesture threshold preserves the Pet's existing drag affordance |
| Keep size selection separate from `showWindow()` and defer popup-menu replacement | `showWindow()` deliberately recenters the native window, while replacing an open Electron menu breaks its next-open lifecycle; neither behavior belongs in a size-only command |
| Native-hit-test the scaled Pet while preserving renderer pointer ownership | macOS does not reliably forward hover into an inactive click-through BrowserWindow before the first click; a bounded cursor poll makes the Pet responsive without turning the large transparent surface into a click blocker |
| Reserve Pet left-click for dragging and right-click for settings | Matches desktop context-menu convention and removes ambiguity between a short drag gesture and opening configuration |
| Persist camera settings on valid selection instead of requiring Save | Switches and native time controls already represent direct preferences; immediate application removes a disabled-button dead end while validation still prevents invalid schedules from reaching storage |
| Use paired hour/minute capsules for monitoring time | Native macOS time fields introduced AM/PM and stepper chrome that broke the compact wellness panel; app-styled selects retain native accessibility while aligning the closed control with the product's visual system |
| Lazy-load the daily chart | Keeps Recharts out of the always-on pet's startup bundle while preserving a mature chart implementation |
| Move the window from validated drag IPC using pointer screen coordinates | Electron native drag regions swallow the hover needed to disable click-through; pointer capture preserves the pet handle while the main process performs display-aware movement |
| Remount one eyelid overlay for each confirmed `blinkCount` change | Reuses the detector's complete-blink event, guarantees repeat animation, and avoids creating a second sensing state |
| Clamp main-process positions against the pointer's nearest display work area | Renderer input is not a safe place to guarantee native-window reachability; keeping the complete pet handle visible preserves a recovery surface across display edges |
| Keep pet size in renderer local storage and report the active handle bounds to Electron | The renderer owns visual scale and existing local persistence; the main process only needs validated geometry to keep native dragging recoverable |
| Keep chart visibility in renderer local storage and mirror it to a tray checkbox | The renderer already owns chart open/close controls; one synchronized boolean prevents the tray and in-app close button from disagreeing |
| Accumulate only confidently sensed, unsuppressed time in a separate attention controller | Prevents face loss, camera uncertainty, manual panels, and dragging from advancing the negative animation while preserving the existing coach reducer |
| Keep the native window on the display and hide the pet layer during healthy/cooldown states | macOS clamps frameless windows to the work-area top; this preserves local camera processing and removes invisible pointer targets without enlarging the window |
| Auto-dismiss only low-confidence blink prompts after 6 seconds | Removes the redundant manual acknowledgment without trapping timer-only users or weakening detector-confirmed three-blink coaching |
| Apply pet persistence as a presentation mapping instead of changing the attention timer | “看山常驻” can reveal only healthy/cooldown poses while preserving the approved descent, crying, rampage, and recovery sequence exactly |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Product Design saved context is absent | Continue from the user prompt and inspect only the current workspace/reference |
| The frameless native window has no `-webkit-app-region: drag` element, and click-through is enabled outside `[data-interactive]` | Add a pet-bounded drag overlay and treat drag regions as pointer-active; keep controls explicitly `no-drag` |
| Electron's official guidance states that draggable regions ignore all pointer events | Keep the pet handle `no-drag` so forwarded hover can disable click-through, capture its pointer during dragging, and let the main process move the window using Electron screen coordinates |
| The native drag IPC applies unconstrained pointer deltas to `BrowserWindow.setPosition` | The 760 px transparent window can move mostly off-screen; once its left-side pet handle leaves the display, the remaining capsule cannot drag it back |
| Distant-face blendshape peaks can remain below the ordinary close threshold even when EAR drops clearly | Add a lower attenuated-signal threshold gated by a strong relative EAR decrease; keep the bilateral, duration, wink, and long-closure guards |
| A tray command can arrive before React registers its IPC listener during native startup | Queue the requested chart visibility until the renderer sends its first synchronized visibility state, then apply the pending command |
| Moving the native window above the macOS work area is clamped back to the menu-bar boundary | Represent hidden/cooldown visually with `visibility: hidden`; use native Y movement only between visible upper-right and lower-right positions |
| At 41%, the pet scaled from its bottom edge while the drag region scaled from its top edge, leaving no clickable overlap on the secondary-display rail | Give the drag region the matching bottom transform origin and make native QA press inside the measured visible overlap on a real secondary display |
| Rail-mode drag end unconditionally replaced the user's X coordinate with the display's right-edge X | Use the right edge only for the initial automatic appearance; after manual rail dragging, retain the clamped drop X as the anchor for all later vertical attention motion |
| Pet click worked only after Look Me already had focus | Forwarded renderer `mousemove` never arrived in time to disable click-through on the inactive transparent window; add a main-process hit-test for only the current scaled Pet handle and combine it with renderer interactive state |

## Resources
- Chinese dry-eye clinical consensus (2024): https://www.gzzoc.org.cn/sites/zoc.live1.sysucloud2.sysu.edu.cn/files/2025-10/2024_zhongguoganyanlinchuangzhenliaozhuanjiagongshi2024nian.pdf
- TFOS DEWS III management report: https://www.sciencedirect.com/science/article/pii/S0002939425002740
- Local reference archive: `刘看山 IP 形象3D+平面 (1).zip`
- Local reference archive: `看山三视图.zip`
- Local Codex pet state contract: `/Applications/ChatGPT.app/Contents/Resources/skills/skills/.curated/hatch-pet/references/codex-pet-contract.md`
- Local Codex pet animation semantics: `/Applications/ChatGPT.app/Contents/Resources/skills/skills/.curated/hatch-pet/references/animation-rows.md`
- MediaPipe Face Landmarker for Web: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Electron BrowserWindow API: https://www.electronjs.org/docs/latest/api/browser-window

## Visual/Browser Findings
- The flat character is extremely legible at small sizes because the silhouette and black nose carry the identity; this is suitable for a persistent desktop pet.
- The 3D character has a matte, toy-like form but needs more pixels and lighting detail, so it is better suited to onboarding or expanded states than the smallest always-on-top state.
- A red scarf variant can serve as a single restrained status accent without changing the base character.
- Codex Pet is most useful here as a persistent, low-footprint animated state indicator. Its idle/waiting/active/look vocabulary maps naturally to sensing, blink coaching, and distance-break states.
- Visual direction A uses flat outlined 刘看山 plus a compact speech bubble for an explicit three-blink coaching moment; it is the clearest and most instructional direction.
- Visual direction B uses the tactile 3D 刘看山 with a small ambient horizon portal for a 20-second distance break; it is the calmest and most wellness-oriented direction.
- Visual direction C makes flat 刘看山 peek from the screen edge and reveals a narrow privacy/status ribbon on hover; it is the smallest and least disruptive direction.
- All three outputs preserve the supplied character identity, occupy a small fraction of the desktop, and avoid dashboards, medical claims, streaks, or punitive scoring.
- The current 512 × 640 transparent pet is displayed at 260 × 325. Its visible eye center lands at about `(120,98)` inside the displayed pet layer, or `(110,68)` in the 760 × 300 native window.
- The blink should use a fog-white eyelid cover plus one short ink line over that existing eye. Wrapping the image is necessary so the eyelid shares the established breathing transform instead of drifting out of registration.
- Native closed-frame inspection confirmed the overlay registration: the dot eye is fully covered by the eyelid and replaced by a short horizontal line, while the nose and body remain unchanged.
- The user's screenshot shows only the right-side capsule at the physical left edge. This is consistent with the window origin moving far negative while the pet-bounded drag handle at local `x=18..212` is entirely off-screen.
- The pet image, eyelid, and breathing animation already share `.coach-pet-shell`; scaling that wrapper preserves blink registration. The separate drag region must receive the same scale and expose its current bounds to the main process.
- The first `112%` large-pet pass preserved interactions but cropped too much of the ears when anchored at the feet. The current direction uses `41% / 100% / 110%`; only the large visual scales from its vertical center to distribute unavoidable fixed-window clipping, while its drag region remains top-left anchored.
- Final large-pet inspection reports a `286 × 357.5` transformed shell and `18.7 × 20.9` eyelid. The eyelid remains centered over the source eye and the fixed statistics text begins beyond the pet silhouette.
- The generated `76 × 128` transparent tear has a pale-blue tactile finish that remains readable below the eye without changing the 刘看山 source image. Standard renders at 14 px wide; the small preset uses a 24 px source width inside the 41% parent transform, yielding roughly 10 px on screen.
- The right-rail native smoke reaches the primary work area's exact top and bottom while preserving the existing centered parked position; browser checks confirmed statistics and distance controls still complete their original journeys.
