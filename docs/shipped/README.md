# Delivery log

Use one section per delivered change, grouped by ISO week in `YYYY_Wnn.md`. The format adapts
Admin's log: intent, branch/PR when available, changes, verification, and remaining work.

Documenting an existing implementation does not make the review date its functional delivery
date. Do not reconstruct test results or claim deployments from memory.

## Format

```text
## Change title

Intent: problem and expected behavior.
Branch/PR: reference, when available.
Changes: relevant files/contracts and reasons.
Verification: commands actually run and results; environment without secrets.
Remaining work: limits or open tasks.
```

Index: [2026 W42](2026_W42.md) · [2026 W43](2026_W43.md).
