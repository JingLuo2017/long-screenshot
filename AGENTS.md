# Project maintenance instructions

## Preserve all history

- Every GitHub change must append a new commit whose parent is the current branch head. Preserve all existing commits and version records.
- Never force-push, amend or rebase published commits, squash away published history, delete historic refs, or reset a published branch to an earlier commit.
- Use an expected-head check and non-forced fast-forward ref updates. If the head changed, inspect and incorporate the intervening work before retrying.
- Roll back by adding a revert commit or restoring old file contents in a new child commit. Never erase the later commits.
- Each release must have a new version number and release notes. Record verification and known limitations, and keep previous release notes.

## Scope

- Preserve the existing stitching algorithm and known deferred stitching issues unless the user explicitly authorizes changes.
- Keep user recordings and generated images on the device; do not upload private fixtures to the repository.
