# readable-src — read-only view of the live backend

This folder is a plain, browsable copy of the backend that Railway actually runs.
At startup, `extract-and-start.sh` unzips `CAELIA-BACKEND-SAVE.zip` and applies the
`overrides/` folder on top. This folder is that same result, already combined, so the
code can be read on GitHub.

- It is a COPY for reading. The deploy does not use it.
- Edits made here will NOT change the running backend. Change `overrides/` (or the zip) instead.
- If `overrides/` changes, this copy needs refreshing to match.
- No secrets are in here. Real values live in Railway variables only.
