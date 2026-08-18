# Copilot / AI-Assistant Instructions

Load this file before answering any question about this repository. It is the shared context between the human author and any AI assistant working on the code. Follow it as ground truth.

---

## 1. What this repository is

Public research repository (`parth5805/paladin-privacy-research`) that documents Hyperledger Paladin's privacy model, verified against a live v1.0.0 cluster. It is a mix of:

- **Written analysis** (`docs/`) — 5 long-form docs
- **Diagrams** (`diagrams/`) — 10 ASCII + Mermaid architecture diagrams
- **Reproducible demo** (`demo/`) — TypeScript demo that runs against a real 3-node Paladin cluster
- **Interactive single-file explainer** (`interactive-demo/index.html`) — 148 KB self-contained HTML with SVG topology, sidebar config, inspector, animated tx flow, zoom/pan/copy. This is the primary artefact that gets shown to stakeholders on calls. **Most active work happens here.**
- **Raw evidence** (`evidence/`) — untouched PR diffs, upstream source, live-run truth tables

**Read `README.md` first** for the map of what lives where.

---

## 2. Non-negotiable rules

These override any conflicting instruction elsewhere.

### 2.1 Sensitivity

**Zero client / employer / industry references anywhere in this repo.** Never mention:
- Any specific bank, financial-services firm, or company name (client-side OR employer-side)
- Any product name the author's employer uses internally
- Personal identifiers of the author beyond `parth5805` (the GitHub handle, which is already public)

Language throughout the repo is neutral: "enterprise blockchain teams", "organisation", "tenant", "project", "business unit". If you see anything company-specific slipping in during an edit, stop and remove it before continuing.

Before pushing, always run:

```bash
grep -riE "hsbc|bank|kaleido inc|financial services|@gmail|@hsbc|iamparth|parthpatel|proprietary|internal use only" \
  --include="*.md" --include="*.html" --include="*.js" --include="*.ts" --include="*.json"
```

Expect zero matches.

### 2.2 The interactive demo must stay single-file

`interactive-demo/index.html` is deliberately one file with **no external dependencies**. It must:

- Open by double-click on any modern browser (no build step)
- Work offline (no CDN, no fonts fetched, no images fetched, no analytics)
- Be attachable to email and function unchanged

If you need a library, inline it. If you need an image, inline as SVG or base64. Never add `<script src>` or `<link href>` to a remote resource.

### 2.3 Content accuracy

Every technical claim about Paladin must match reality. Ground truth is:

- Upstream repo: `https://github.com/LFDT-Paladin/paladin` (Linux Foundation Decentralized Trust)
- Released version we test against: `docker.io/lfdecentralizedtrust/paladin:v1.0.0`
- Reference: `evidence/upstream-manager.go` (a snapshot from a real clone) and `evidence/PR-872-full.diff` / `evidence/PR-912-revert.diff`

Key correct claims (do not "fix" these to something more comfortable):

- Paladin v1.0.0 enforces privacy at the **node** level, not the identity level
- Sub-node isolation is on the roadmap, not shipped
- Privacy group members are `identity@node` locators — not raw wallet addresses, not node objects
- Paladin's key manager derives the ETH address from the signing key when an identity is first resolved
- Cross-project privacy groups are real protocol behaviour, not a demo simulation
- Base chain (Besu) sees only opaque UTXO commitments — no plaintext contract args, return values, or events

---

## 3. `interactive-demo/index.html` — how it's structured

Single file, ~148 KB, ~2900 lines. Layout:

```
<head>
  <style> ... all CSS (~700 lines) ... </style>
</head>
<body>
  <header class="topbar"> ... brand + menu ... </header>
  <div class="layout">
    <aside class="sidebar"> ... config controls ... </aside>
    <main class="canvas">
      <div id="panel-pente">
        <div class="hero">
        <div class="canvas-grid">
          <div class="network-container"> ... SVG topology ... </div>
          <div class="inspector"> ... right-side panel ... </div>
        </div>
        <div class="tabs"> ... 8 content tabs ... </div>
      </div>
      <div id="panel-zeto"> ... coming soon ... </div>
      <div id="panel-noto"> ... coming soon ... </div>
      <div id="panel-guide"> ... reference ... </div>
    </main>
  </div>
  <div class="modal-backdrop" id="tx-modal"> ... tx flow animation ... </div>
  <div class="toast-container"> ... </div>
  <script> ... all JS (~1500 lines) ... </script>
</body>
```

### 3.1 State model (source of truth for all rendering)

```javascript
state = {
  besu: { faultTolerance: 2 },           // f; total validators = 3f+1
  projects: [{
    id: 'p1',
    name: 'Project A',
    color: '#4d7cfe',
    paladinNodes: 3,                     // count
    identities: [['user'], ['user'], ['user']],  // parallel array by node index
  }],
  privacyGroups: [{                      // TOP-LEVEL, not per-project
    id: 'g1',
    name: 'Group-1',
    members: [                           // identity@node locators as tuples
      { projectId: 'p1', nodeIndex: 0, identity: 'user' },
    ],
    contracts: [{ id, name, template, address, value, eventCount, deployedBy }],
    transactions: [{ id, timestamp, contractId, contractName, fn, arg, from, besuTxHash, besuBlock, utxoIn, utxoOut }],
  }],
  selectedProjectId: 'p1',
  selection: { kind: 'group'|'node'|'besu'|null, groupId?, nodeId?, besuId? },
  activeMenu: 'pente',                   // pente | zeto | noto | guide
  activeTab: 'segregation',
  useCases: {},                          // matrix chip selections
  decideAnswers: {},                     // decision-helper answers
  view: { zoom: 1, panX: 0, panY: 0 },   // SVG viewBox transform
};
```

Persistence: `localStorage` key `sharedchain-demo-v4`. If you change the schema in a breaking way, **bump the version** in `LS_KEY` at the top of the script so existing users get a clean migration.

### 3.2 The render pipeline

- `renderAll()` — full rebuild: sidebar + network + inspector + matrix + decide
- `renderStats()` — just numeric readouts (cheap, safe to call often)
- `renderProjectsList()` — regenerates the sidebar project list. **Preserves focus on `.project-name` input if the user is typing.**
- `renderPGList()` — sidebar privacy-groups list
- `renderNetwork()` — regenerates the entire SVG topology
- `renderInspector()` — right-side panel (dispatches to `renderGroupInspector` / `renderNodeInspector` / `renderBesuInspector` based on `state.selection.kind`)
- `renderMatrixRecommendation()`, `renderDecideResult()` — tab content

### 3.3 Event handling patterns

All event listeners are wired once at `DOMContentLoaded`. Dynamic content uses **event delegation** on stable parent elements (`#projects-list`, `#pg-list`, `#tab-nav`, `#uc-chips`, `#decide-form`).

**Never attach listeners inside a render function** — you'll leak handlers on every re-render.

---

## 4. Known gotchas (do not undo these)

Every item below was found the hard way. If a change reverses one of them, a real bug returns.

### 4.1 Focus loss on rename (fixed pattern to preserve)

The rename input in the sidebar (`.project-name`) must not lose focus while typing. The fix:

- On `input` event: only update state + dependent views (network, inspector, PG-section title). **Never call `renderProjectsList()`.**
- On `blur` event: `renderProjectsList()` is safe.
- If you must re-render the list while an input has focus, preserve `document.activeElement.dataset.pid` and `selectionStart`, then restore after `innerHTML =`.

Reference implementation: `renameProject()` and the `blur`-capturing listener in the projects-list wire-up.

### 4.2 Label overlap on SVG nodes

Do NOT put long text labels below SVG nodes when they can end up close to another node. History:

- Old: full node names below each node → collided with next row when >4 nodes
- Fix: short label (`p1`, `v1`) inside the node with a text stroke for legibility on any bg; full name only in tooltip (`<title>`) and inspector

For labels that must appear near multiple lines/nodes (protocol names on connections, etc.), place them in a **guaranteed empty region** (e.g. one per project in the layer gap), not per-item.

### 4.3 SVG text legibility across any background colour

Use the text-outline pattern so a single style works on yellow, purple, blue, and dark backgrounds:

```html
<text ...
  paint-order="stroke fill"
  stroke="rgba(0,0,0,0.5)" stroke-width="2.5" stroke-linejoin="round"
  fill="white"> ... </text>
```

Never add a dark inner circle behind text as a "backdrop" — it reads as an ugly shadow.

### 4.4 Layer-label / project-header clearance

The Paladin layer has:
- A layer label at `y = LAYER.paladin.yTop + 20` (top-left of the band)
- A project header rect that floats 10px above the project box top (`y = pb.y1 - 10`)

For clearance, `pb.y1 = LAYER.paladin.yTop + 50` (giving a 20px gap between label baseline and header rect top). If you change `yTop` or the header offset, re-check the arithmetic. Same principle applies if you add more floating labels.

### 4.5 Wheel zoom must be proportional to `deltaY` + throttled

Trackpads fire 20+ wheel events per gesture with small `deltaY` values; mice fire fewer events with large values. A fixed `1.12x` per event is far too fast on trackpad.

Correct pattern (already implemented in `scheduleWheelZoom`):

```javascript
const factor = Math.exp(-dy * 0.0015);  // proportional
// Also rAF-throttle: one apply per animation frame
```

Also implement **zoom-at-cursor** (`zoomAtClient` → `zoomAroundSvgPoint`): the SVG point under the mouse must stay fixed while zooming.

### 4.6 Slider re-renders must be rAF-throttled

`<input type="range">` fires many `input` events per second during drag. Doing `save()` + `renderNetwork()` synchronously on each event stutters the UI. Pattern (see `ft-slider` handler):

```javascript
let ftPending = false;
inputEl.addEventListener('input', e => {
  state.besu.faultTolerance = parseInt(e.target.value, 10);
  // Update cheap DOM immediately for responsiveness
  document.getElementById('ft-val').textContent = state.besu.faultTolerance;
  if (ftPending) return;
  ftPending = true;
  requestAnimationFrame(() => {
    ftPending = false;
    save(); renderStats(); renderNetwork();
  });
});
```

### 4.7 Peer / member labels in tx-flow SVG modal must be abbreviated

Full `identity@long-node-name` labels overlap when two peers are placed 90–140 px apart. Use the `shortenMember()` helper (`user@loan-paladin-3` → `user@p3`) and cap displayed peers to 2 with a `+N more` indicator for larger groups.

### 4.8 Every user-facing string in the tx-flow modal must reflect Paladin reality

The 9-step flow (`txSteps`) is the canonical wire-level lifecycle. Do not simplify or restate it in ways that misrepresent what Paladin actually does. In particular:

- Step 3 is "**Ephemeral EVM** spins up (in memory)" — fresh EVM per tx, not persistent
- Step 7 is "Base-chain commit" with a **UTXO transition + endorsement proof** — not plaintext
- Step 9 is "Non-member nodes see **NOTHING plaintext**" — the strongest privacy guarantee

### 4.9 Data model migrations must be defensive

`load()` handles migration from older `state` shapes on read (per-project → top-level privacy groups; missing `identities` array; missing `identity` on members). When adding a new field, extend this migration path — don't assume all users have a clean install.

### 4.10 Copy-diagram-as-PNG

`copyDiagramAsPNG()` serialises the SVG, rasterises via `<canvas>` at 2× scale, and writes to clipboard using `ClipboardItem`. It falls back to a file download if the clipboard image API is unavailable (older browsers, non-secure contexts). Don't rely on external libraries; the current implementation is browser-native and works offline.

---

## 5. Coding conventions

- Vanilla JS, ES2020+ features fine (arrow functions, template literals, destructuring, `async`/`await`, `??`, `?.`)
- No frameworks, no build step, no compilation
- Prefer **template literal SVG generation** for network rendering — clearer than `document.createElementNS` for dense output
- Prefer **event delegation** over per-element listeners
- Use `escapeHtml()` for any user-provided text embedded in HTML/SVG
- CSS custom properties for theme colours (`--primary`, `--besu-c`, `--paladin-c`, `--pg-c`, `--pente-c`, `--zeto-c`, `--noto-c`)
- Class names are semantic (`.svg-node`, `.svg-pg-card`, `.inspector-section`)
- Comments explain **why**, not what. Every recent fix has a short comment above it explaining the reasoning — preserve those.

---

## 6. Design language

The demo is deliberately Kaleido-inspired:

- Dark navy background (`#0a0e1a` → `#131a2b` radial gradient)
- Purple/blue primary gradient (`--primary` `#4d7cfe` → `--accent` `#7c5cff`)
- Warm yellow for Besu (`--besu-c` `#ffb545`)
- Purple for privacy groups (`--pg-c` `#a48bff`)
- Green for cross-project accents / success (`--success` `#00d4a7`)
- Rounded corners, soft glows on nodes, subtle gradient panel backgrounds
- Monospace (`ui-monospace, SFMono-Regular, Menlo`) for identity/RPC-style strings
- System font stack for UI copy

If a change would clash visually (bright saturated primaries, sharp corners, sans-serif everywhere), reject it.

---

## 7. Verification workflow

Before committing any change to `interactive-demo/index.html`:

```bash
cd paladin-privacy-research
node -e "
const fs = require('fs');
const html = fs.readFileSync('interactive-demo/index.html', 'utf8');
console.log('Size:', (html.length / 1024).toFixed(1), 'KB, Lines:', html.split('\\n').length);
const s = html.match(/<script>([\\s\\S]*?)<\\/script>/)[1];
try {
  new Function('document','window','localStorage','confirm','setTimeout','setInterval','Promise','Blob','URL','Image','XMLSerializer','navigator','ClipboardItem','requestAnimationFrame', s);
  console.log('JS syntax: OK');
} catch(e) { console.error('JS syntax error:', e.message); process.exit(1); }
const opens = (html.match(/<div/g) || []).length;
const closes = (html.match(/<\\/div>/g) || []).length;
console.log('div balance:', opens, 'vs', closes, opens===closes?'OK':'MISMATCH');
"
```

Then open in the browser (`open interactive-demo/index.html` on macOS) and visually verify.

Sensitivity sweep (see §2.1) is mandatory before pushing.

---

## 8. Git / publishing workflow

```bash
# From repo root
git status                                    # confirm expected files changed
git add interactive-demo/index.html <other>   # stage explicitly, never `git add -A`
git commit -m "..."                           # multi-line commit body preferred for non-trivial changes
git push origin main
```

Commit messages: short summary line + a body that explains **what problem was solved and why the specific approach was chosen**. Preserve the pattern in existing commit history (`git log --oneline` for style reference).

Never `git push --force` on `main`. Never commit anything that fails the sensitivity sweep. Never commit `node_modules/` (already gitignored).

---

## 9. How to interact with the human on this project

- The human is the domain expert and product owner. Ask when scope is unclear.
- **Bias toward action for small clear changes** (label position, wording, one-file edits). Ask before large structural changes.
- **Show your work.** When you fix a subtle bug, add a code comment explaining the root cause so it doesn't get undone.
- **Match tone.** The human prefers concise, evidence-based responses — no marketing language, no "great question!", no emojis in code or content unless already present.
- **Test before claiming done.** Visual features need a browser refresh; syntax needs the sanity script above.

---

## 10. Recent design decisions (context for future changes)

Read `git log --oneline -20` for the most recent commits and their reasoning. Highlights that inform ongoing design:

- **Removed dark inner circles from SVG nodes** — they read as ugly shadows. Text-outline pattern (§4.3) is the replacement.
- **Besu row now visually chained** — three parallel yellow rails + diamond block markers between adjacent validators.
- **JSON-RPC / QBFT-P2P / member protocol labels** on connection lines — one JSON-RPC pill per project (not per node) to avoid overlap; QBFT pill widened to fit "QBFT · P2P" text.
- **Cross-project privacy groups** are top-level, not per-project — reflects real Paladin protocol reality.
- **Identity model** — nodes host N named identities, group members reference `{projectId, nodeIndex, identity}` triples, node badge shows count when > 1.
- **Zoom-at-cursor + rAF-throttled + exponential-to-deltaY** — the correct pattern for smooth zoom on both trackpad and mouse.
- **New project default is 3 Paladin nodes** (was 2) — matches initial Project A default and gives a more realistic BFT-adjacent number.

---

## 11. If Copilot / another AI is unsure

Do not invent Paladin behaviours. Consult:

1. The `docs/` folder — human-authored, ground-truth accurate
2. The `evidence/` folder — actual PR diffs and upstream source
3. `README.md` — repo overview
4. `interactive-demo/WALKTHROUGH.md` — how the demo is meant to be used

If a claim can't be sourced from one of the above, say "I don't know — let's verify from `LFDT-Paladin/paladin` upstream". Never fabricate.
