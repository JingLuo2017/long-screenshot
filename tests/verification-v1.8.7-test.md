# v1.8.7 local test verification — 2026-11-09

Base: `c95f8747b523db5851f674779f18e56e213abc03`. Local candidate only; no GitHub write or hosting publication. `core.js` matches the base byte-for-byte.

- Pure tests cover crop geometry, 0–40% boundary limits, minimum retained area, seam positioning and actionable errors.
- Chromium at 390×844: loaded a synthetic 6-second scroll recording, dragged both bounds, verified 20%/17% precise values, selected PNG, cancelled identification, and confirmed all values and the recording remained. An invalid top value produced specific correction guidance. A new run reached both phases and rendered a 360×1885 PNG. Returning to settings after success restored the video preview. An invalid re-run did not hide the existing result when restoring the previous settings.
- Chromium at 320×568: cancelled automatically at entry to the image-generation phase. Verified original file, both boundaries, seam, PNG format and retry were preserved, processing video was removed, and no horizontal overflow occurred. Drag handle target height is 44px.
- The standalone deliverable contains no test recordings, no external app dependency, and no online update registration. Safari on actual iPhone has not been tested.

Run `node tests/crop-generation.cjs` and `node tests/prepare-local.cjs` to build the standalone HTML. `tests/cancel-export.js` is a QA fixture only.
