# Progress Log

## Session: 2026-08-12

### Phase 1: Requirements and discovery
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - Read the Product Design routing, context, ideation, browser, and image-generation guidance.
  - Confirmed no saved Product Design context exists.
  - Captured initial scope, assumptions, and medical guardrails.
  - Inspected the repository and the supplied 刘看山 flat and 3D character references.
  - Checked official OpenAI search results and the installed Codex pet contract/animation state definitions.
- Files created/modified:
  - `task_plan.md` (created)
  - `findings.md` (created)
  - `progress.md` (created)

### Phase 2: Product framing
- **Status:** complete
- Actions taken:
  - Defined the local-first sensing and coaching loop.
  - Defined confidence-aware fallback and non-diagnostic boundaries.
  - Played back the design brief and defaults to the user.
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 3: Visual ideation
- **Status:** complete; user selected displayed option 2
- Actions taken:
  - Generated exactly three independent desktop-pet visual directions using the supplied 刘看山 references.
  - Visually checked identity, persistent footprint, hierarchy, and reminder clarity.
  - Resolved the selected visual target to `/Users/zhihu/.codex/generated_images/019ff49a-82e6-7483-93b0-3164310d69d0/exec-103f7f23-c173-4829-9e1b-15273847a4dd.png`.
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

- Generated previews:
  - `/Users/zhihu/.codex/generated_images/019ff49a-82e6-7483-93b0-3164310d69d0/exec-c605dcc7-293d-4873-8394-558c4bb70cef.png`
  - `/Users/zhihu/.codex/generated_images/019ff49a-82e6-7483-93b0-3164310d69d0/exec-103f7f23-c173-4829-9e1b-15273847a4dd.png`
  - `/Users/zhihu/.codex/generated_images/019ff49a-82e6-7483-93b0-3164310d69d0/exec-70151a5b-fa19-4b24-b483-2868237f6737.png`

### Phase 4: Selected-direction specification
- **Status:** complete
- Actions taken:
  - Defined the permission, idle, blink coaching, distance break, paused, and timer-fallback states.
  - Selected Electron + React + TypeScript and a local MediaPipe Face Landmarker pipeline.
  - Produced and inspected the transparent pet, horizon portal, and defocused workspace assets.

### Phase 5: Implementation and verification
- **Status:** complete for the MVP
- Actions taken:
  - Implemented the reducer-based coaching loop and complete-blink signal classifier.
  - Implemented explicit camera opt-in, ephemeral local inference, and confidence-aware timer fallback.
  - Implemented the selected option 2 UI and transparent always-on-top Electron shell with tray and click-through behavior.
  - Captured the implementation at 1440 × 1024, compared the full frame and focused overlay against the selected source, fixed two visual passes, and recorded `app/design-qa.md` as passed.
  - Built the macOS arm64 application and launched the packaged binary successfully.
  - Left physical-camera consent as a user-run acceptance check; automation did not silently grant camera access.

### Phase 6: Session blink statistics
- **Status:** complete
- Actions taken:
  - Added a 15-second stabilization period before displaying estimated frequency.
  - Added rolling one-minute rate, current visible-segment average, and session total calculations.
  - Added a compact readout and expandable statistics capsule to idle mode, including no-camera and temporary face-loss states.
  - Added a one-second face-visibility grace period so a single dropped frame does not reset the current statistics segment.
  - Kept all aggregates in memory and avoided targets, grading, historical persistence, or medical interpretation.

### Phase 7: Daily blink-frequency history
- **Status:** complete
- Actions taken:
  - Fixed the data semantics before editing UI: 00:00-24:00 local-day coverage, one point per minute, missing observation as a gap, and 30-day local retention.
  - Limited persisted data to minute-level blink count and valid face-observation duration; camera frames and exact blink times remain transient.
  - Added safe local loading, three-second batched persistence, midnight/minute splitting, invalid-data recovery, and automatic retention pruning.
  - Added a lazily loaded Recharts curve, three quiet daily summaries, previous/next controls, a 30-date selector, empty-day guidance, and permission-screen history access.
  - Verified date switching, gaps, close/reopen, 00:00-23:59 labels, empty states, and a warning-free console in the running preview.
  - Captured the real 760 × 300 Electron surface, fixed clipped Y-axis labels, rebuilt the arm64 app, and completed a packaged renderer smoke test.

### Phase 8: Native window dragging
- **Status:** complete
- Actions taken:
  - Reproduced the cause from source: the transparent frameless BrowserWindow is movable, but the renderer defines no native drag region and disables mouse events outside interactive controls.
  - Chose a bounded overlay on 刘看山 as the handle so the rest of the transparent 760 × 300 surface continues to click through.
  - Confirmed Electron native drag regions swallow pointer events, which conflicts with hover-driven click-through switching.
  - Added a pointer-captured pet handle and a validated preload/IPC path that moves the BrowserWindow from pointer screen-coordinate deltas.
  - Added a repeatable native drag smoke that fails its process when the pet is not hit or the window coordinates do not change.
  - Passed the source and packaged drag smoke: the window moved from `(376,658)` to `(556,638)` with `passed:true`.

### Phase 9: Mirrored pet blink
- **Status:** complete
- Actions taken:
  - Limited the trigger to complete blink events already confirmed by the local detector; timer fallback and the manual completion button do not animate the pet.
  - Inspected the source asset and established the visible-eye coordinates before changing the renderer.
  - Selected a single 180-220 ms eyelid response, with no sound, body bounce, copy, or additional product state.
  - Moved the existing breathing transform to a shared pet wrapper and replayed the eyelid by remounting it on each `blinkCount` change.
  - Paused the QA-only loop at its closed midpoint and inspected native pixels: the eye cover and short ink line align with the source eye without affecting the nose or body.
  - Passed typecheck, 20 unit tests, 4 Sites tests, production/Sites builds, arm64 packaging, and both source and packaged native drag smokes.

### Phase 10: Off-screen drag recovery
- **Status:** complete
- Actions taken:
  - Confirmed from the screenshot that the 760 px native surface moved left of the display until only the right-side capsule remained visible.
  - Traced the unrecoverable state to an unconstrained main-process `setPosition` path; the only drag handle is the left-side pet silhouette.
  - Quit the stranded instance through its own macOS application menu and relaunched the same packaged app; one centered, responsive permission window is visible again.
  - The first expanded drag smoke confirmed horizontal clamping, then failed only its top-edge expectation because macOS independently keeps the BrowserWindow origin below the menu bar; aligned the app rule with that native behavior.
  - Passed the corrected source drag smoke: ordinary movement works, left/top clamps at `(-18, 33)`, and right/bottom clamps at `(1300, 740)` for the primary `1512 × 949` work area.
  - Built the arm64 app and passed the same expanded packaged drag smoke with exact edge coordinates.
  - Relaunched one normal final instance; the user enabled local camera detection while final Computer Use checks were running, so two synthetic button clicks were cancelled rather than competing with the live session.
  - Confirmed one packaged main process remains (`PID 43194`) and its live renderer is responsive in the camera-driven three-blink coaching state.

### Phase 11: Adjustable pet size
- **Status:** complete
- Actions taken:
  - Confirmed the user wants pet-only sizing, with the existing panels and controls unchanged.
  - Chose three quiet tray presets and local persistence; no new control is added to the permanent capsule.
  - Traced the coupled geometry: the pet and eyelid share one wrapper, while the renderer drag region and main-process edge clamp currently use fixed standard-size bounds.
  - Added renderer-local size persistence, tray radio commands, CSS scale tokens, synchronized eyelid scaling, and validated per-drag handle geometry at the preload/main-process boundary.
  - Passed source native drag and four-edge clamp smokes for all three final sizes: handle bounds are `159.08 × 188.60`, `194 × 230`, and `213.4 × 253` respectively.
  - Started a deterministic 760 × 300 native visual-QA surface with statistics open and the mirrored blink loop enabled for three-size pixel comparison.
  - First three-size pixels showed that a bottom-anchored `112%` large pet pushed the visible ears too far beyond the 300 px native surface; revised the large token to `110%` with a centered vertical origin while keeping small bottom-anchored.
  - Final large-pet pixels measure `286 × 357.5` within the transparent surface; the visible eye line stays registered, metric content remains unobstructed, and the reduced top crop preserves the character silhouette.
  - Confirmed the old packaged app was actively detecting at `5 次/分`, then quit it through its own macOS application menu before replacing the bundle.
  - Built the final arm64 bundle and passed packaged small, large, and standard drag/edge smokes in sequence, restoring standard last.
  - Started one final normal instance at the persisted standard size; direct `SystemUIServer` tray inspection timed out and was abandoned rather than repeated.
  - A bounded retry using the discovered `SystemUIServer` display name also timed out; stopped menu-bar automation and switched the persistence check to an isolated packaged profile.
  - Confirmed the final normal instance was detecting at `15 次/分`, quit it cleanly, and launched the packaged renderer with an isolated temporary user-data profile for restart persistence testing.
  - Set the isolated packaged profile to large, fully exited, relaunched, and confirmed startup restored `large` with a `213.4 × 253` drag region.
  - Stopped the isolated app; recursive cleanup of its bounded `/tmp` profile was rejected by the safety layer, so it was left for normal OS cleanup rather than bypassed.
  - Rebuilt the final arm64 package after the visual correction and confirmed only one normal packaged instance remains, restored at standard size.

### Phase 12: Distant blink reliability
- **Status:** complete for implementation; physical-distance acceptance remains with the user
- Actions taken:
  - Reproduced the failure with an attenuated bilateral close signal (`0.36 / 0.39`) plus a strong EAR drop; the original detector failed to emit a blink.
  - Added a dual-evidence path that accepts the attenuated blendshape signal only when EAR falls below `62%` of the learned open-eye baseline.
  - Kept the ordinary close threshold, bilateral balance, 45–800 ms duration, wink rejection, and long-closure rejection unchanged.
  - Raised requested capture from `640 × 480 / 15 FPS` to `1280 × 720 / 24 FPS`, runs inference at up to about 20 FPS, and returned face detection/presence confidence from `0.55` to the model's `0.5` default.
  - Confirmed the new distant-signal test fails before the fix and passes after it; added a weak-noise counter-test that remains rejected.
  - Passed 22 unit tests, typecheck, production/Sites builds, 4 Sites tests, and the final arm64 package.
  - Quit the old bundle cleanly, launched one rebuilt instance, enabled local detection, and observed the live readout progress from collection to `13 次/分` without exposing or saving camera frames.

### Phase 13: Tray chart visibility
- **Status:** complete
- Actions taken:
  - Added a checked “显示统计图表” item to the macOS tray menu; it opens or hides only the daily frequency curve and does not stop history collection.
  - Persisted chart visibility locally and synchronized the tray checkbox with the in-app “查看历史曲线” and close controls.
  - Added an initialization queue so a tray command issued immediately at startup is applied after the renderer registers its settings channel.
  - Passed a strict source and packaged smoke: tray show, panel render, persisted `true`, in-panel close, tray uncheck, persisted `false`.
  - Passed typecheck, 22 unit tests, production/Sites builds, 4 Sites tests, syntax checks, and final arm64 packaging.
  - Launched one final packaged instance. The user resumed live camera detection during UI acceptance, so Computer Use stopped rather than competing with the active session.

### Phase 14: Half-size small preset
- **Status:** complete
- Actions taken:
  - Interpreted “再小一倍” as halving the existing small preset from `82%` to `41%`; standard and large remain `100% / 110%`.
  - Changed the shared scale token only, so the pet image, eyelid, breathing motion, and native drag region remain registered.
  - The first native smoke used the old fixed `(100,80)` probe, which landed 2.5 px beyond the new small handle; changed the smoke to press the center of the current transformed handle instead of weakening production hit geometry.
  - Passed source and packaged small-size drag/edge smokes with a `79.54 × 94.30` handle, ordinary movement `(376,658) → (556,638)`, and exact four-edge recovery.
  - Rebuilt the arm64 app and performed a read-only native pixel check: the pet is approximately `106.6 × 133.3` while the permission card and controls remain unchanged and unobstructed.
  - Launched one final packaged instance with the persisted small preset; camera permission was left untouched for the user.

### Phase 15: Whole-display dry-eye attention rail
- **Status:** complete for delivery; physical live-camera acceptance remains with the user
- Actions taken:
  - Added a pure attention controller with explicit 10-second hidden, 15-second descent, 5-second bottom cry, two 5.5-second Y-axis flight rounds, 2-second bottom rest, 1.6-second blink recovery, and 25-second quiet cooldown.
  - Gated the controller on detector-ready plus face-visible; face loss resets escalation, while distance, pause, statistics, history, tray reveal, and dragging freeze automatic movement.
  - Extended the sandboxed bridge so Electron positions the existing 760 × 300 native window on the current display's right rail; tray reveal returns it to the normal card placement for 15 seconds.
  - Generated and chroma-keyed `kanshan-tear.png`, aligned two raster tear instances below the visible eye, and increased their source size under the 41% small preset so the rendered tear remains about 10 px wide.
  - Added static lower-right crying for Reduce Motion instead of full-display flight.
  - Passed 6 new controller tests plus the existing 22 tests, typecheck, renderer build, native attention-position smoke, small-pet drag smoke, history synchronization smoke, and secure renderer smoke.
  - Browser-verified the crying alignment, statistics expand/collapse, distance prompt, visible Skip action, return to idle, and a warning-free console.
  - Passed the final full suite: 28 unit tests, TypeScript, production/Sites build, 4 Sites worker tests, and arm64 packaging.
  - Passed the rebuilt packaged attention, history synchronization, small-pet drag/edge, and secure-renderer smokes.
  - Stopped the exact older packaged process before final verification to avoid shared-profile interference, then launched exactly one rebuilt normal instance (`PID 52080`).

### Phase 16: Remove manual blink completion
- **Status:** complete
- Actions taken:
  - Removed the “眨好了” button, its `COMPLETE_BLINK_PROMPT` reducer event, and the now-unused compact-button CSS.
  - Added a 6-second auto-dismiss only when sensing is unavailable, so timer-only and face-lost prompts cannot become stuck.
  - Kept camera-available coaching unchanged: it remains open until three detector-confirmed blinks arrive.
  - Added two reducer tests covering fallback dismissal and camera-confirmed waiting; the complete suite now passes 30/30.
  - Browser-verified the frozen blink card contains no buttons or leftover interactive hit area, and a live fallback prompt returns to idle after 6.5 seconds with no console warnings/errors.
  - Passed TypeScript, production/Sites build, 4 Sites tests, arm64 packaging, and packaged renderer/attention/history smokes; launched exactly one rebuilt instance (`PID 97392`).

### Phase 17: Optional persistent pet
- **Status:** complete
- Actions taken:
  - Added a checked “看山常驻” tray setting, defaulting off and persisting its value in local storage.
  - Kept the attention controller unchanged; only hidden and cooldown frames become a visible, tear-free `resting` pose at the upper-right while the setting is enabled.
  - Preserved descent, crying, rampage, blink recovery, reduced-motion behavior, and all manual cards/panels.
  - Added four focused presentation tests and a packaged command/persistence smoke covering both on and off states.
  - Passed 34 unit tests, TypeScript, production/Sites builds, 4 Sites tests, browser regression inspection, arm64 packaging, and packaged persistence/renderer/attention/history/drag smokes.
  - Stopped the exact previous bundle before packaging and launched exactly one rebuilt normal instance (`PID 11251`).

### Phase 18: Secondary-display small-pet dragging
- **Status:** complete
- Actions taken:
  - Reproduced the report on the real `1920 × 1080` secondary display with negative desktop coordinates and the persisted 41% pet preset.
  - Confirmed the visible small pet and its drag region had no intersection: the pet scaled upward from its feet while the drag region scaled downward from its top edge.
  - Changed only the drag region's transform origin to the bottom edge in parked and rail states, keeping its size and native clamp geometry unchanged.
  - Upgraded the native smoke to press inside the visible pet/handle overlap rather than the old invisible handle center, and added a secondary-display persistent-rail path.
  - The exact secondary rail test changed from `dragHandle:false`, `visibleOverlap:false`, `moved:false` to a roughly `79 × 82 px` overlap with `dragHandle:true`, `moved:true`, `passed:true`.
  - Passed 34 unit tests, TypeScript, production/Sites builds, 4 Sites tests, packaged parked/rail drag, persistence, attention, history, and renderer smokes.
  - Restored the user's enabled “看山常驻” preference after testing and launched exactly one rebuilt normal instance (`PID 31362`).

### Phase 19: User-positioned attention rail
- **Status:** complete
- Actions taken:
  - Traced the right-edge snap to the native drag-end branch, which unconditionally replaced the user's X coordinate with `displayRight - windowWidth` whenever attention mode was on the rail.
  - Kept the display edge only as the initial automatic rail location; releasing a rail drag now records the clamped dropped X coordinate instead of moving the window again.
  - Later descent, crying, rampage, and recovery frames reuse that recorded X and update only Y. Moving a parked window to a different display clears an obsolete anchor safely.
  - Strengthened the secondary-display rail smoke to assert both the immediate drop and a later rampage frame preserve the same X coordinate.
  - The packaged 41% test now stays at `X=-940` after release and after the next Y update, with `dropRetained:true`, `anchorRetained:true`, and `passed:true`.
  - Passed regular parked drag/edge recovery, 34 unit tests, TypeScript, production/Sites builds, 4 Sites tests, packaging, and all packaged persistence/attention/history/renderer smokes.
  - Preserved the enabled “看山常驻” preference and launched exactly one rebuilt normal instance (`PID 42924`).

### Phase 20: Effective screen-facing duration
- **Status:** complete
- Actions taken:
  - Defined “有效看屏” as camera-ready plus confidently face-visible time, explicitly as a local proxy rather than gaze tracking.
  - Reused the existing per-minute `observedMs` aggregates; paused, distance-break, no-face, and low-confidence intervals do not accumulate.
  - Added “今日有效看屏” to the compact statistics card and “有效看屏” to the selected-day history summary and minute tooltips.
  - Added second/minute/`H:MM` formatting tests; the complete suite now passes 35/35.
  - Browser-verified a long `7:50 小时` value, an empty-date `0 秒` value, date switching, and both panels without horizontal or vertical overflow.
  - Packaged history smoke found the new label and the current stored `1:34 小时` value with `passed:true`.
  - Preserved local-only 30-day aggregate retention, rebuilt the arm64 app, and launched exactly one final instance (`PID 56156`).

### Phase 21: Synchronized blink and screen-facing curves
- **Status:** complete
- Actions taken:
  - Reproduced the misleading shape in the data transformation: a partial minute was multiplied to a 60-second rate, so 4 blinks observed over 15 seconds appeared as 16; the smoothed line also obscured the discrete minute-count meaning.
  - Added a failing data-contract test first, then changed the upper series to actual per-minute blink counts with fully unobserved minutes left as gaps.
  - Added a synchronized lower series for effective screen-facing seconds with a fixed 0–60-second Y scale; both tracks reuse the existing local minute aggregates.
  - Kept both tracks inside the existing `620 × 284` history card, used separate quiet colors and one shared bottom time axis, and changed both lines to direct linear segments.
  - Browser-verified a populated `7:50 小时` date, an empty date, date switching, two accessible track labels, no viewport overflow, and no console warnings or errors.
  - Passed 35/35 unit tests, TypeScript, production/Sites builds, 4 Sites tests, arm64 packaging, and a packaged smoke that found both labels and both rendered curve paths with `passed:true`.
  - Launched exactly one rebuilt normal instance (`PID 2024`).

### Phase 22: Pet-body settings shortcut
- **Status:** complete
- Actions taken:
  - Made the existing visible Pet drag region respond to a short left-click as well as dragging; no extra button or settings panel was added.
  - Added a 6 px movement threshold with focused tests: a short release opens settings, while crossing the threshold becomes a drag and suppresses the click action.
  - Exposed one narrow renderer-to-main command that opens the same Electron `Menu` object already attached to the macOS tray, preserving all checked states and actions.
  - Native smoke verified the click kept the window fixed, opened settings exactly once, and exposed all seven current menu entries; a following drag moved the window and did not reopen settings.
  - Re-ran packaged edge-clamp dragging, rebuilt the arm64 app, and launched exactly one final normal instance (`PID 42770`).

### Phase 23: Stable size changes and repeated Pet settings
- **Status:** complete
- Actions taken:
  - Reproduced both reports in one native flow: after moving the window to `(466, 598)`, selecting a size called `showWindow()` and reset it to `(376, 658)`; the same action also replaced the `Menu` object while its popup was active.
  - Removed the positioning path from size selection so only the renderer size changes and the existing BrowserWindow coordinates remain untouched.
  - Deferred tray/settings menu rebuilding while a Pet-opened popup is active, then applied one pending refresh from the popup close callback.
  - Strengthened the native smoke to move the window, click Pet, change size, confirm unchanged coordinates, close, click Pet a second time, and then drag without another menu opening.
  - Made preference restoration read the renderer's actual persisted size rather than the main-process startup default, so validation does not overwrite the user's preference.
  - Reconfirmed the complete packaged flow from the user's `small` preset through a temporary `large` selection and back to `small`, then launched exactly one final instance (`PID 88279`).

### Phase 24: Inactive Pet settings hit testing
- **Status:** complete
- Actions taken:
  - Reproduced the report with Chrome focused: the same Pet coordinate opened settings while Look Me was active but produced no accessibility-tree change while Look Me was inactive.
  - Traced the failure to the renderer-only hover bridge: the transparent BrowserWindow stayed in `setIgnoreMouseEvents(true)` before an inactive-window click reached React.
  - Added a 50 ms native cursor hit-test for the scaled Pet drag handle. Only that handle disables click-through; the rest of the 760 × 300 transparent window still passes clicks to the application below.
  - Kept renderer-owned interactive cards and buttons authoritative by combining their existing pointer state with the Pet hit-test state.
  - Strengthened the native smoke to start unfocused, assert the scaled handle is natively hittable, click twice across a size change, and retain drag behavior.
  - Passed 44 unit tests, TypeScript, production/Sites builds, 4 Sites tests, source and packaged Pet-settings smokes, and a real packaged coordinate click with Chrome frontmost.
  - Restored the normal packaged app and left exactly one instance running (`PID 74029`).

### Phase 25: Right-click Pet settings
- **Status:** complete
- Actions taken:
  - Changed the Pet interaction contract so a left-button release never opens settings; left press and movement remain the drag gesture.
  - Added a Pet `contextmenu` handler that prevents the browser menu and opens the existing shared native tray menu.
  - Upgraded the native smoke to assert a short left click does nothing, two right clicks can open the menu across a size change, and a later left drag moves without opening settings.
  - Passed 44 unit tests, TypeScript, production/Sites builds, 4 Sites tests, and the source native settings smoke.

### Phase 26: Immediate camera-settings persistence
- **Status:** complete
- Actions taken:
  - Removed the time-range “保存” button and its now-unused CSS.
  - Kept the two switches immediate, and added automatic application whenever the current start/end pair is valid and differs from the persisted settings.
  - Invalid time pairs remain visible with the existing inline error and are not written until corrected; the other endpoint is never changed implicitly.
  - Passed 44 unit tests, TypeScript, production/Sites builds, 4 Sites tests, and rebuilt the arm64 app.
  - In the packaged UI, confirmed no Save control exists, toggled the schedule, closed and reopened settings to verify the change persisted, then restored the user's enabled schedule.

### Phase 27: Camera time-control visual integration
- **Status:** complete
- Actions taken:
  - Replaced both native time fields with four accessible hour/minute selects grouped into two compact time capsules.
  - Matched the existing camera panel with mist-white gradients, 12 px rounding, deep-teal tabular numerals, quiet hover fills, and the established teal focus ring.
  - Kept the central clock and fading connector as the single interval cue; removed native AM/PM, steppers, and the mismatched system field chrome.
  - Preserved exact minute selection, same-day validation, and valid-pair immediate persistence.
  - Passed 44 unit tests, TypeScript, production/Sites build, arm64 packaging, and real packaged-window visual/accessibility inspection with no overflow.

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Product Design context preflight | Local plugin state | Existing context or explicit missing state | Missing state reported cleanly | Pass |
| TypeScript | `npm run typecheck` | No errors | No errors | Pass |
| Coach, blink signal, session statistics, daily history, effective screen-facing duration, and pet attention tests | `npm test` | State/signal plus duration formatting, minute rates, gaps, midnight, retention, malformed storage, rail timing, persistence mapping, and fallback dismissal pass | 35/35 pass | Pass |
| Renderer + Sites build | `npm run build` | Client and Sites artifacts emitted | Completed | Pass |
| Sites worker tests | `npm run test:sites` | Template contract preserved | 4/4 pass | Pass |
| Browser interactions | Skip, timer-only, manual blink completion | Each returns to idle | Completed | Pass |
| Browser console | Final selected state | No errors or warnings | None | Pass |
| Design QA | Whole frame + focused comparison | No P0/P1/P2 mismatches | Passed | Pass |
| Source Electron smoke | Demo state | Desktop bridge and 760 × 300 window | `isDesktop=true` | Pass |
| Packaged Electron smoke | `Look Me.app` demo state | Local protocol, preload, renderer load | `isDesktop=true` | Pass |
| Daily-history browser interaction | Curve demo and empty dates | Switch 30 dates, previous/next, close/reopen, permission access | Completed; no console warnings/errors | Pass |
| Daily-history native pixels | 760 × 300 Electron capture | Pet overlap, readable axes, controls within bounds | Passed after Y-axis margin correction | Pass |
| Effective screen-facing duration | Unit tests, browser date switching, and `LOOK_ME_HISTORY_SMOKE=1` | Format exact observed time, show today/selected-day values, and find the packaged metric | `30 秒`, `45 分钟`, `1:05 小时`; browser values fit; packaged current value `1:34 小时`, `passed:true` | Pass |
| Synchronized daily curves | Unit data contract, browser pixels/date switch, and packaged `LOOK_ME_HISTORY_SMOKE=1` | Upper track shows actual minute blink counts; lower track shows 0–60 screen-facing seconds; both remain aligned and independently scaled | Two labeled tracks, two rendered curve paths, populated and empty states verified; `passed:true` | Pass |
| Pet-body settings shortcut | Unit gesture tests and `LOOK_ME_PET_SETTINGS_SMOKE=1` | Short click opens the existing settings menu without moving; drag moves without opening settings | Menu opened once with all current entries; click position unchanged; drag moved; `passed:true` | Pass |
| Stable size and repeat settings | Expanded native Pet-settings smoke | Size change preserves custom coordinates; current popup menu survives the command; the next Pet click opens settings again | `(466,598)` retained through size change; first menu object retained; second click opened; later drag moved; preference restored; `passed:true` | Pass |
| Inactive Pet settings click | Unfocused source/package smoke plus Chrome-frontmost coordinate click | Scaled Pet handle receives the first click while transparent pixels remain click-through | Smoke reports `startedUnfocused:true`, `petHitTestEnabled:true`, `passed:true`; real click displayed the full settings menu | Pass |
| Final stable-settings instance | Exact packaged process path | One rebuilt normal app remains with the user's small preset restored | PID `88279`; count `1` | Pass |
| Final Pet-settings instance | Exact packaged process path | One rebuilt normal app remains after click and drag smokes exit | PID `42770`; count `1` | Pass |
| Final synchronized-curves instance | Exact packaged process path | One rebuilt normal app remains after all smokes exit | PID `2024`; count `1` | Pass |
| Native pet dragging | `LOOK_ME_DRAG_SMOKE=1` in source and packaged app | Pet handle receives input and BrowserWindow coordinates change | `(376,658)` → `(556,638)`, `passed:true` | Pass |
| Mirrored pet blink pixels | QA loop paused at the closed midpoint | Eye becomes a short line without pet-layer drift | Aligned on the visible eye; nose and body unchanged | Pass |
| Final packaged renderer | `LOOK_ME_SMOKE=1 LOOK_ME_DEMO=1` | Secure local renderer, preload bridge, desktop shell, and active drag region load | `isDesktop=true`, `mode=distance`, persisted small drag bounds `79.54 × 94.30` | Pass |
| Native edge recovery | Expanded source and packaged `LOOK_ME_DRAG_SMOKE=1` | Ordinary movement plus four work-area edges keep the pet handle recoverable | Left/top `(-18,33)`; right/bottom `(1300,740)`; `passed:true` | Pass |
| Adjustable pet sizes | Source and packaged native smokes at small, standard, and large | Pet, eyelid, and handle scale together while fixed UI and edge recovery remain stable | Current scales `41% / 100% / 110%`; all verified sizes report `passed:true` | Pass |
| Pet-size persistence | Isolated packaged profile, set large, quit, relaunch | Selected size and matching drag geometry restore locally | Restored `large` and `213.4 × 253` handle bounds | Pass |
| Distant blink signal | Attenuated bilateral peak plus strong EAR drop | Emit one complete blink after reopening | Failed before fix; passes after fix | Pass |
| Distant weak-noise guard | Same attenuated peak without a strong EAR drop | Do not emit a blink | Rejected | Pass |
| Rebuilt live detector | Packaged app with local camera detection enabled | Face becomes visible and blink statistics collect | Readout reached `13 次/分`; one instance remains | Pass |
| Tray chart visibility | Source and packaged `LOOK_ME_HISTORY_SMOKE=1` | Tray shows chart; in-panel close hides it; checkbox and local value stay synchronized | All six assertions `true`; `passed:true` | Pass |
| Half-size small pet | Source and packaged small-size drag smoke plus native pixels | Small is half its previous size; pet, eyelid, handle, card, and edge recovery remain aligned | `41%`; handle `79.54 × 94.30`; source/package `passed:true` | Pass |
| Attention controller timing | 6 deterministic Vitest cases | Hidden/descent/cry/rampage/recovery/cooldown, sensing loss, panel pause, and Reduce Motion follow the approved boundaries | 6/6 pass; complete suite 30/30 | Pass |
| Whole-display native rail | `LOOK_ME_ATTENTION_SMOKE=1` on a `1512 × 949` work area | Right-aligned window reaches work-area top and bottom, then restores parked placement | Top `(752,33)`, bottom `(752,682)`, parked `(376,658)`, `passed:true` | Pass |
| Attention browser interaction | Crying preview plus idle controls | Tear aligns below the eye; statistics, distance, Skip, and idle return remain interactive | All visible/click assertions true; no warnings/errors | Pass |
| Blink prompt without manual completion | Frozen browser state plus 6.5-second live fallback | No button or empty hit area; fallback returns to idle while camera mode still requires real blinks | Button count `0`; idle visible after timeout; no warnings/errors | Pass |
| Persistent pet setting | `LOOK_ME_PERSISTENCE_SMOKE=1` in the packaged app | Tray command reaches the renderer, both values persist locally, and the original preference is restored | Enabled/stored, disabled/stored, and restored assertions all `true`; `passed:true` | Pass |
| Secondary-display persistent rail drag | `LOOK_ME_RAIL_DRAG_SMOKE=1 LOOK_ME_DRAG_DISPLAY=secondary LOOK_ME_PET_SIZE=small` | A press on the visible 41% pet hits its drag region, retains its drop, and keeps that X during later Y motion | `79 × 82 px` visible overlap; drop `(-940,175)`; later frame `(-940,-72)`; both anchor assertions true; `passed:true` | Pass |
| Final single instance | Exact packaged process path | One rebuilt normal app remains after all smokes exit | PID `42924`; count `1` | Pass |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-08-12 | The first 48-frame blink capture exceeded the command return window and its resumable session id was not retained | 1 | Stop the long capture approach; use bounded single-frame captures at known animation phases |
| 2026-08-12 | A macOS region capture using negative secondary-display coordinates returned a blank image | 1 | Pause the CSS animation through the local DevTools protocol and capture the renderer surface directly |
| 2026-08-12 | Native drag verification runtime did not expose a global `WebSocket` | 1 | Use the project's installed `ws` module in the same Node-based Computer Use session |
| 2026-08-12 | The project did not actually contain a directly importable `ws` module | 2 | Avoid adding a test-only dependency; temporarily observe Electron's native `move` event during Computer Use drag verification |
| 2026-08-12 | Computer Use could not target the drag point when Electron opened on a negative-coordinate secondary display | 1 | Move focus to the primary display, relaunch the same test window there, and perform the native drag once |
| 2026-08-12 | Computer Use safety policy disallowed targeting the Codex app to reposition the cursor | 1 | Use a neutral Finder title-bar point on the primary display instead; do not bypass the restriction |
| 2026-08-12 | Finder had no available window for neutral cursor positioning | 1 | Stop cross-app cursor attempts; make the temporary drag-smoke mode launch Look Me on the primary display itself |
| 2026-08-12 | Direct Computer Use drag on the primary-display pet produced no native `move` event | 1 | Observe pointer-event activation, prime the hover path, then retry once from the confirmed active drag region |
| 2026-08-12 | Passing screen coordinates to Computer Use was rejected after the API added the window origin a second time | 1 | Confirm coordinates are window-relative; stop coordinate experiments and inspect Electron's loaded drag-region style and bounds |
| 2026-08-12 | Computer Use's cached `Electron` target reported no available windows after the renderer drag implementation changed | 1 | Rediscover the running app identifier, then target that exact process for one fresh drag attempt |
| 2026-08-12 | The generic Electron bundle id was shared by several development apps, and the full framework path resolved to Electron's default app | 1 | Stop targeting the shared development runtime; package and verify the uniquely identified `com.lookme.coach` app |
| 2026-08-12 | ScreenCaptureKit returned an invalid-parameter error after targeting the packaged transparent window image | 1 | Skip post-action capture and send one coordinate drag to the already identified unique Look Me window; use the native `move` log as evidence |
| 2026-08-12 | First repeatable renderer-input drag smoke completed with `moved:false` | 1 | Focus the smoke window, wait for renderer effects, inspect the actual hit target, and log drag IPC phases before changing production logic again |
| 2026-08-12 | Multi-file cleanup patch failed its local hunk-format validation before editing | 1 | Split the cleanup into small per-file patches; no source changes were applied by the failed patch |
| 2026-08-12 | Daily-history demo object widened `version: 1` to `number` under strict TypeScript | 1 | Type the memoized result as `BlinkHistory`; keep the version literal contract |
| 2026-08-12 | Recharts pushed the initial renderer bundle above Vite's 500 kB warning | 1 | Lazy-load the history panel so chart code stays out of the persistent pet's startup chunk |
| 2026-08-12 | Native date input did not accept deterministic keyboard selection in the embedded browser | 1 | Replace it with a bounded native select containing the exact 30 retained dates |
| 2026-08-12 | npm ETARGET for `@asamuzakjp/css-color@^6.0.5` from `jsdom@30.0.1` dependency chain | 1 | Drop `jsdom`; UI tests will not require a DOM environment |
| 2026-08-12 | Sandboxed Electron ESM preload did not expose `window.lookMe` | 1 | Switch to `preload.cjs` and confirm the packaged renderer reports desktop mode |
| 2026-08-12 | Electron Builder repeated a slow remote runtime download | 1 | Use the matching runtime already installed in `node_modules/electron/dist` |
| 2026-08-12 | System `python` command was unavailable and system `python3` lacked Pillow for chroma-key cleanup | 2 | Use the bundled Codex Python runtime with Pillow and the image skill's chroma-key removal script |
| 2026-08-12 | macOS clamped the requested hidden rail window Y coordinate to the work-area top | 1 | Keep the native window shown for camera continuity and hide the pet layer in healthy/cooldown phases instead of moving the window above the menu bar |
| 2026-08-12 | The first packaged history smoke disagreed across panel, tray, and storage while the older normal app was still using the same packaged profile | 1 | Terminate the exact older Look Me process, revert the speculative startup-channel change, rebuild, and rerun; all six packaged history assertions passed |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | The whole-display attention rail is implemented and deterministically verified |
| Where am I going? | Build the final bundle, leave exactly one instance running, and hand off live-camera acceptance |
| What's the goal? | Design a privacy-first dry-eye blink coach as a persistent desktop pet |
| What have I learned? | See `findings.md` |
| What have I done? | Added sensing-gated descent, crying, rampage, blink recovery, reduced motion, native display movement, and a real tear asset without changing the detector or stored data |
