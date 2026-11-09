# v1.8.7 test revision 3

- Reproduced the r2 no-op clear action in a Chromium iframe allowing scripts and same-origin access but blocking native dialogs.
- In the same 320px preview, generated a synthetic recording twice. Verified the editor clear prompt, cancellation retaining the watermark, and confirmed clearing both directly in the editor and after returning to recording selection.
- Verified empty input, no stale result image, hidden quick-generation controls, reset watermark and JPEG default; then selected the synthetic video again and regenerated.
- Confirmed step 03, editor heading and step announcement all use 编辑保存. Node selection/crop tests pass. Stitching core unchanged; no GitHub push or deployment.
