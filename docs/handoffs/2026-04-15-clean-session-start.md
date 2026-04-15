# Clean Session Start

Date: 2026-04-15

## Start Here

Use this folder for all future work:

`C:\Users\krish\Projects\envalues`

The GitHub repo is:

`https://github.com/Krishnachaitanya-dev/envalues`

The active day-to-day branch is:

`main`

Use `main` for normal follow-up work after this setup checkpoint. Previous branch names came from the old parent repository setup and should not be used for new work.

## Current Local Setup

- `origin` points to `Krishnachaitanya-dev/envalues`.
- No old project remotes are configured.
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
