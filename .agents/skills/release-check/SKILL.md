---
name: release-check
description: Diagnose 99.99% CI failures, or prepare a validated pull request. Use for PR readiness and release checks; invoking this skill alone does not authorize merging or deploying.
---

# PR and release verification

Read `.github/workflows/ci.yml` and `docs/DEPLOYMENT.md`. Preserve the required `frontend` and `backend` job names. Browser journeys are part of the required frontend job.

For a PR, inspect the final diff and run the relevant local checks in `docs/testing.md`. Confirm package manifests and locks agree, generated outputs are ignored, and no secrets or unrelated backend changes appear. State what changed, why, what was verified and what remains unverified. Create the PR when requested and inspect CI on the exact pushed commit; do not report an earlier run as current.

On failed CI, read the failing step and attached coverage/browser artifacts. Reproduce the smallest failing case. Fix the root cause before expanding verification; do not disable a check or update an expected outcome without explaining the changed behavior.

Use read-only checks unless the user's scope authorizes a mutation. Do not infer permission to merge, change branch protection, deploy or run live migrations from a request to create a PR. Report inaccessible hosted settings honestly.
