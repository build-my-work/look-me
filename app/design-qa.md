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

- Trigger: one detector-confirmed complete blink; timer fallback and manual completion do not trigger it.
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

- The existing pet and cards remain unchanged in parked/manual states; automatic attention states right-align only the pet and hide the idle capsule.
- A generated pale-blue raster tear sits directly below the visible dot eye. One attached drop and one falling repeat provide crying motion without altering the mascot source art.
- Standard-size crying pixels show a clear tear with no nose/body overlap. The 41% preset raises the tear's source width so its transformed width remains roughly 10 px.
- Healthy and cooldown phases hide both the pet and its drag hit region while the transparent native window stays shown, preserving local camera processing and desktop click-through.
- Reduce Motion replaces full-height flight with one static crying pose at 82% of the available Y rail.
- Existing statistics expand/collapse, distance start, visible Skip, and idle return interactions all passed after the rail integration; browser console remained warning-free.
- P0: none. P1: none. P2: none.

## Passive blink-prompt correction

- Removed the fallback “眨好了” button and its interactive card hit area; the card now contains only the eyebrow, three-blink instruction, and progress dots.
- The existing `475 × 168` card geometry remains unchanged, so character overlap and visual hierarchy do not shift.
- Browser pixels show no residual button spacing or control artifact. DOM inspection reports zero buttons in the frozen blink state.
- Low-confidence/timer-only prompts return to idle after 6 seconds; camera-available prompts still wait for three confirmed blinks.
- P0: none. P1: none. P2: none.

## Optional persistent-pet setting

- “看山常驻” lives in the tray, defaults off, and does not add controls to the compact companion surface.
- When enabled, healthy and post-blink cooldown states show the existing pet without tears at the upper-right; the window footprint, pet size, and drag target are unchanged.
- The setting changes presentation only, so descent, crying, rampage, blink recovery, Reduce Motion, and manual cards retain their approved behavior.
- Browser regression inspection and packaged renderer, rail-position, history, and small-pet drag smokes passed without layout changes.
- P0: none. P1: none. P2: none.

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

final result: passed
