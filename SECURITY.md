# Security Policy

## Scope

Meta-Intelligence, at its current version, is a pure in-memory
bookkeeping package: it accepts a JSON-serializable problem statement,
stores it in a `Map` keyed by task id, and derives a normalized view of
it. It:

- performs no network I/O,
- performs no file system I/O,
- has zero runtime dependencies,
- does not `eval()` or otherwise execute code contained in its input.

This significantly limits its attack surface, but the points below still
apply.

## Reporting a Vulnerability

If you believe you've found a security issue in this repository, please
open a private security advisory on this repository (GitHub → Security →
Advisories → "Report a vulnerability") rather than a public issue.

Please include:

- the input that triggers the issue,
- the observed vs. expected behavior,
- the package version (`model.json` → `version`).

## Supported Versions

Only the latest published `0.x` release is actively supported while this
package is pre-1.0.

## Known Limitations Relevant to Security

- `MetaIntelligenceOrchestrator` holds every intake task in memory for
  the lifetime of the instance — there is no eviction, expiry, or size
  cap. A caller embedding this package in a long-running service that
  accepts untrusted, high-volume intake should impose its own limits
  (max tasks per instance, periodic eviction) rather than relying on
  this package to do so.
- A caller-supplied task `id` (via `MetaIntelligenceIntakeRequest.id`) is
  used as a plain `Map` key; it is not validated for length or content
  beyond presence. Callers accepting `id` directly from untrusted input
  should apply their own bounds.
