# For AI Assistants Working on This Repository

If you are an AI assistant (Copilot, Claude, Cursor, Cody, or anything else) about to make changes here, **read [`.github/copilot-instructions.md`](.github/copilot-instructions.md) first**. That file is the shared ground-truth context between the human author and any AI collaborator, and covers:

- What this repository is and how the pieces relate
- Non-negotiable rules (sensitivity, single-file demo, content accuracy)
- The interactive demo's structure, state model, and rendering pipeline
- Known gotchas that must not be undone (focus loss, label overlap, zoom speed, and more — every one caused a real bug once)
- Coding conventions and design language
- Verification script + git / publishing workflow
- Recent design decisions that inform future changes

TL;DR of the load-bearing rules:

1. No client / employer / bank / industry references anywhere. Sensitivity sweep is mandatory before every push.
2. `interactive-demo/index.html` must stay a single self-contained file with zero external dependencies. Works offline. Attachable to email.
3. Every technical claim about Paladin must match the upstream project (`LFDT-Paladin/paladin`) and the pinned release `v1.0.0`. Ground truth lives in `evidence/`.
4. Preserve every `// fix` comment in the code — each marks a subtle bug that was found the hard way.
5. Run the sanity script in `.github/copilot-instructions.md §7` before committing to `interactive-demo/index.html`.

Prefer small, explained diffs over large rewrites. Match the existing tone in commit messages and code comments (concise, evidence-based, no marketing language).
