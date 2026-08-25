# OCR and Camera Accuracy Audit

## Mobile Responsiveness and Permission Recovery

## Embedded Mobile Permission Screen Repair

## Mobile Camera Stream Access

## Android Overlay-Blocked Permission Recovery

## Persistent Android Camera Permission Failure

## Simple Reliable Mobile Flow

## Direct Camera to Barcode

## Published Camera Permission Resolution

## Overlay-Safe Native Camera Flow

## Immediate Live Hover Capture

## Live Compute-Environment Camera Test

## Barcode-Adjacent Label Number Targeting

## Screen Number Capture and Focus Stability

## Instant Capture and Short-Range Focus

## Glare-Resistant Device-Screen Capture

## Production Code Review and Release

## Release Synchronization

### Post-CTO Release Synchronization

- [x] Synchronize the workspace and development preview to version 8daa9dd0.
- [x] Verify the public application serves the same version.

- [x] Synchronize the development workspace and preview to the newest production checkpoint.
- [x] Confirm the active published domain points to the same released version.

## CTO-Led Scanner Reliability Pass

## Stable Live-Capture Sensor Repair

## Angled Phone-Screen Fast Capture

## Sub-Second Capture Architecture

## Camera-First Installable Mobile Tool

## Barcode-First Focus and Adaptive Lighting Repair

- [x] Analyze every supplied product-label image for barcode geometry, illumination, glare, blur, and competing text.
- [x] Replace scene-wide autofocus behavior with barcode-region focus guidance and a stable lock strategy where the browser exposes camera controls.
- [x] Add local adaptive lighting and contrast preprocessing for white glare, dim labels, colored labels, and reflective packaging.
- [x] Prioritize native barcode detection and decode barcode payloads directly before OCR fallback.
- [x] Add scenario-specific regression coverage and validate the revised mobile scanner.
- [x] Publish the barcode-first focus and lighting release.

## Local Photograph-to-Barcode Capture

- [x] Review the supplied photographed order screen and record the intended value versus timestamps, counts, labels, and watermark text.
- [x] Add a dedicated photo capture/import action that processes one chosen image locally and sends the verified target directly to the Code 128 result.
- [x] Preserve strict prominent-order-number selection, with no silent digit edits and no fallback to unrelated screen values.
- [x] Add regression coverage for the supplied photographic reference and validate the mobile photo workflow.
- [x] Publish the photograph-to-barcode update.

## Photo OCR Completeness Repair

- [x] Inspect the new failed photo/result pair and record the full intended order ID versus the partial barcode value.
- [x] Prevent incomplete numeric OCR fragments from becoming a barcode when a longer order identifier is visible in the same source image.
- [x] Add a regression for source `1384275333` and rejected partial `138427` output.
- [x] Validate the repair and publish the corrected photo workflow.

## Installed App Update Lifecycle Repair

- [x] Inspect the current service worker, registration behavior, and cache naming for repeated update prompts.
- [x] Ensure an available update activates deterministically and stale caches are removed without repeat notices.
- [x] Validate the installed-app update lifecycle and publish the repair.

## Reflected Screen Speed and Manual Override Repair

- [x] Inspect the supplied reflected order screen and milk-label reference, recording intended values and optical obstacles.
- [x] Remove nonessential reflected-screen waiting from the explicit Capture action while retaining safe complete-number verification.
- [x] Prioritize the fast screen-text route before costly correction passes and prove that manual capture queues over automatic work.
- [x] Add regressions for the supplied order ID and validate the revised mobile capture latency.
- [x] Publish the reflected-screen speed and manual-override repair.

## Portrait-Based Personal Brand Logo

- [x] Define a portrait-logo treatment that remains legible within the compact Signal Field product identity.
- [x] Generate the portrait-derived personal logo with a transparent background.
- [x] Replace the current generic mark in the header and installable app identity with the new personal brand asset.
- [x] Validate and publish the personal-brand update.

## Installed Founder Icon Correction

- [x] Inspect the manifest, installed-app icon URLs, and service-worker cache path that preserve the old barcode icon.
- [x] Publish a versioned founder-logo icon set and update all installable-app metadata references.
- [x] Validate the new icon delivery and document the required reinstall step for existing Android shortcuts.
- [x] Publish the installed-icon correction.

## Reflected Screen Capture Completion Repair

- [x] Record the supplied reflected-screen failure, including the visible long order line and the stalled HOLD STEADY state.
- [x] Ensure a visible long screen identifier is evaluated before advisory quality guidance can block auto-capture.
- [x] Ensure manual Capture completes the current frame immediately rather than remaining in a reading state.
- [x] Add regression coverage for the new reflected order ID and validate the repaired flow.
- [x] Publish the reflected-screen capture completion repair.

- [x] Simplify launch so the browser camera request begins automatically when the scanner opens, with a clear recovery route if permission is unavailable.
- [x] Add local-first installability metadata, offline shell support, and an always-available mobile install action.
- [x] Move manual Capture now to a large bottom-centered circular control that takes priority over automatic capture.
- [x] Validate install prompt availability, offline shell behavior, camera fallbacks, and bottom control reachability on mobile.
- [x] Publish the simplified installable mobile release.

- [x] Research browser-native text/barcode detection and local OCR latency strategies for mobile capture.

The development preview serves the install manifest with the expected MIME type, is controlled by the local service worker after reload, and caches both the app entry point and manifest for the local offline shell. The install action remains in the header whether or not the browser exposes its native install prompt; on browsers without that prompt it displays the appropriate Add to Home Screen instructions. The embedded preview has no physical camera, so its recovery panel is expected; the published mobile app will make the automatic browser camera request and retains the bottom capture override once a stream is active.

- [x] Measure the current first-read, OCR, and barcode-render timings against the one-second target.
- [x] Implement the fastest reliable capture path, retaining strict numeric validation and a safe fallback.
- [x] Test target latency and publish the optimized scanner release.

- [x] Analyze the supplied angled phone-screen images and identify the intended order ID versus watermark and UI noise.
- [x] Ensure automatic capture accepts a prominent standalone order ID in a tilted/reﬂected display frame.
- [x] Make Capture now process the current sharp frame without the automatic motion wait.
- [x] Add tests for the supplied order ID and competing short UI values.

The reviewed wide and close references confirm **1900494833** as the only intended ten-digit order ID. The scanner must ignore the nearby **8601**, item count **3**, in-screen time **11:03 PM**, external Galaxy M32 watermark/date, payment/currency text, and green status pill. A local sparse-text OCR verification recognizes the source frame after a +25° correction; manual Capture now therefore performs this one correction pass only when its fast first read finds no eligible candidate.

- [x] Validate the accelerated screen-capture flow and publish the update.

- [x] Inspect the current quality sensor and identify why its feedback changes too readily.
- [x] Add stable-frame motion gating so OCR runs only after the subject is held still briefly.
- [x] Replace reactive sensor messages with a concise, stable ready/hold feedback state.
- [x] Add regression tests for frame stability and verify the end-to-end fallback workflow.
- [x] Publish the corrected capture behavior.

- [x] Audit the active scanner and result states for the next highest-value, low-friction improvements.
- [x] Add a live capture-quality signal that helps the user correct framing before OCR is attempted.
- [x] Refine the result stage with a direct, repeatable path back to scanning.
- [x] Validate the updated mobile experience, automated checks, and production build.
- [x] Publish the selected product improvements.

- [x] Run lint/type, test, and production-build checks against the latest code.
- [x] Review the camera, OCR, focus, and capture paths for regressions or unsafe state transitions.
- [x] Fix confirmed defects and add tests where the review finds gaps.
- [x] Validate the mobile release flow visually.
- [x] Publish the reviewed update.

The baseline suite passes, but the review identified an immediate-mode cooldown that still limits OCR starts to approximately one per second, ambiguity risk when multiple long display numbers are present, and a need for stronger video-readiness gating around camera start/stop. The remediation will also complete the pending in-camera instant-capture control and display-light normalization so the release aligns with the most recent capture requirements.

The release pass now uses a 160 ms immediate scan cooldown, supports a Capture now action that bypasses that cooldown without overlapping requests, normalizes screen-frame brightness locally, rejects ambiguity between similarly long display values, and gates OCR on actual video readiness. The suite, type check, and production build pass with 21 automated tests.

- [x] Inspect the new device-screen reference and identify the intended long order number and competing content.
- [x] Normalize captured screen frames for glare, uneven brightness, and dark-display contrast before OCR.
- [x] Add an in-camera Capture now action that processes the current frame without waiting for the automatic cycle.
- [x] Preserve a wide screen region while avoiding camera-edge and phone-overlay text.
- [x] Add tests for the new `1533213815` target and competing values.
- [x] Validate the glare-resistant capture flow and production build.

> Legacy-reference note: the original `1533213815` evidence is not present in the current upload or project notes. These historical items are retained as checklist history and are superseded by the later verified screen references `2045273896`, `1900494833`, `2075641212`, `1702709887`, and `1397357445`; no new claim is made for `1533213815`.

- [x] Measure the current live OCR polling and capture path to remove avoidable wait.
- [x] Add a visible instant-capture button that reads the current frame on demand.
- [x] Prefer close-range/manual focus when the browser exposes focus-distance controls, with safe fallback behavior.
- [x] Validate the capture action, focus fallback, and production build.

The scan timer runs every 180 ms in instant mode, but a separate 900 ms throttle still limits actual OCR starts. The update will lower that cooldown for the instant scanner and allow an explicit Capture now action to bypass the cooldown while preserving the single in-flight OCR guard. Browser APIs do not define a universal “macro focus” mode; where `focusDistance` and manual focus are exposed, the app will request the nearest supported distance once and otherwise retain stable continuous focus without repeated constraints.

- [x] Inspect the supplied screen reference and identify the intended long order number versus UI counters, times, and status text.
- [x] Prioritize the prominent standalone six-or-more-digit order number on a photographed display.
- [x] Add a focus lock/cooldown so the browser does not repeatedly force autofocus while scanning.
- [x] Add tests for the example order number and competing screen values.
- [x] Validate focus behavior and display-number selection.

- [x] Inspect the sample label layout and record the barcode-to-number spatial relationship.
- [x] Prioritize a strict numeric line immediately below a detected linear barcode.
- [x] Reject dates, measurements, quantities, time values, and other lower label numbers.
- [x] Add unit tests covering the supplied label’s `2523517` target and competing text.
- [x] Validate targeted immediate capture on the sample-label geometry.

- [x] Check whether an attached cloud or desktop environment exposes a physical camera device.
- [x] Attempt a live test only if a camera stream can be accessed.
- [x] Record the observed capability and remaining real-device test requirement.

The available compute environment exposes no `/dev/video*` device and no attached cloud or desktop mount, so it cannot provide a physical camera stream. The live hover workflow has already been exercised for browser permission and fallback behavior, but a final end-to-end optical recognition test requires the user’s phone camera with a real printed number.

### Sample Label Crop Notes

Tiles 1–2 contain only the upper portion of the linear barcode and its surrounding blank label area; no competing text or target number is visible yet. The barcode is horizontally oriented and centered in the label area.

Tiles 3–4 complete the barcode region and reveal the start of the target numeric line directly beneath it. The target is horizontally aligned with the barcode and appears before the product description; this immediate-below relationship is the selection signal to implement.

Tiles 5–6 show the full standalone identifier **2523517** directly below the barcode. It is the only numeric line in the barcode’s immediate vertical neighborhood; the remaining label area begins below it and must not compete with this selection.

Tiles 7–8 show the lower label content: product-name text, an alphanumeric specification, a weight value, a case quantity, and a slash-separated production date. These are outside the immediate-below barcode neighborhood and/or non-standalone numeric lines, so they must be rejected even if their OCR confidence is high.

Tiles 9–10 contain the remaining specification, quantity, date, expiry, batch/time content, and the phone-camera watermark/date overlay. All of these are spatially remote from the barcode and must be ignored; particularly, slash-separated dates and colon-separated times must never become candidate values.

Tiles 11–12 confirm the date, time, quantity, and camera-overlay content ends in the lower label region with no additional barcode-adjacent candidate. The full ordered review confirms that **2523517** is the only intended target in the barcode’s immediate below area.

### Screen Reference Crop Notes

Tiles 1–2 show the intended large standalone order number **2045273896** on the dark display, with adjacent status text and an 18:16 time. The long identifier is visually prominent inside the order card, while the nearby time is a short colon-separated value and must be rejected.

Tiles 3–4 show surrounding order-screen labels, status wording, and short UI counters. They do not contain another comparable standalone long numeric candidate and should be rejected by the existing strict-digit and minimum-length rules.

Tiles 5–6 show the target card’s surrounding timestamp and customer text. The colon-separated time and alphanumeric customer label remain non-target content; only the isolated long digit line in the card should be eligible for capture.

Tiles 7–8 contain lower order-screen labels and short counters only. They provide no competing long numeric target and must remain excluded from capture.

Tiles 9–10 contain the camera watermark, date/time overlay, and order-status pills. None are eligible values; the watermark and its date/time must be excluded before display-number ranking.

Tiles 11–12 contain only a Done button, short counters, and device status icons. The full ordered review confirms **2045273896** is the sole intended six-or-more-digit standalone display number; times, counters, buttons, status, customer text, and camera overlays must be ignored.

- [x] Restore the live-camera route as the primary scan action.
- [x] Reduce long-number confirmation to a single high-confidence numeric line while preserving strict validation.
- [x] Generate the Code 128 result immediately after the first accepted live OCR result.
- [x] Keep native photo capture only as a compact fallback if the live stream cannot start.
- [x] Validate live-scanner responsiveness and fallback behavior.

- [x] Confirm the Android overlay restriction and identify an app-controlled alternative.
- [x] Remove live browser camera permission as the primary scanner route.
- [x] Make Android native device-camera capture the first action for scanning a number.
- [x] Preserve a compact numeric fallback only when native capture is unavailable.
- [x] Validate that the primary app flow does not call `getUserMedia` before capture.

Android blocks permission dialogs whenever another app draws over the screen. A website cannot close those overlays or override the operating-system restriction. The app-controlled solution is to avoid calling `getUserMedia` in the normal flow and instead open the device camera via the native file-capture route, which does not depend on the browser’s live-video permission dialog.

- [x] Inspect the deployed URL’s security and browser policy response for camera access.
- [x] Confirm whether the permission dialog is blocked by Android/Brave rather than the website.
- [x] Remove any remaining app-side obstacle to the direct camera request.
- [x] Add concise, actionable recovery guidance only if the operating system blocks the prompt.
- [x] Validate the final published camera flow.

The published application is served over HTTPS, exposes the browser camera API, is a top-level page, and has an allowed camera policy. The application calls `getUserMedia` from the explicit Open camera tap. The Android message in the supplied screenshot is shown by the operating system before the website receives a stream or permission decision; it cannot be bypassed or dismissed by website code.

- [x] Identify and remove unnecessary capture choices and screens.
- [x] Remove photo-first framing, format choices, and other nonessential capture decisions from the primary flow.
- [x] Make live camera scanning the first screen and set Code 128 for long numeric values automatically.
- [x] Send a stable detected numeric line directly to a barcode result without an intermediate confirmation screen.
- [x] Retain only a compact camera-blocked fallback with manual entry.
- [x] Validate the one-purpose mobile workflow.

The direct workflow will retain only two states: a camera start/scan state and a barcode result state. Code 128 becomes a fixed default with a longer numeric limit. A browser requires an explicit user tap to request camera permission, so the initial screen will provide one full-width `Open Camera` action; all photo selection, format selection, verification, history, and settings paths will leave the primary experience.

- [x] Make photo capture or selection the primary entry point on mobile.
- [x] Place direct numeric entry beside it as an equally clear no-permission path.
- [x] Move live camera scanning to an optional advanced action with concise caveats.
- [x] Reduce camera permission recovery messaging to a non-blocking help panel.
- [x] Validate the simplified primary flow on a mobile viewport.

- [x] Determine whether Android/Brave policy is blocking the camera prompt before the web app can act.
- [x] Add a no-camera fallback that lets users acquire a photo through the browser’s file/camera picker instead of `getUserMedia`.
- [x] Stop presenting repeated camera-prompt retries when Android blocks the permission dialog.
- [x] Clearly distinguish live-camera scanning from one-photo recognition.
- [x] Validate the fallback path and document the remaining Android permission prerequisite.

The repeating system dialog occurs before JavaScript receives a camera stream, so the website cannot force Android or Brave to grant it. The reliable web-compatible fallback is an image input with `accept="image/*"` and `capture="environment"`: Android can route this through its camera app or photo picker rather than the blocked in-page `getUserMedia` permission prompt. OCR of a still image will always route to the existing digit review screen instead of auto-confirming a number.

- [x] Assess the Android overlay-blocked permission condition.
- [x] Detect a camera request that remains in browser permission `prompt` state after Android rejects the system dialog.
- [x] Present a specific Android overlay recovery state instead of a generic camera-denied state.
- [x] Prevent automatic repeat prompts until the user explicitly confirms they have cleared overlays.
- [x] Validate the revised recovery flow and document the Android-level action required.

Android is rejecting the operating-system permission dialog before Brave can pass a result to the website. The app cannot dismiss other apps’ bubbles, accessibility overlays, screen recorders, or floating tools; Android deliberately blocks that from web pages. After a failed `getUserMedia` request, the app can safely read the browser permission state. A remaining `prompt` state on Android identifies this overlay-blocked dialog, while a `denied` state remains a genuine user/browser permission denial.

- [x] Capture the browser-facing reason returned by `getUserMedia` and the device capability state.
- [x] Replace unsupported permission preflight logic with an acquisition-first fallback sequence.
- [x] Try environment and generic video constraints without blocking on stale permission metadata.
- [x] Give the user a clear in-app-browser and device-settings recovery path when no stream can be acquired.
- [x] Validate the revised access logic and document remaining host-browser limitations.

The camera handler currently stops before `getUserMedia` when the optional Permissions API reports `denied`; this can prevent a fresh browser prompt or reflect a host-webview policy rather than the device’s current camera setting. The supplied screenshot also shows the app running in preview mode inside an embedded Manus browser. That host may deny the camera stream independently of the device permission. The repair will request a stream directly, record diagnostic context, fall back through compatible constraints, and direct users to the published URL in their normal mobile browser when the host blocks camera capability.

- [x] Assess the supplied mobile screenshot and identify layout conflicts.
- [x] Reduce the permission card and recovery chrome for tall, narrow in-app browser viewports.
- [x] Keep manual entry and retry actions visible above browser and host overlays.
- [x] Remove redundant blocked-camera messaging from the compact recovery state.
- [x] Verify the revised composition at the supplied phone aspect ratio.

The supplied screenshot shows the recovery card occupying most of the live camera field while the always-visible status panel, disabled control rail, manual bar, browser chrome, and host overlay compete below it. The repair will treat the blocked state as a dedicated compact fallback: hide non-actionable scan chrome, keep only one message area, use a lower-height card with a safe bottom offset, and surface retry/manual actions above external overlays.

- [x] Inspect the existing camera request sequence and mobile viewport behavior.
- [x] Add an explicit permission-ready state with a user-initiated retry path.
- [x] Distinguish denied, unavailable, insecure-context, and in-use camera failures clearly.
- [x] Refine the camera controls, status panel, and manual fallback for narrow and short mobile viewports.
- [x] Validate responsive presentation and permission recovery states before delivery.

The existing camera request runs from a mount effect after navigation, which can lose the direct user-gesture context preferred by mobile browsers. It also reduces all failure cases to one generic message and leaves camera controls available when no stream exists. The repair will move `getUserMedia` behind an explicit user tap, use a permissive rear-camera-first constraint fallback, classify media errors, and show a focused recovery panel with retry and manual-entry actions.

- [x] Inspect the current camera, OCR, parser, barcode, and test modules for correctness gaps.
- [x] Enforce strict single-line numeric candidate selection, explicit rejection reasons, and three-frame stability.
- [x] Prefer the largest high-confidence in-region numeric text block while ignoring visual barcode/QR-like candidates.
- [x] Add development diagnostics for blocks, confidence, state transitions, and rejection reasons.
- [x] Improve the scan-state feedback for reading, uncertainty, multiple candidates, confirmation, and invalid formats.
- [x] Add unit coverage for mixed text, multiple numeric groups, separators, decimal points, and invalid EAN-13 values.
- [x] Validate production build, tests, native machine-code guard behavior, and diagnostic UI before delivery.

## Audit Findings

The current loop correctly limits processing to one in-flight request and samples approximately once per second, but it treats whole OCR output lines as candidates without line geometry, candidate-level confidence, or rejection telemetry. The character whitelist can also hide letters before the application can reject mixed content. The hardening pass will request layout blocks, rank only strict digit-only lines by area and confidence, identify multiple numeric lines, maintain a dedicated three-frame stability tracker, and show development-only decision records.

## Hardening Design

Each captured frame will be evaluated as a set of OCR line blocks, not as a cleaned whole-frame string. A line must contain only ASCII digits to be accepted by automatic capture; separators are preserved as an explicit rejection for OCR, rather than cleaned. A valid line must meet the configured numeric and barcode-format limits. When more than one valid numeric line exists, capture remains blocked. The largest qualifying line is selected only after these rejections, and confirmation requires three identical consecutive selections.

Development diagnostics will expose raw blocks, bounding boxes, confidence, area, evaluation state, and explicit reasons such as `contains-letters`, `contains-symbols`, `invalid-format`, `low-confidence`, or `multiple-numeric-lines`. A monotonic timer and in-flight lock will keep recognition below the configured sampling rate with no overlapping OCR request.

## Handwritten Return Number and Frontend Sanitation

- [x] Review the supplied handwritten return-number reference and define one-number selection rules.
- [x] Add local handwritten-number capture support without silently joining, correcting, or inventing digits.
- [x] Audit and sanitize the frontend for stale template code, duplicate paths, unused imports, unsafe OCR acceptance, and performance regressions.
- [x] Add handwritten and safety regression tests, then validate the mobile workflow.
- [x] Publish the handwritten-number and frontend-sanitation update.

---

## Recovery Note

- [x] Restored the stable scanner checkpoint after an unintended template upgrade introduced full-stack scaffold conflicts; no backend feature was required for this frontend-only request.

---

## Handwritten Return Number and Frontend Sanitation

- [x] Review the supplied handwritten return-number reference and define one-number selection rules.
- [x] Add local handwritten-number capture support without silently joining, correcting, or inventing digits.
- [x] Audit and sanitize the frontend for stale template code, duplicate paths, unused imports, unsafe OCR acceptance, and performance regressions.
- [x] Add handwritten and safety regression tests, then validate the mobile workflow.
- [x] Publish the handwritten-number and frontend-sanitation update.

---

## Recovery Note

- [x] Restored the stable scanner checkpoint after an unintended template upgrade introduced full-stack scaffold conflicts; no backend feature was required for this frontend-only request.

---

## Handwritten Return Number and Frontend Sanitation

- [x] Review the supplied handwritten-return-number reference and define one-number selection rules.
- [x] Add local handwritten-number capture support without silently joining, correcting, or inventing digits.
- [x] Audit and sanitize the frontend for stale template code, duplicate paths, unused imports, unsafe OCR acceptance, and performance regressions.
- [x] Add handwritten and safety regression tests, then validate the mobile workflow.
- [x] Publish the handwritten-number and frontend-sanitation update.

---

## Recovery Note

- [x] Restored the stable scanner checkpoint after an unintended template upgrade introduced full-stack scaffold conflicts; no backend feature was required for this frontend-only request.

## Live and Installed Version Delivery Repair

- [x] Compare live deployment, preview, service-worker, and manifest versions.
- [x] Correct stale delivery headers or version metadata so the latest scanner is fetched.
- [x] Validate the active live version and document the required installed-app refresh step.
- [x] Publish the delivery-path correction.

## Production Code Review and Improvement Release

- [x] Audit scanner, OCR, capture scheduling, PWA delivery, and frontend structure for concrete reliability or performance gaps.
- [x] Fix the highest-value verified gaps while preserving strict one-number and local-only behavior.
- [x] Add or extend regression tests for every scanner behavior changed by the review.
- [x] Validate production build, app-shell delivery, and the mobile recovery flow.
- [x] Publish the audited improvement release.

## Reflected Phone-Screen Recognition Repair

- [x] Trace why the live scanner remains in Reading while the supplied reflected phone screen visibly shows one long order number.
- [x] Adjust the live capture path to accept the intended standalone order number without accepting nearby status, time, customer, or count values.
- [x] Add a regression for the supplied reflected-phone order scenario and validate the mobile capture state.
- [x] Publish the reflected-screen recognition repair and verify the live worker delivery.

## Mobile UX and Functional Reliability Pass

- [x] Audit every visible scanner action and all camera, photo, manual-entry, result, install, and PWA states for user friction or broken behavior.
- [x] Improve the mobile-first scanning, fallback, result, and feedback experiences without weakening one-number validation.
- [x] Add functional regression coverage for repaired user actions and state transitions.
- [x] Validate the key paths on mobile layout, production build, and PWA assets, then publish the UX and reliability release.

## Numeric-Only Live Capture Speed Repair

- [x] Profile the numeric-only live capture route against the direct barcode route and isolate avoidable delay.
- [x] Add a safe fast path for a clear single numeric order line without weakening ambiguity or format safeguards.
- [x] Add speed and correctness regressions for numeric-only live capture, then validate the mobile build.
- [x] Publish the numeric-only speed repair and verify the deployed worker.

## GitHub Project Export

- [x] Inspect the selected GitHub repository and current project state before replacing repository contents.
- [x] Write a complete README covering setup, local-first privacy, scanner workflows, validation, and PWA behavior.
- [ ] Push the current Number to Barcode project and README to `anasanrai/anasan-s-barcode`.
- [ ] Verify the GitHub commit and report the repository update.
