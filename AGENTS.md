## Context Navigation

1. ALWAYS query the knowledge graph first.
2. Only read raw files if the user explicitly says so.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python -m graphify update .` to keep the graph current

## Shipping Discipline

Rules:
- Work on `main` only.
- After any code change, create a git commit and push to `origin main` so nothing goes untracked.
