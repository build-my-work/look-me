# Task Plan: Dry-eye blink coach desktop app

## Goal
Design and build a privacy-first desktop blink and distance-break coach whose persistent form is a low-distraction pet, using the user's selected visual direction.

## Current Phase
Phase 14 complete

## Phases

### Phase 1: Requirements and discovery
- [x] Capture the user's stated product goal and constraints
- [x] Inspect the existing repository and nearby design context
- [x] Resolve what “Codex Pet” means visually and behaviorally
- [x] Record medical/product guardrails
- **Status:** complete

### Phase 2: Product framing
- [x] Define the smallest useful user loop
- [x] Define blink detection, reminder, privacy, and failure-state behavior
- [x] Play back the brief and defaults
- **Status:** complete

### Phase 3: Visual ideation
- [x] Generate exactly three distinct desktop-pet directions
- [x] Verify each direction preserves the brief
- [x] Ask the user to select or refine one direction
- [x] Resolve option 2 as the selected visual target
- **Status:** complete

### Phase 4: Selected-direction specification
- [x] Convert the selected visual direction into flows, states, and component rules
- [x] Define the implementation architecture and validation plan
- [x] Produce the pet, horizon, and preview-background assets
- **Status:** complete

### Phase 5: Implementation and verification
- [x] Implement only after the user selects a visual target
- [x] Implement the local blink detector and confidence-aware coach state machine
- [x] Implement the transparent always-on-top Electron window and renderer
- [x] Run unit, type, build, browser-interaction, native smoke, and design-QA checks
- [x] Verify camera opt-in/fallback wiring, reminder flows, and accessible controls
- [ ] Run a user-consented physical-camera acceptance pass (requires interactive macOS permission)
- **Status:** complete for the MVP; physical-camera consent remains a manual acceptance check

### Phase 6: Session blink statistics
- [x] Define a non-diagnostic, non-scoring statistics scope
- [x] Calculate rolling one-minute rate, visible-segment average, and session total
- [x] Add compact expandable statistics to the persistent idle companion
- [x] Verify collection, face-loss, empty, expand/collapse, build, and packaged smoke paths
- **Status:** complete

### Phase 7: Daily blink-frequency history
- [x] Define and test a compact 30-day local minute-aggregate format
- [x] Record blink counts and valid face-observation duration into local minute buckets
- [x] Add a single daily frequency curve with gaps for unobserved minutes
- [x] Add previous/next day controls and an explicit 30-day date selector
- [x] Verify persistence semantics, date switching, empty states, builds, browser behavior, and packaged smoke
- **Status:** complete

### Phase 8: Native window dragging
- [x] Add a bounded native drag region over the pet silhouette
- [x] Integrate the drag region with Electron's click-through switching
- [x] Verify drag input, button interaction boundaries, builds, native movement, and packaged smoke
- **Status:** complete

### Phase 9: Mirrored pet blink
- [x] Move the existing breathing transform to a stable pet wrapper
- [x] Replay one restrained eyelid animation for every detected complete blink
- [x] Verify alignment, repeat triggering, reduced-motion behavior, builds, and packaged smoke
- **Status:** complete

### Phase 10: Off-screen drag recovery
- [x] Recover the currently stranded native window without creating a second instance
- [x] Clamp native drag movement so the complete pet handle stays inside a display work area
- [x] Verify live camera state, free dragging, edge clamping, display-aware placement, build, and packaged app
- **Status:** complete

### Phase 11: Adjustable pet size
- [x] Add small, standard, and large pet-only presets to the tray menu
- [x] Persist the selected preset locally and restore it on launch
- [x] Scale the pet, eyelid, and native drag handle together without changing cards or controls
- [x] Keep display-edge clamping correct for every preset
- [x] Verify all three native sizes, command switching, persistence, dragging, build, and packaged app
- **Status:** complete; direct macOS menu-bar clicking remains a manual UI acceptance check

### Phase 12: Distant blink reliability
- [x] Reproduce the attenuated distant-face blink signal in a failing test
- [x] Improve capture detail and temporal sampling without adding a new dependency
- [x] Fuse weaker bilateral blendshape peaks only with strong EAR confirmation
- [x] Verify ordinary blinks, winks, long closures, and weak noise remain correctly classified
- [x] Rebuild, package, relaunch one instance, and hand off a physical-distance acceptance check
- **Status:** complete for implementation; the user must perform the final physical-distance acceptance movement

### Phase 13: Tray chart visibility
- [x] Add a checked tray setting for showing or hiding the daily statistics chart
- [x] Keep tray, in-app open/close controls, and local persistence synchronized
- [x] Verify show, hide, persisted values, build, package, and one final instance
- **Status:** complete

### Phase 14: Half-size small preset
- [x] Reduce only the small pet preset from 82% to 41%
- [x] Keep the pet, eyelid, and native drag handle scaled together
- [x] Verify small-size pixels, dragging, edge recovery, packaging, and one final instance
- **Status:** complete

### Phase 15: Whole-display dry-eye attention rail
- [x] Gate escalation on confident face sensing and pause it for manual panels and dragging
- [x] Implement hidden, descending, crying, two-round rampage, recovery, and cooldown timing as a tested state machine
- [x] Move the native window along the current display's right edge without changing the existing 760 × 300 card surface
- [x] Add a generated transparent tear asset, small-size legibility, and reduced-motion behavior
- [x] Package, run packaged attention/history/drag/renderer smokes, and relaunch exactly one final app instance
- [ ] Complete the physical live-camera blink acceptance check with the user
- **Status:** complete for delivery; physical live-camera acceptance remains with the user

### Phase 16: Remove manual blink completion
- [x] Remove the “眨好了” button and its dead reducer event/CSS
- [x] Auto-dismiss timer-only or face-unavailable prompts after 6 seconds
- [x] Keep camera-available prompts waiting for three detector-confirmed blinks
- [x] Verify unit behavior, browser pixels, full builds, packaged smokes, and one final instance
- **Status:** complete

### Phase 17: Optional persistent pet
- [x] Add a persistent “看山常驻” checkbox to the tray
- [x] Keep healthy and post-blink quiet phases visible at the current display's upper-right when enabled
- [x] Preserve descent, tears, rampage, recovery, manual panels, and the default auto-hide behavior
- [x] Verify state mapping, local persistence, builds, packaged smokes, and one final instance
- **Status:** complete

### Phase 18: Secondary-display small-pet dragging
- [x] Reproduce the 41% persistent rail pose on the actual secondary display
- [x] Make the drag region scale from the same bottom edge as the visible pet
- [x] Strengthen native drag QA to begin inside the visible pet/handle overlap
- [x] Verify parked and rail dragging, negative display coordinates, packaging, and one final instance
- **Status:** complete

### Phase 19: User-positioned attention rail
- [x] Reproduce the forced right-edge snap after releasing a rail drag
- [x] Preserve the dropped X coordinate as the user's vertical rail anchor
- [x] Keep the initial automatic upper-right appearance and multi-display bounds
- [x] Verify later Y-axis attention updates do not change the selected X coordinate
- [x] Rebuild, run packaged smokes, and relaunch one final instance
- **Status:** complete

### Phase 20: Effective screen-facing duration
- [x] Define duration as a conservative face-visible proxy rather than gaze tracking
- [x] Reuse exact minute-level observation time and exclude paused and distance-break intervals
- [x] Show today's duration in compact statistics and the selected day's duration in history
- [x] Verify formatting, date switching, browser pixels, builds, packaged history smoke, and one final instance
- **Status:** complete

### Phase 21: Synchronized blink and screen-facing curves
- [x] Reproduce the misleading blink curve and trace its partial-minute rate extrapolation
- [x] Lock the upper series to actual per-minute blink counts with a failing unit test
- [x] Add a lower 0–60-second effective screen-facing series on the same time axis
- [x] Verify populated and empty dates, browser pixels, builds, packaged dual-track smoke, and one final instance
- **Status:** complete

### Phase 22: Pet-body settings shortcut
- [x] Reuse the existing native tray menu instead of creating a second settings surface
- [x] Distinguish a short Pet click from dragging with a tested movement threshold
- [x] Keep cancelled gestures and real drags from opening settings
- [x] Verify the menu contents, native click/drag behavior, packaging, and one final instance
- **Status:** complete

### Phase 23: Stable size changes and repeated Pet settings
- [x] Reproduce window recentering after a Pet size selection
- [x] Preserve current native coordinates when applying a new size
- [x] Defer shared-menu rebuilding until the active popup closes
- [x] Verify two consecutive Pet clicks, a size change, subsequent dragging, preference restoration, packaging, and one final instance
- **Status:** complete

### Phase 24: Inactive Pet settings hit testing
- [x] Reproduce a real coordinate click while Chrome owns focus
- [x] Keep transparent pixels click-through while enabling only the scaled Pet handle
- [x] Cover unfocused small, standard, and large Pet clicks in the native smoke
- [x] Verify the packaged app with a real Chrome-frontmost coordinate click
- **Status:** complete

### Phase 25: Right-click Pet settings
- [x] Make left-click exclusive to Pet dragging
- [x] Open the shared settings menu from the Pet context-menu event
- [x] Verify left-click, repeated right-click, resizing, and dragging in the native smoke
- **Status:** complete

### Phase 26: Immediate camera-settings persistence
- [x] Remove the redundant time-range Save button
- [x] Apply switches immediately and valid time pairs as soon as either value changes
- [x] Keep invalid time pairs local with an inline error until corrected
- [x] Verify packaged close/reopen persistence and restore the user's setting
- **Status:** complete

### Phase 27: Camera time-control visual integration
- [x] Replace the visually inconsistent native time field with app-styled hour/minute controls
- [x] Keep minute precision, accessibility labels, validation, and immediate persistence
- [x] Verify density, alignment, and overflow in the packaged 760 × 300 window
- **Status:** complete

## Key Questions
1. Is the repository already an app, a starter, or empty?
2. Which traits of Codex Pet should be preserved: floating presence, character states, compact controls, or visual style?
3. What is the minimum reminder loop that helps without creating notification fatigue?
4. How should unreliable face/blink detection degrade without implying medical certainty?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Treat this as a desktop personal-wellness tool, not a diagnostic medical device | Matches the user's goal while avoiding unsupported diagnosis claims |
| Keep camera processing local by default | Blink data is sensitive and does not need to leave the device |
| Do not implement UI before visual selection | Product Design workflow requires a selected visual target |
| Borrow Codex Pet's glanceable state model, not its coding-task semantics or visual identity | The useful pattern is a calm persistent character whose motion communicates state |
| Use personal baseline plus sensing confidence, not a universal blink quota | Blink cadence varies by task and poor camera conditions must not trigger false certainty |
| Distance reminders are prompts, not verified focal-distance measurements | A normal webcam cannot reliably prove that the user focused at a medically meaningful distance |
| Build option 2 with a Vite renderer inside an Electron shell | Preserves the selected 3D ambient direction while supporting a transparent always-on-top macOS window and local camera access |
| Store only sparse minute aggregates for 30 days | Enables date switching without retaining camera frames or exact blink timestamps |
| Render fully unobserved minutes as gaps and pair short observations with their screen-facing seconds | Prevents missing coverage from being read as zero while avoiding partial-minute extrapolation |
| Plot actual per-minute blink counts above effective screen-facing seconds | Keeps both lines interpretable on independent scales while preserving precise time alignment |
| Use 刘看山 as the drag handle | Makes dragging discoverable without sacrificing transparent-area click-through or adding a title bar |
| Mirror only detector-confirmed blinks on 刘看山's visible eye | Creates direct embodied feedback without faking events in timer-only mode or adding distracting motion |
| Keep the complete pet drag handle inside a display work area | Prevents a partially off-screen window from hiding the only recovery handle while still allowing the card to approach screen edges |
| Treat effective screen-facing duration as confidently face-visible observation time | A webcam cannot prove gaze; the local proxy is useful only when its limits are explicit and paused or distance-break time is excluded |
| Offer three pet-only size presets from the tray and persist the choice locally | Gives predictable, reversible sizing without adding controls to the low-distraction companion surface |
| Drive the attention pet from a separate sensing-gated state machine | Keeps whole-display motion independent from existing coaching cards and prevents low-confidence camera states from becoming accusations |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm install` could not resolve `@asamuzakjp/css-color@^6.0.5` through the configured registry while adding `jsdom@30.0.1` | 1 | Remove unnecessary `jsdom`; keep tests in Vitest's Node environment |
| Vitest collected the template's Node test file | 1 | Scope `npm test` to `src`; keep Sites verification in `npm run test:sites` |
| Sandboxed Electron did not expose the ESM preload bridge | 1 | Replace the preload with sandbox-compatible CommonJS and verify `isDesktop=true` from the packaged binary |
| Electron Builder repeated a slow GitHub runtime download | 1 | Point `electronDist` at the already-installed matching Electron distribution |
| Native date input behaved inconsistently under embedded-browser keyboard automation | 1 | Use a bounded native select listing the exact 30 retained dates |
| First edge-clamp smoke expected macOS to accept a window origin 12 px above the display work area | 1 | Keep the entire native window top below the menu bar; retain handle-based horizontal and bottom constraints |
| Computer Use cancelled two button clicks while the live camera UI was updating | 2 | Do not compete with the user's active camera session; rely on deterministic packaged renderer/native smokes and leave the normal instance running |
| Initial source scan looked for the conventional `src/vite-env.d.ts`, but this app declares the bridge in `src/env.d.ts` | 1 | Use the existing declaration file and keep the bridge extension in its established location |
| Computer Use timed out through both bundle-id and display-name reads of macOS `SystemUIServer` | 2 | Stop system-tray automation; verify packaged commands and restart persistence through an isolated application profile |
| Safety policy rejected recursive deletion of the isolated `/tmp` size-test profile | 1 | Do not bypass deletion safeguards; leave the bounded temporary profile for normal OS cleanup |
| macOS clamped the frameless window instead of allowing its top edge above the work area | 1 | Keep the transparent window at the work-area top, hide only the pet during healthy/cooldown phases, and animate visible phases from top to bottom |
