# v1.8.5 verification — 2026-11-08

- Update result messages disappear after 3.5 seconds for latest-version, offline, error and newer-version responses. Loading remains visible until the request completes; repeated checks cancel the previous timer. The new-version dialog/banner remains available after the transient result disappears. Verified with controlled timers in `node tests/update-status.cjs` and an actual browser button click.
- Region-settings collapsed outer border and image-format select both measure 44px. Expanded region settings retain all numeric inputs. Verified at 320×568, 375×667, 375×812, 390×844, 393×852, 414×896, 430×932, 440×956 and 844×390.
- Mask center tap and keyboard selection no longer open the color dialog. The sole entry is the color option in Privacy. Existing mask colors, new-mask defaults, original-pixel sampling, RGB/HEX synchronization, cancel restoration, zoomed coordinates, file synchronization, navigation and reset passed browser regression checks.
- A manual 320px-wide browser flow confirmed mask drawing, center tapping, dragging, corner resizing and opening the color editor through Privacy. No horizontal overflow was found.
- Existing release/cache/consent regression checks and pixel tests pass. Watermark defaults remain unchanged. Inline video generation/stitching/sharing code is unchanged, and previous release notes and appreciation asset are preserved.

Browser checks used Chromium and generated color blocks. Actual iOS Safari hardware and the Photos sharing sheet were not tested. No user recording is included. Publication appends a new child commit and preserves the existing Git history.
