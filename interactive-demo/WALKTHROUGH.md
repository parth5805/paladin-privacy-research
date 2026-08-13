# 30-Minute Client Walkthrough — SharedChain Interactive Demo

A ready-to-use script for demoing the interactive explainer to clients or stakeholders on a call. Six 5-minute chunks, each with what to click and what to say. Everything below runs entirely inside the single HTML file — no external systems needed.

**Before the call**

1. Open [`index.html`](./index.html) in Chrome, Firefox, Safari, or Edge.
2. Optional: click **`Reset topology`** in the sidebar to make sure you start from the default Project A setup.
3. Have the browser filling most of the screen so the diagram is legible on screen-share.

**Contents**

- [0:00 – 5:00 · Set the stage](#000--500--set-the-stage-why-this-exists)
- [5:00 – 10:00 · Build the topology live](#500--1000--build-the-topology-live)
- [10:00 – 15:00 · Inspect each layer](#1000--1500--inspect-each-layer)
- [15:00 – 22:00 · Private-transaction lifecycle](#1500--2200--private-transaction-lifecycle-the-money-shot)
- [22:00 – 27:00 · Decision framework tabs](#2200--2700--decision-framework-tabs)
- [27:00 – 30:00 · Zoom, copy, close](#2700--3000--zoom-copy-close)
- [10-minute cut (if time is short)](#10-minute-cut-if-time-is-short)
- [Common client questions](#common-client-questions--demo-based-answers)

---

## 0:00 – 5:00 · Set the stage (why this exists)

**Click:** open `index.html`. Leave the default Project A setup visible.

**Say:**

> You're looking at SharedChain — one shared blockchain infrastructure that hosts many independent projects. Three layers, top-down: **privacy groups** hold your private contracts, **Paladin nodes** run them for each tenant, and **shared Besu** is the base chain everyone commits to. Every line is labelled with its protocol so you can read the wire diagram at a glance.

**Point to:**

- The three horizontal bands with their labels
- `JSON-RPC` pill labels on Paladin → Besu lines
- `QBFT · P2P` pill labels on the Besu chain rails
- `member` labels between the privacy group card and its Paladin nodes
- The tenant box `PROJECT A` with 3 Paladin nodes `p1 p2 p3`

---

## 5:00 – 10:00 · Build the topology live

Do this in the left sidebar, in order:

1. Move the **fault-tolerance slider** from 2 → 3 → back to 2. Watch the Besu chain grow from 7 → 10 validators (`3f + 1`) and shrink back.
2. Click **`+ Add project`** → Project B appears with 3 nodes.
3. Click **`+ Add project`** again → Project C.
4. On Project B, click **`+`** in the "Paladin nodes" row twice → Project B is now 5 nodes.
5. With Project B still selected in the sidebar, click **`+ New privacy group (this project)`** → a `Group-2` appears containing all 5 of B's nodes.
6. Click **`+ Cross-project privacy group`** → a green-badged `Cross-Group-3` appears with one member from every project.

**Say:**

> Every tenant gets its own Paladin nodes on the same shared Besu. Privacy groups can live inside one project or span multiple — that's a real Paladin capability, not a demo simulation. A privacy group is just a list of `identity@node` locators, and nothing in the protocol enforces a project boundary.

---

## 10:00 – 15:00 · Inspect each layer

Click each of these in the diagram, one at a time. The right-side inspector updates each time.

| Click | What the client sees |
|-------|----------------------|
| **v3** (any Besu validator) | Validator identity + JSON-RPC / WSS / GraphQL / enode / metrics endpoints, each with a copy button |
| **p1** in Project A | Node identity, RPC endpoints, list of **identities hosted on this node**, memberships |
| The **`+ Add`** button in the identities section | A second identity `identity-1` appears — the p1 node now shows a "2" badge |
| A privacy group card | Members shown as `identity@node` chips, member picker grouped by project → node → identity |

**Say:**

> The isolation unit in Paladin is the node, not the identity. Any identity that lives on a member node can read that group's private state. That's why picking node-per-tenant is our default recommendation for anything with external counterparties.

---

## 15:00 – 22:00 · Private-transaction lifecycle (the money shot)

In the privacy group card you just inspected:

1. Click **`+ Deploy`** → `Storage-1` contract appears. Point out:
   - The contract chip inside the PG card
   - The new row in "Recent transactions" (this is the deployment commit)
   - The **split view** at the bottom: "BASE BESU (PUBLIC)" shows only opaque hashes; "PALADIN MEMBERS (PRIVATE)" shows the plaintext contract state.
2. Click **`Send private tx →`** on the contract → the animation modal opens.
3. Let the **9 steps** animate (~6 seconds). Read them out loud as they light up:
   1. App submits `pgroup_sendTransaction`
   2. Paladin prepares
   3. Ephemeral EVM spins up
   4. Executes bytecode
   5. Requests endorsement from peers
   6. Peers re-execute and sign
   7. Base-chain commit (UTXO transition + endorsement proof)
   8. State distribution to members only
   9. Non-member nodes see NOTHING plaintext
4. Click **Run again** — the contract value updates in real time.
5. Close the modal and look at the split view again — Besu block count and UTXO hashes grew; Paladin members show the new value.

**Say:**

> This is what actually happens in Paladin. Non-member nodes on the same Besu network see only opaque commitments — never the arguments, return values, or events. That's the cryptographic isolation guarantee.

---

## 22:00 – 27:00 · Decision framework tabs

Click each tab below the network and give the one-line takeaway:

| Tab | Show them | One line to say |
|-----|-----------|-----------------|
| **Data segregation** | The three cards + the green "cross-project is real" callout | "Two dimensions of isolation: privacy groups within a tenant, nodes across tenants" |
| **Token / domain matrix** | Tick 2–3 of the use-case chips (private EVM, private events, cross-group) → recommendation updates live | "Pente for logic, Zeto for ZK, Noto for regulated" |
| **BCP / DR** | The failure-class table + the "one scenario infra can't save you from" callout | "Application-owned recovery — blockchain has no rollback" |
| **Upgrades** | The tenant vs platform table + the "3f+1 gives you comfort during rolling upgrades" callout | "Platform team owns Besu/Paladin, tenant owns contracts" |
| **Should I use SharedChain?** | Answer the 4 chips live → get an A/B/C recommendation | "Same 4 questions for every new project, same repeatable answer" |

---

## 27:00 – 30:00 · Zoom, copy, close

1. **Scroll wheel** on the canvas → smooth zoom in/out around the cursor.
2. **Drag** the canvas → pan around when zoomed.
3. Click the **`+`** / **`−`** / **`⟲`** buttons top-right of the canvas.
4. Click the **📋** button → the diagram is copied to your clipboard as a 2× PNG. Paste it into a chat / slide as proof.
5. Click **`Reset topology`** at the bottom of the sidebar if you want a clean slate for Q&A.

**Close with:**

> Everything you just saw runs in one HTML file — no server, no login, no external calls. I can send you the file and you can play with the topology yourself. Same defaults, same behaviour, same story.

---

## 10-minute cut (if time is short)

If time is tight, drop straight to these 5 clicks:

1. **Fault-tolerance slider** — shows Besu grows with `3f + 1`.
2. **`+ Cross-project privacy group`** — shows cross-tenant reality.
3. Click a **Besu validator** — shows RPC endpoints.
4. **`+ Deploy`** then **`Send private tx →`** — shows the 9-step lifecycle + split view.
5. **Should I use SharedChain?** tab — answer 4 chips → get a recommendation.

That covers 80% of the value in 10 minutes.

---

## Common client questions & demo-based answers

| Question | Answer + what to click |
|----------|------------------------|
| "Can projects see each other's data?" | Click any Besu validator → the "Sees only opaque UTXO hashes" section |
| "What if we need to combine two projects atomically?" | Point to the cross-project group + the L2 tab's flow diagram |
| "What happens if a node dies?" | Click **BCP** tab → failure-class table |
| "How do we upgrade without breaking tenants?" | Click **Upgrades** tab → the rolling-upgrade flow |
| "How many privacy groups can we run?" | Click **Data segregation** tab → "unlimited per node" card |
| "Are those cross-project groups real Paladin or a demo trick?" | Data segregation tab → the green "Cross-project privacy groups are real Paladin" callout |
| "Can we recover a bad transaction?" | BCP tab → "bad on-chain data → compensating transaction" row + the callout about append-only ledgers |

Save the interactive demo file — clients often want to poke at it themselves after the call.
