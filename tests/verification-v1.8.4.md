# v1.8.4 verification — 2026-11-08

- Exact pixel checks: eight opaque source colors, edge coordinates, unaffected by flattened masks or simulated dimming; watermark fallback 34 image pixels at 750px width (17px at 375px reference width), opacity 50%; privacy rectangles stay fully opaque.
- Browser checks: draw a mask, tap its center, original-image sampling under that mask, cancel restoration, HEX/RGB synchronization, retained edits, pinch/pan without accidental sampling, correct source coordinate after zoom, saved-image dimensions, back navigation and reset defaults.
- Layout checks: 320×568, 375×667, 375×812, 390×844, 393×852, 414×896, 430×932, 440×956 and 844×390. No horizontal page/dialog overflow; editor controls retain 44px minimum heights; preview remains visible with watermark settings open.
- Release/cache checks: version comparison, scoped atomic installation, dismiss/postpone, busy locking, data-loss confirmation and reload all pass.
- README: all prior changelog bodies preserved verbatim, ordered newest-first; appreciation image copied byte-for-byte from the uploaded JPG and referenced with a repository-relative path.
- The inline video generation, stitching and sharing handlers are unchanged. No user recording is included in test fixtures.

Checks ran in Chromium using synthetic images and constrained iframe viewports. Actual iOS Safari hardware, Photos permission and system sharing behavior were not exercised. Font sizing uses a common WeChat/iPhone 17px reference, not the user's WeChat accessibility/font settings. Native screen eyedroppers are intentionally replaced within the mask dialog by local RGB/HEX controls and original-pixel sampling; there is no extra full-resolution sampling canvas (only one 1×1 canvas).

## Reproduce

Run `node tests/release.cjs`. For exact pixel tests, install `@napi-rs/canvas` and run `node tests/color.cjs`. Run `node tests/prepare-preview.cjs`, serve `dist` locally, open `check.html` and click the regression button; open `matrix.html` for the size checks. Generated preview files are not production source files.
