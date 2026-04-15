# Clean Session Start

Date: 2026-04-15

## Start Here

Use this folder for all future work:

`C:\Users\krish\Projects\envalues`

The GitHub repo is:

`https://github.com/Krishnachaitanya-dev/envalues`

The active day-to-day branch is:

`feat/phase3-cicd-infra`

Use `feat/phase3-cicd-infra` for normal follow-up work after this setup checkpoint. The `infra/clean-repo-bootstrap-2026-04-15` branch remains as the bootstrap/review branch.

## Current Local Setup

- `origin` points to `Krishnachaitanya-dev/envalues`.
- The old `alachat-platform` remote exists only as a reference remote.
- `.git` is inside this folder, so Git no longer scans `C:\Users\krish`.
- Graphify has been regenerated in this folder.
- Codex Graphify integration is stored in `.codex/hooks.json`.
- Claude Code Graphify integration is stored locally in `.claude/settings.json`.
- Git hooks for Graphify are installed locally for post-commit and post-checkout.

## Session Rules

- Query Graphify before raw-file inspection for architecture/codebase questions.
- Keep work scoped to `C:\Users\krish\Projects\envalues`.
- After code changes, run `python -m graphify update .`.
- Before commit, run `npm test -- --run` and `npm run build` when the change touches runtime or UI behavior.
- Never commit `.env`, `graphify-out/`, `dist/`, `node_modules/`, or Supabase local temp state.
