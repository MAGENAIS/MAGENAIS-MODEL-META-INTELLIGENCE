# Security Policy

## Scope

Meta-Intelligence 2.0.0 is a pure in-memory bookkeeping library. It accepts JSON-serializable inputs, stores tasks in a `Map`, and derives
views from them. It performs no network I/O, no file I/O, has zero runtime dependencies, and never `eval()`s or executes anything in its input.
It does not execute plans or decisions either: an `ACT` boundary or execution plan is data.

## Reporting a vulnerability

Open a private security advisory on this repository (GitHub → Security → Advisories → "Report a vulnerability") rather than a public issue. Include the
triggering input, observed vs expected behaviour, and the version (`model.json` → `version`).

## Supported versions

Only the latest 2.x release.

## Known limitations relevant to security

- Tasks are held in memory for the lifetime of the instance, with no eviction, expiry or size cap. A long-running service accepting untrusted,
  high-volume intake must impose its own limits.
- Caller-supplied task ids are plain `Map` keys, validated for presence only. Bound length and content yourself if ids come from untrusted input.
- Text fields are stored verbatim (trimmed). If you render them in HTML, escape them.
- DecisionScore perturbation cost grows with options × criteria × trials. Bound `scorerOptions.perturbationTrials` if those values come from untrusted input.
- There is no authentication or authorization: anyone holding an orchestrator instance can read and advance every task in it.

## Repository hygiene

The repository contains no credentials, API keys or machine-specific paths. `tests/api.test.ts` and the release audit check import paths; `.gitignore` excludes `.env*`, logs and archives.
