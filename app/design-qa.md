# Design QA: Look Me option 2

## Source and implementation

- Selected source: `/Users/zhihu/.codex/generated_images/019ff49a-82e6-7483-93b0-3164310d69d0/exec-103f7f23-c173-4829-9e1b-15273847a4dd.png`
- Implemented capture: `/Users/zhihu/code/m_code/ai/look-me/app/qa/implementation-final.png`
- Whole-frame comparison: `/Users/zhihu/code/m_code/ai/look-me/app/qa/comparison-final.png`
- Focused lower-overlay comparison: `/Users/zhihu/code/m_code/ai/look-me/app/qa/comparison-final-focused.png`
- Reference size: 1487 × 1058
- Capture viewport: 1440 × 1024 CSS pixels at DPR 1
- Captured state: `distance`, frozen at 20 seconds

## Pass history

### Pass 1

- P1: The character and horizon portal were materially smaller than the reference.
- P1: The group sat too low and did not overlap with the same visual weight.
- P2: The progress ring was dark, while the reference used a light ring over the sky.
- P2: Skip was inside the portal instead of floating below it.

Resolution: enlarged both assets, moved the group upward, restored the light progress treatment, simplified the prompt, and moved Skip below the portal.

### Pass 2

- P2: Skip remained anchored to the text column rather than the portal edge.
- P2: The character was visually close but still sat slightly lower than the selected reference.

Resolution: made Skip a direct portal child and adjusted the selected preview state's card and character offsets.

### Final pass

- P0: none.
- P1: none.
- P2: none.
- Full-frame hierarchy, focused component anatomy, character overlap, prompt text, 20-second progress, and below-portal Skip placement all match the selected direction.
- The background scene is a project-owned defocused workspace variant; the selected direction's brightness, calm palette, desk anchoring, and low-distraction hierarchy are preserved.

## Session statistics extension

- State: idle, expanded statistics, sample session data.
- The permanent readout adds one eye pulse and one short frequency value to the existing idle capsule.
- The expanded capsule stays within the native 760 × 300 bounds and preserves character overlap without covering the title or metrics.
- Three values use a single structured row with quiet dividers; there is no graph, score, target, or diagnostic color.
- Expand, collapse, camera-unavailable empty state, and accessible labels were verified in the running preview.
- P0: none. P1: none. P2: none.

## Daily history curve extension

- State: idle, daily history open, deterministic sample data for visual verification.
- Native capture: `/Users/zhihu/code/m_code/ai/look-me/app/qa/history-daily-final.png`.
- The 760 × 300 native capture keeps 刘看山 in the foreground while moving all chart labels and controls beyond the character silhouette.
- One teal curve spans 00:00-23:59; sensing gaps stay visibly disconnected instead of falling to zero.
- The header contains only previous day, a 30-day date selector, next day, and close. Three quiet text summaries provide context without adding scores or targets.
- Pass 1 found clipped Y-axis labels caused by a negative chart margin. The labels were moved fully inside the chart and re-captured.
- Date switching, empty-day copy, close/reopen, permission-screen access, lazy loading, and a warning-free console were verified in the running preview.
- P0: none. P1: none. P2: none.

## Mirrored pet blink extension

- Trigger: one detector-confirmed complete blink; unavailable sensing does not trigger it.
- The existing image and a fog-white eyelid share one breathing wrapper, so the eyelid stays registered while the character moves.
- The animation was paused at its closed midpoint for native-pixel inspection: the dot eye becomes one short ink line without covering the nose or shifting the body.
- The response lasts 220 ms, remains silent, and adds no bounce, copy, or new product state.
- Source and packaged drag smokes still hit the bounded pet handle and move the native window.
- P0: none. P1: none. P2: none.

## Native distance-action correction

- The shared preview placement put “跳过” 70 px below the horizon card, which exceeded the native window's 300 px clipping boundary.
- Native mode now keeps the action inside the card's lower-right safe area; browser preview placement remains unchanged.
- The action stays clear of the countdown ring and remains within the interactive pointer region.
- P0: none. P1: none. P2: none.

## Native drag recovery correction

- The user's live window could move far enough left that the pet handle disappeared, leaving only a non-draggable control fragment visible.
- Main-process drag movement now clamps against the work area of the display nearest the pointer, rather than trusting unconstrained renderer coordinates.
- The complete `194 × 230` pet handle remains on-screen horizontally; the window top stays below the macOS menu bar and the handle remains above the lower work-area edge.
- Source and packaged edge smokes verified ordinary movement plus exact left, top, right, and bottom constraints.
- P0: none. P1: none. P2: none.

## Adjustable pet size extension

- The tray exposes three pet-only presets: small `41%`, standard `100%`, and large `110%`; cards, metrics, and controls keep their existing geometry. The small preset was later halved from `82%` at the user's request.
- The pet image, visible eyelid, renderer drag region, and native edge-clamp bounds use the same active size, so feedback and interaction stay registered.
- The first large pass used `112%` with a bottom origin and cropped too much of the ears. The final `110%` large preset uses a vertically centered origin to preserve more of the silhouette in the fixed 760 × 300 surface.
- The user later halved the small preset from `82%` to `41%`. Final native inspection measures the pet at approximately `106.6 × 133.3` and its drag handle at `79.54 × 94.30`; the fixed permission card remains unobstructed.
- Native pixel checks kept the statistics panel unobstructed in all three presets. Source and packaged edge smokes passed for every size.
- An isolated packaged-profile restart restored the selected large preset and its `213.4 × 253` drag bounds; normal launch was returned to standard.
- P0: none. P1: none. P2: none.

## Whole-display attention rail extension

- The existing pet and cards remain unchanged in parked/manual states. When “显示眨眼次数” is enabled, quiet rail states mirror the capsule beside the right-edge Pet; active descent, crying, rampage, and recovery states hide it.
- A generated pale-blue raster tear sits directly below the visible dot eye. One attached drop and one falling repeat provide crying motion without altering the mascot source art.
- Standard-size crying pixels show a clear tear with no nose/body overlap. The 41% preset raises the tear's source width so its transformed width remains roughly 10 px.
- Healthy and cooldown phases hide both the pet and its drag hit region while the transparent native window stays shown, preserving local camera processing and desktop click-through.
- Reduce Motion replaces full-height flight with one static crying pose at 82% of the available Y rail.
- Existing statistics expand/collapse, distance start, visible Skip, and idle return interactions all passed after the rail integration; browser console remained warning-free.
- P0: none. P1: none. P2: none.

## Passive blink-prompt correction

- Removed the fallback “眨好了” button and its interactive card hit area; the card now contains only the eyebrow, two-blink instruction, and progress dots.
- The existing `475 × 168` card geometry remains unchanged, so character overlap and visual hierarchy do not shift.
- Browser pixels show no residual button spacing or control artifact. DOM inspection reports zero buttons in the frozen blink state.
- Low-confidence or unavailable sensing dismisses the prompt and pauses blink timing; camera-available prompts wait for two confirmed blinks.
- P0: none. P1: none. P2: none.

## Optional persistent-pet setting

- “始终显示看山” lives in the tray, defaults off, and does not add controls to the compact companion surface. The redundant one-shot “显示看山” entry has been removed.
- When enabled, healthy and post-blink cooldown states show the existing pet without tears at the upper-right; the window footprint, pet size, and drag target are unchanged.
- The setting changes presentation only, so descent, crying, rampage, blink recovery, Reduce Motion, and manual cards retain their approved behavior.
- Browser regression inspection and packaged renderer, rail-position, history, and small-pet drag smokes passed without layout changes. The packaged native-menu smoke also confirmed that “始终显示看山” is present and “显示看山” is absent.
- Showing an existing window no longer recenters it on the display under the pointer; the native-menu smoke verifies that a dragged window keeps the same coordinates after another show request.
- Leaving the automatic attention rail no longer recenters the native window. Packaged attention and settings smokes verify identical coordinates before and after a rail-to-parked transition, covering camera/settings and other presentation-only state changes.
- P0: none. P1: none. P2: none.

## Persistent quick panel

- The former “显示统计图表” tray setting is now “显示眨眼次数” and is subordinate to “始终显示看山”. Turning the persistent pet off also turns and persists the capsule off; the panel item stays disabled until the persistent pet is enabled again.
- The capsule remains visible during quiet parked, hidden, resting, and cooldown phases, mirrors to the left of a right-edge Pet, and stays out of descending, crying, rampage, and recovery motion.
- Its size-aware anchor follows the artwork's visible alpha edge instead of the fixed transparent image box. Small, standard, and large presets keep a measured `9.1–10.1 px` visual gap in both parked and mirrored rail layouts.
- Its statistics button opens the compact statistics and then the daily history; its distance button starts the existing 20-second break. Hiding the capsule does not stop camera sensing or local history collection.

## Secondary-display small-pet drag correction

- The 41% pet remained visually correct, but its invisible drag region previously occupied the upper part of the native window while the pet itself sat at the bottom; they did not overlap.
- Parked and rail drag regions now share the pet's bottom transform origin. The corrected small rail pose has approximately `79 × 82 px` of visible pet/handle overlap without enlarging the pet or window.
- A packaged smoke pressed that overlap on the real secondary display at negative desktop coordinates and successfully moved the persistent rail window across to the primary display.
- Existing edge recovery and standard parked dragging remain unchanged and pass their packaged checks.
- P0: none. P1: none. P2: none.

## User-positioned attention rail correction

- The right edge remains the default entrance for automatic attention, preserving the approved upper-right-to-lower-right narrative when the user has not repositioned the pet.
- Manual placement now wins: releasing a rail drag leaves the pet at its dropped X instead of snapping it to the display edge.
- Subsequent crying and rampage movement is vertical at that chosen X, so animation semantics remain intact without overriding user control.
- The packaged secondary-display test retained `X=-940` through both release and a later rampage-position update; regular parked dragging and edge recovery also remain green.
- P0: none. P1: none. P2: none.

## Effective screen-facing duration extension

- The expanded statistics card now presents four evenly spaced metrics, including “今日有效看屏”, without changing the persistent pet or reminder controls.
- The selected-day history summary presents “有效看屏” from the same minute aggregates, while date switching correctly shows `0 秒` for an unobserved day.
- Browser pixels verified both the `7:50 小时` long-value case and the empty-date case with no horizontal or vertical overflow.
- The label states that the value is estimated from local face visibility; no gaze claim, camera frames, or additional sensitive history were introduced.
- P0: none. P1: none. P2: none.

## Synchronized daily-curve correction

- The original single curve normalized partial observations to a 60-second blink rate, which visually exaggerated short samples. The upper track now shows discrete per-minute blink counts without extrapolation or smoothed interpolation.
- A second, cool-blue track directly below shows effective screen-facing seconds on a stable 0–60 scale. Both tracks share the same horizontal time positions and reserve the bottom axis for labels.
- Track titles and short unit captions form a compact left rail, making the two units distinguishable without adding a floating legend or enlarging the `620 × 284` card.
- Populated-date pixels show both curves clearly; empty-date pixels keep both track frames and center one shared empty message. No horizontal or vertical overflow was observed.
- Packaged native QA found both track labels and both SVG curve paths; tray show/hide synchronization remained intact.
- P0: none. P1: none. P2: none.

## Pet-body settings shortcut

- Clicking the Pet body now opens the existing native settings menu at the pointer, avoiding a trip to the macOS menu bar without adding permanent visual chrome.
- The same silhouette-shaped hit region remains the drag handle. A short click keeps the window fixed; movement beyond 6 px becomes a drag and suppresses the menu.
- The Pet menu reuses the tray menu object, so size radio items, persistence and panel checkboxes, the settings entry, and quit stay synchronized.
- Native input QA verified one click opening, no click-position movement, successful subsequent dragging, and no drag-triggered menu.
- P0: none. P1: none. P2: none.

## Stable size and repeated-settings correction

- Size selection now changes only the Pet scale and hit geometry; it no longer invokes the window-reveal path that recenters the native surface.
- The shared native settings menu is not replaced while its popup is active. Checked-state refresh is applied after close, allowing the next Pet click to open settings reliably.
- Native QA moved the window to a non-default coordinate, changed size, retained the exact coordinate, reopened settings on a second click, and dragged successfully afterward.
- P0: none. P1: none. P2: none.

final result: passed

## Zhihu Direct capsule and chat

### Evidence

- Source visual truth: `/Users/zhihu/.codex/visualizations/2026/08/17/01a00f6d-52dd-7332-803c-d78ad4555a2f/index.html`
- Source capture: `/var/folders/pw/87rv66m91h9g710rc68z0c740000gn/T/look-me-zhihu-direct-source.png`
- Source Direct asset: `/Users/zhihu/.codex/visualizations/2026/08/17/01a00f6d-52dd-7332-803c-d78ad4555a2f/zhida-entry-button.png`
- Native implementation capture: `/var/folders/pw/87rv66m91h9g710rc68z0c740000gn/T/look-me-zhihu-direct-smoke.png`
- Browser implementation capture: `/var/folders/pw/87rv66m91h9g710rc68z0c740000gn/T/look-me-zhihu-direct-browser-preview.png`
- Density-normalized implementation: `/var/folders/pw/87rv66m91h9g710rc68z0c740000gn/T/look-me-zhihu-direct-implementation-1x.png`
- Full-view comparison: `/var/folders/pw/87rv66m91h9g710rc68z0c740000gn/T/look-me-zhihu-direct-comparison.png`
- Focused capsule/chat comparison: `/var/folders/pw/87rv66m91h9g710rc68z0c740000gn/T/look-me-zhihu-direct-focused-comparison.png`
- State: idle, persistent capsule visible, Zhihu Direct open, one submitted question and one answer.
- Source viewport: `760 × 680` CSS pixels at DPR 1; source capture: `760 × 680` pixels.
- Implementation viewport: `760 × 680` CSS pixels at DPR 2; native capture: `1520 × 1360` pixels, normalized to `760 × 680` before comparison.
- Browser preview viewport: `1280 × 720` CSS pixels at DPR 2; the expanded composition is fully visible and the browser console has no warnings or errors.

### Comparison history

- Pass 1 found a P2 state bug: the disabled send button animated every icon, so the idle ArrowUp could be captured rotated downward. The loading animation selector now targets only the loading state.
- Preliminary small-size inspection found a P2 boundary risk after widening the capsule. The original `83px` pet anchor remains intact; only the small capsule controls scale together to `25px`, and native verification measures the chat panel at `x=1.5px` with no clipping or statistics overlap.
- Browser pass 1 found a P2 preview-only regression: the expanded chat inherited the old bottom-anchored preview stage and was clipped below the viewport. The Direct preview now uses a top-anchored `680px` stage with bounded low-height and narrow-width scaling; the post-fix `1280 × 720` capture shows the complete composer.
- Post-fix native captures passed at small, standard, and large pet sizes. Each measured the chart and Direct controls at the same `29px` height, kept the Direct entry inside the capsule, fit the `390 × 300` chat below it, and restored the original `760 × 390` window bounds after close.

### Fidelity review

- Fonts and typography: the implementation keeps the prototype's compact Inter/system hierarchy, `New chat` header weight, monospace CLI label, 12px message text, and zero letter spacing. No wrapping or truncation issue is visible.
- Spacing and layout rhythm: the source's wide Direct pill remains wider than the circular statistics control but matches its height. The chat keeps the source's header/messages/composer structure and `390px` width. Its height is intentionally reduced from `350px` to `300px` so it fits the native desktop window below the capsule.
- Colors and visual tokens: teal status, white chat surface, quiet green assistant messages, dark teal user messages, and the purple Direct brand asset match the source while reusing the app's existing tokens.
- Image quality and asset fidelity: the implementation uses the approved raster Direct asset and the existing project-owned 刘看山 PNG without redraws, substitutions, or CSS approximations. Both render sharply in the DPR 2 native capture.
- Copy and content: `zhihu cli`, `New chat`, the prompt, close/send labels, and real answer content preserve the selected interaction. Prototype-only explanatory copy is absent from the product UI.
- Intentional native adaptation: the implementation keeps the established transparent Electron surface and existing pet scale rather than copying the prototype's pale webpage canvas. This is a product-shell constraint, not unresolved design drift.

### Findings

- P0: none.
- P1: none.
- P2: none.
- Residual P3: the source prototype shows more conversation history because it runs in a taller page context; the native panel prioritizes a fully visible composer and scrolls longer content.

### Implementation checklist

- Direct entry is inside the persistent capsule and balanced with the statistics control.
- Statistics remains a separate action and is mutually exclusive with Direct.
- Chat opens below the capsule, sends through the typed Electron bridge, and renders success and error states.
- Native window expansion, all pet sizes, response flow, close restoration, browser preview, renderer build, unsigned desktop packaging, packaged smoke, typecheck, and unit tests are verified.

final result: passed

## Camera monitoring controls

- Added one visually dominant monitoring master switch, plus subordinate distance-break reminder and daily-window controls that become quiet and disabled when the master switch is off.
- The master switch gates all active coaching. The separate distance-break switch suppresses only automatic distance breaks, dismisses an active break, and resets its baseline so re-enabling cannot produce a catch-up prompt.
- Native 760 × 300 Electron pixel QA verified that 刘看山 remains clear of the controls, the panel stays inside the transparent surface, and macOS-localized AM/PM time values remain fully visible.
- Accessibility QA verified labeled master, distance-reminder, and schedule checkboxes; labeled start/end time selects; disabled-state semantics; keyboard focus treatment; and an inline invalid-window message.
- Local preview QA verified that the new reminder row and footer fit the fixed `620 × 276` settings card without overflow, and that the independent preference survives reload.
- Native tray/Pet-menu smoke QA verified the shell-only menu, repeated Pet-menu opening, dragging, and the intentional absence of duplicate camera and manual distance actions.
- P0: none. P1: none. P2: none.

final result: passed
