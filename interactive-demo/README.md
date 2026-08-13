# Interactive Demo — SharedChain Explainer

A single self-contained HTML file that visually explains a shared-blockchain platform pattern built on Hyperledger Besu + Paladin. Nothing to install — just open it in a browser.

## Run

Any of:

```bash
# Open directly in a browser
open interactive-demo/index.html          # macOS
xdg-open interactive-demo/index.html      # Linux
start interactive-demo/index.html         # Windows

# Or serve it (useful when sharing on a laptop over LAN)
python3 -m http.server -d interactive-demo 8080
# then visit http://localhost:8080
```

Works fully offline. No CDN dependencies. No build step. Topology choices persist in the browser's `localStorage`.

## What it does

Interactive dashboard for exploring the design space of a shared enterprise-blockchain platform:

- **Live network topology.** Adjust fault tolerance, add tenants, tune Paladin node counts, create privacy groups. The network diagram updates in real time.
- **Domain decision matrix.** Tick your use-case requirements — the recommended Paladin domain (Pente / Zeto / Noto) updates with a scored rationale.
- **Should-I-use-SharedChain helper.** Four questions produce a specific topology recommendation (Options A / B / C).
- **Tabbed reference.** Data segregation, L2 integration, BCP / DR, upgrades, release patterns, migration path — all in short scannable panels with tables and callouts.

## Sharing

The whole thing is one file. You can:

- Attach `index.html` to an email — the recipient opens it in any modern browser
- Host it on any static site host (GitHub Pages, S3, etc.)
- Embed in an internal knowledge base as an iframe

## Presenting to a client / team

See **[WALKTHROUGH.md](WALKTHROUGH.md)** — a ready-to-use 30-minute call script with what to click, what to say, a 10-minute cut for shorter calls, and a table of common client questions with the exact demo view that answers each one.

## Design notes

- Pure HTML + CSS + vanilla JS. No frameworks, no build.
- SVG-based network visualisation, rendered from state.
- Kaleido-inspired dark UI with gradient accents.
- Fully responsive down to ~700px width.
- Zero external requests. Zero telemetry.

## Related

- Full research repo: [../README.md](../README.md)
- Written docs: [../docs/](../docs/)
- Reproducible demo running against real Paladin v1.0.0: [../demo/](../demo/)
