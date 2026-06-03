#!/usr/bin/env bash
# Vercel "Ignored Build Step" script.
#
# Vercel calls this before deciding whether to build. Exit code semantics:
#   exit 0  → CANCEL the build (skip it)
#   exit 1  → CONTINUE with the build
#
# Configure each Vercel project to invoke this with the branch it should
# build for. In Vercel project settings → Git → "Ignored Build Step":
#
#   Production Vercel project (live site):
#     bash scripts/vercel-ignore-build.sh master
#
#   Staging Vercel project (staging.purrtraits.shop):
#     bash scripts/vercel-ignore-build.sh staging
#
# This way each Vercel project only builds when its target branch changes;
# pushing to a feature branch won't accidentally deploy to staging or prod.

set -euo pipefail

TARGET_BRANCH="${1:-}"
CURRENT_BRANCH="${VERCEL_GIT_COMMIT_REF:-}"

if [[ -z "$TARGET_BRANCH" ]]; then
  echo "ERROR: target branch argument is required" >&2
  exit 1  # build anyway so the misconfig is visible
fi

if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "WARNING: VERCEL_GIT_COMMIT_REF is unset; defaulting to build" >&2
  exit 1
fi

if [[ "$CURRENT_BRANCH" == "$TARGET_BRANCH" ]]; then
  echo "Branch '$CURRENT_BRANCH' matches target '$TARGET_BRANCH' — building."
  exit 1
fi

echo "Branch '$CURRENT_BRANCH' does not match target '$TARGET_BRANCH' — skipping build."
exit 0
