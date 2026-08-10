# Page 5 — Adoption Planning Discussion

**Purpose:** discussion material for a pre-funding architecture review. This is *not* a decided design; it is a structured way to have four related conversations in one sitting.

**Audience:** technical leadership plus one or two product / operations stakeholders. Anyone comfortable reading the earlier pages of this repo will follow this one.

**Time to walk through:** ~45 minutes end-to-end. Each of the four agenda sections is ~10 minutes of discussion with a clear decision point at the end.

---

## Contents

- [Agenda 1 — Shared vs Dedicated Infrastructure (a repeatable choice)](#agenda-1--shared-vs-dedicated-infrastructure)
- [Agenda 2 — Business-Continuity Resilience Must Be Application-Owned](#agenda-2--business-continuity-resilience-must-be-application-owned)
- [Agenda 3 — A Potential Logical Architecture](#agenda-3--a-potential-logical-architecture)
- [Agenda 4 — What Paladin Delivers Today vs Roadmap Gaps](#agenda-4--what-paladin-delivers-today-vs-roadmap-gaps)
- [Meeting decision log template](#meeting-decision-log-template)

---

## Agenda 1 — Shared vs Dedicated Infrastructure

### The question we need to answer once and reuse

For every new project the organisation wants to run on the blockchain platform, someone has to answer:

> Does this project run on the **shared** infrastructure (one Besu network, one operational team, one governance model) or does it get **dedicated** infrastructure (its own Besu network, its own operations, its own governance)?

We need a **repeatable** answer — the same set of questions produces the same decision every time, regardless of which team asks. Otherwise every project becomes an architecture debate.

### The four decision axes

Every project can be scored along these four axes. Some projects will pull the answer toward "shared", some toward "dedicated". The framework's job is to make that pull explicit.

| Axis | What it means | Pulls toward shared | Pulls toward dedicated |
|------|---------------|---------------------|------------------------|
| **Time-to-market** | How fast the project needs to be live | Shared: infra already exists, days | Dedicated: weeks to bring up own network + ops |
| **Complexity** | How much operational and organisational surface area the team can carry | Shared: one team runs it all | Dedicated: this project owns everything, more surface area |
| **Run cost** | Ongoing infra + ops cost per year | Shared: amortised across many projects | Dedicated: full-stack cost owned by this project |
| **Privacy** | What isolation guarantee the project actually needs | Shared: fine when isolation can be achieved by node topology + privacy groups | Dedicated: required when full network-level cryptographic isolation is non-negotiable |

### Three deployment options

**Option A — Fully shared**
- One Besu network. One Paladin operator. One Kubernetes cluster.
- All projects join as tenants on the shared platform.
- Isolation between projects is by privacy group membership and node placement.

**Option B — Hybrid (shared base, dedicated privacy)**
- One shared Besu network (organisation-wide).
- Each project gets its own Paladin nodes on the shared Besu.
- Privacy groups do not cross projects unless explicitly required.

**Option C — Fully dedicated**
- Separate Besu network *and* separate Paladin nodes per project.
- Independent governance, independent upgrade schedule, independent incident response.
- No shared blast radius with any other project.

### Comparison table

| | **A: Fully shared** | **B: Hybrid** | **C: Fully dedicated** |
|--|--|--|--|
| Time-to-market for a new project | Days | 1–2 weeks | 4–8 weeks |
| Run cost (relative) | 1× | ~1.5–2× | 3–5× per project |
| Ops complexity | Low (one platform team) | Medium (platform + per-project owners) | High (per-project ops) |
| Cross-project atomic interop | Native (base chain) | Native (same base chain) | Requires cross-chain bridge |
| Privacy isolation between projects | Depends on node topology (see [docs/02](02-privacy-model-history.md)) | Cryptographic (separate Paladin nodes) | Cryptographic + separate base chain |
| Blast radius of a base-chain incident | All projects | All projects | Only this project |
| Independent regulator / legal segregation | Weak | Medium (per-project keys/nodes) | Strong (per-project everything) |
| Governance flexibility | Shared upgrade cadence | Shared base, per-project apps | Fully independent |

### Repeatable decision tree

```
For every new project, in order:

1. Does the project involve counterparties or data that require the platform
   to be legally or regulator-segregated from every other project?
        │
        ├─ Yes → Option C (dedicated)
        │
        └─ No → continue

2. Does the project need cryptographic isolation of its private data from
   other projects on the same platform?
        │
        ├─ Yes → Option B (hybrid: dedicated Paladin nodes, shared Besu)
        │
        └─ No → continue

3. Does the project's time-to-market pressure exceed 1 month?
        │
        ├─ Yes → Option A (fully shared)
        │
        └─ No → default Option B (hybrid) unless someone can justify
                downgrading to A on cost grounds
```

This tree deliberately biases toward B (hybrid) as the safe default, because B gets you cryptographic project-level isolation at only a small marginal cost over A.

### Repeatable intake questionnaire

Any team proposing a new project should answer these five questions in one page. The answers feed the decision tree above.

1. Who are the participants in this project — internal teams only, external counterparties, or a mix?
2. What data will live in the private state? Is any of it subject to regulator or legal segregation?
3. What is the required go-live date, and what is the acceptable range?
4. Which existing projects (if any) must this project atomically interoperate with?
5. Who owns the operational runbook and BCP procedures for this project? (See [Agenda 2](#agenda-2--business-continuity-resilience-must-be-application-owned).)

### A note on cost intuition

The infrastructure cost of a Paladin node is small — roughly 2 vCPU, 2 GB RAM, 20 GB storage per node, plus a Postgres. Even fully-dedicated Option C is affordable in absolute terms. The real cost multiplier of C is not compute; it is the ops team's cognitive load of running N independent stacks. If the platform team is small, that alone can make B or A the better answer.

### Decision expected from this agenda

- Agree the four decision axes and the tree above (or amend it).
- Agree the intake questionnaire and where it lives.
- Nominate a decision owner (platform architect) who signs off the choice for each new project using this framework.

---

## Agenda 2 — Business-Continuity Resilience Must Be Application-Owned

### The core insight

A blockchain does not offer "restore the world to yesterday". Ledger state is append-only by design. If bad data lands, you **cannot** rewind it; you have to **write forward** with a compensating action.

That means BCP for a blockchain-backed project cannot be handled purely by the infrastructure team. It has to be co-owned by the application team, because the "undo" is a business action expressed in smart-contract code, not an operator command.

### What infrastructure gives you (and what it cannot)

| Failure class | Handled by infrastructure? | Handled by application? |
|---------------|---------------------------|-------------------------|
| Node process crashes | ✅ (restart, orchestration) | — |
| Single-node DB corruption | ✅ (restore from replica or resync from peers) | — |
| Loss of one member node's DB while other members still hold state | ✅ (rebuild by syncing from surviving members) | — |
| Loss of ALL member nodes' state for a private group | ❌ *(the data is gone — see below)* | Partial: possibly re-derive from external systems |
| Bad data recorded on-chain (wrong value, wrong counterparty) | ❌ | ✅ (compensating transaction) |
| Smart contract bug producing wrong state | ❌ | ✅ (governance-approved migration) |
| Cross-project cascade from one project's incident | Partial (isolation via topology) | ✅ (application-level ACLs and isolation) |
| Malicious identity abusing access | ❌ | ✅ (revoke keys, migrate contract, compensating tx) |

**The "all member nodes lost" case is the sharpest one for private data.** Because privacy = fewer copies, private group state exists only on member nodes. If every member node loses its DB simultaneously (rare but possible: a bad backup restore across the fleet, a regional outage combined with a mis-configured DR), the plaintext is unrecoverable. The base chain retains only opaque commitments; those cannot be reversed to plaintext without the pre-image, which was in the DBs you just lost.

### Failure scenarios worth walking through in the meeting

For each scenario the room should agree: *who owns the runbook, and what does the fix look like?*

1. **A single node in a 3-member group loses its DB.**
   Recovery: bring node back, resync state from peers, resume. No data loss. Infrastructure-owned.

2. **All member nodes of a private group lose their DBs on the same day.**
   Recovery: infrastructure cannot help. Application team must re-derive state from external systems (source of truth) or accept the loss. This is why per-project **off-Paladin backups of critical state** are a good idea, with encryption and key management owned by the project.

3. **A user writes wrong data into a private contract.**
   Recovery: the application contract must expose a governance-guarded "correct" function that emits a compensating event and updates state to the correct value. Both the incorrect and correcting transactions are preserved on-chain; the state resolves to correct.

4. **A smart contract bug produces wrong state on a subset of records.**
   Recovery: deploy a corrected contract version, migrate state via a governance-guarded migration function, deprecate the old contract address. The migration itself is a set of compensating transactions.

5. **A malicious or compromised identity performs unauthorised writes.**
   Recovery: rotate keys, revoke the identity from the privacy group (requires re-creating the group with new membership since group membership is set at genesis), and issue compensating transactions to undo the writes' business effect.

6. **One project's incident threatens to spill into another (e.g. shared base-chain congestion, shared operational team).**
   Recovery: agenda 1's isolation choice determines the blast radius. Option A shares base chain; a Besu incident affects everyone. Option B / C limit it.

### Application patterns that enable BCP

These are patterns to bake into every contract the organisation deploys.

**1. Compensating action pattern**

Every state-changing function `f()` should have a paired governance-guarded `f_reverse()` that:
- Takes the original transaction reference as input
- Requires multi-signature or governance approval
- Emits a `Compensated(txId, reason)` event so audit trails are intact
- Writes forward to correct state — never claims to "delete" history

```solidity
// Illustrative pattern
function transfer(address to, uint256 amount) external { ... }

function reverseTransfer(bytes32 originalTxId, string calldata reason)
    external
    onlyGovernance
{
    // Undo the business effect of the original tx.
    // Emit a compensating event so both original and correction are visible.
    emit Compensated(originalTxId, reason);
    // ... write-forward correction ...
}
```

**2. Governance-guarded upgrade pattern**

Contracts are deployed behind an upgradeable proxy or a versioned dispatcher, with the upgrade action requiring multi-signature approval. The upgrade transaction itself is on the chain and auditable.

**3. Off-chain reconciliation pattern**

Every state-changing transaction emits an event with enough information for external systems to reconcile. Periodic reconciliation jobs compare on-chain state against source-of-truth systems and flag drift. Drift is fixed via the compensating action pattern.

**4. Cross-project isolation pattern**

Each project deploys its contracts to its own privacy group(s). Contracts do not directly call across privacy groups. Cross-project interactions happen only through explicit atomic-swap patterns coordinated at the base chain (see [diagram 08](../diagrams/08-cross-group-atomic.md)). This ensures that one project's failure or bad data cannot silently corrupt another project's state.

**5. Backup of critical state to off-Paladin storage**

For projects where the "all-member-node-loss" scenario is a business-material risk, the application should periodically export critical state to an off-chain encrypted backup (e.g. object storage in a different failure domain). The backup must NOT weaken privacy — encrypt with keys managed only by the project, and never store plaintext outside member nodes.

### Decision expected from this agenda

- Agree that BCP requires application co-ownership (not infra-only).
- Agree the five patterns above as organisational baseline for every project's contract design.
- Nominate a BCP-review checkpoint in the project intake process (Agenda 1) — no project onboards without a BCP runbook.

---

## Agenda 3 — A Potential Logical Architecture

### Layered view

The architecture that satisfies both Agendas 1 and 2 has four layers. Each layer has a single, clear owner.

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 4 — GOVERNANCE                                         │
│  Multi-sig contracts, upgrade approvals, compensating-action  │
│  approvals, key rotations.                                    │
│  Owner: Governance Committee (cross-functional)               │
└──────────────────────────────────────────────────────────────┘
           │  governance transactions
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 3 — APPLICATION                                        │
│  Business smart contracts, compensating actions, off-chain    │
│  reconciliation jobs, project-specific APIs.                  │
│  Owner: Project team                                          │
└──────────────────────────────────────────────────────────────┘
           │  private transactions
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2 — PRIVACY (Paladin)                                  │
│  Paladin nodes, privacy groups, ephemeral EVMs, state         │
│  distribution, endorsement.                                   │
│  Owner: Platform team (shared) with per-project node ownership │
└──────────────────────────────────────────────────────────────┘
           │  UTXO commitments, endorsement proofs
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 1 — BASE CHAIN (Hyperledger Besu)                      │
│  Consensus (QBFT/IBFT), block production, atomic settlement.  │
│  Owner: Platform team                                          │
└──────────────────────────────────────────────────────────────┘
```

### Deployment topology (hybrid, matching Agenda 1's default)

```
                Shared Hyperledger Besu (base chain)
                                │
   ┌────────────┬───────────────┼───────────────┬────────────┐
   ▼            ▼               ▼               ▼            ▼

Project 1     Project 2      Project 3       Project 4  ...
Paladin       Paladin        Paladin         Paladin
node(s)       node(s)        node(s)         node(s)
                                │
                          Per-project:
                          - Its own Paladin nodes
                          - Its own application DBs
                          - Its own monitoring dashboards
                          - Its own runbooks and on-call rotation
                          - Its own governance contracts
                          - Its own off-Paladin backups (if applicable)

                    Shared platform team owns:
                    - Base Besu network operation
                    - Kubernetes cluster
                    - Common observability / SIEM
                    - Common secret management
                    - Common upgrade cadence for platform components
```

### How this satisfies Agenda 1

- Fast time-to-market: platform team pre-builds the Kubernetes templates, so a new project's Paladin nodes come up in a day.
- Manageable complexity: platform layer is shared; application layer is owned per project.
- Cost efficient: one Besu cluster, one K8s, one observability stack.
- Privacy-respecting: cryptographic isolation between projects is achieved at the Paladin-node layer.

### How this satisfies Agenda 2

- Application layer owns compensating actions — the "undo" logic sits in each project's contracts.
- Governance layer approves reversals — no single team can silently mutate state.
- Per-project node ownership means one project's incident does not cascade to another's DB.
- Common platform layer provides HA / DR for the shared components (Besu, K8s), while each project owns HA / DR for its own Paladin nodes and application DB.

### High-availability topology (per project)

For each project, the minimum production topology to survive a single-node failure without data loss:

```
Project P privacy group members:
   ├── paladin-node-P-1  (primary,  region-A)
   ├── paladin-node-P-2  (secondary, region-A different AZ)
   └── paladin-node-P-3  (DR,        region-B)

All three receive state distribution for every P transaction.
Any two can serve reads. Any two suffice for endorsement.
Loss of any one is a routine recovery event (resync from peers).
Loss of all three simultaneously = agenda 2 scenario (2) → off-Paladin backup.
```

### Governance layer (concrete)

Each project deploys a **Governance Contract** that:
- Holds the list of governance-approved signers
- Requires an M-of-N signature threshold for any protected action
- Exposes protected wrappers for: `upgrade`, `pause`, `reverseTransaction`, `revokeIdentity`, `updateThreshold`
- Emits `GovernanceAction(actionType, target, approver, reason)` events for audit

The application contracts guard their state-changing sensitive functions with `onlyGovernance` modifiers that check with this contract.

### Off-chain support systems (per project)

- **Reconciliation service** — periodically compares on-chain state (via `pgroup_call`) with the project's source-of-truth systems.
- **Event indexer** — subscribes to domain receipts, materialises a queryable projection of the private state for the project's own UI.
- **Alerting** — plugs into shared observability; alerts on failed endorsements, stalled transactions, unusual compensation frequency.
- **Encrypted state backups** (optional per project) — dumps of critical private state to off-Paladin encrypted storage; keys held by the project's key custodian.

### Decision expected from this agenda

- Agree the four-layer model and its owners.
- Agree the default hybrid topology from Agenda 1 as the reference architecture.
- Agree the HA-per-project minimum of three member nodes across at least two failure domains.
- Agree the governance-contract pattern as the mandatory guardrail for state mutations.

---

## Agenda 4 — What Paladin Delivers Today vs Roadmap Gaps

For the architecture in Agenda 3 to work, we need certain things from Paladin. Some are available now in v1.0.0. Others are on the maintainers' roadmap. A few are things we would raise as feature requests.

### What Paladin v1.0.0 gives us today (mapped to our architecture)

| Architecture need | Paladin capability | Reference |
|-------------------|--------------------|-----------|
| Shared base chain + per-project privacy | Privacy groups, Pente domain | [docs/01](01-what-paladin-offers-today.md) |
| Cryptographic isolation between projects | Node-membership-based state distribution | [docs/02](02-privacy-model-history.md) |
| Cross-project atomic interop | Base-chain atomic transaction bundling | [diagram 08](../diagrams/08-cross-group-atomic.md) |
| Private events for reconciliation | Events included in domain receipts, distributed to members only | [docs/04 §4](04-paladin-deep-dive.md#4-are-events-private) |
| Deployment on Kubernetes | Official Paladin operator + Helm chart | Paladin operator repo |
| HSM-backed signing | Pluggable Signing Module interface | Paladin `signingmodules/` |
| HA per project (multi-node membership) | Any privacy group can have any number of member nodes | [docs/04 §1](04-paladin-deep-dive.md#1-what-a-privacy-group-actually-is) |
| Node resync after DB loss | State distribution replays on request | Paladin state manager |
| Unlimited privacy groups per project | No hard cap; storage-linear scaling | [docs/04 §5](04-paladin-deep-dive.md#5-how-many-privacy-groups-can-you-create) |
| Application-defined compensating actions | Just Solidity — no Paladin feature needed | (standard EVM) |
| Multi-sig governance | Solidity contract patterns; no Paladin feature needed | (standard EVM) |
| Confidentiality from public base-chain observers | Only opaque UTXO commitments hit the base chain | [diagram 06](../diagrams/06-storage-model.md) |

### What Paladin does NOT yet offer (gap analysis)

These are the areas where the roadmap would need to fill in for the architecture to reach its cleanest form.

| Gap | Impact on our architecture | Current workaround | Roadmap? |
|-----|---------------------------|--------------------|----------|
| **Sub-node privacy** — cryptographic isolation between identities co-located on one Paladin node | Forces us to deploy at least one node per project (which is the hybrid default anyway) | Deploy per-project nodes | **Yes — confirmed by maintainers** |
| **Identity-level RPC access control** | Applications can't rely on Paladin to reject wrong-`from` RPC calls; app must validate | Application-layer gateway | Related to sub-node privacy |
| **Native point-in-time state snapshots** | No built-in "backup me a group's state as of block N" primitive | Application-level export via `pgroup_call` | Not publicly announced |
| **Per-tenant encrypted-at-rest DB keys** | Full-disk encryption is available (OS-level) but not per-tenant | Rely on OS-level LUKS / cloud provider encryption | Not publicly announced |
| **Native cross-project selective disclosure** | Sharing a specific record with another group requires custom atomic-swap pattern | Custom application patterns | Not publicly announced |
| **Native compensating-action framework** | Every project reinvents the compensating pattern | Standard organisational contract library | Not a Paladin feature — app layer |
| **Per-node / per-tenant rate limiting** | A rogue application can overwhelm a shared Paladin node | Application-layer rate limiting | Not publicly announced |
| **Sub-tenant audit trails** | If we ever move to co-tenanted nodes, we can't attribute actions per-tenant | Not applicable while one-node-per-project | Related to sub-node privacy |
| **Standardised metrics / SLIs per group** | Basic metrics exist; per-group granular SLIs would help ops | Custom Prometheus exporters | Partially available |

### Requests we would submit to the Paladin community

Priority list, based on what would most improve our architecture:

1. **Sub-node privacy (confirmed on roadmap).** Track progress; contribute if we can.
2. **Point-in-time state export API.** A canonical way to snapshot a privacy group's plaintext state to an application-controlled backup. Would materially simplify the BCP story in Agenda 2 scenario (2).
3. **Per-tenant SLI / metrics standardisation.** Making it easier to run per-project SLOs on a shared Paladin fleet.
4. **Reference compensating-action patterns.** Community-blessed Solidity patterns for governance-guarded reversals would help every adopter.
5. **Guidance on cross-project selective disclosure.** Beyond the atomic swap example, a documented pattern for "share this one record with that other group" would be valuable.

### Risks specific to the "not yet possible" list

- **If sub-node privacy slips further out**, the platform team may need to run a growing fleet of Paladin nodes. Manageable but a cost to track.
- **If a project's BCP scenario (2) fires before we have a point-in-time snapshot API**, recovery depends entirely on the project's off-Paladin backups. Any project that doesn't own that risk explicitly should be flagged.
- **If we ever attempt co-tenancy on a single node without sub-node privacy**, we are relying on our own API gateway for security. This is exactly the risk called out in [docs/03 Topology C](03-multi-tenant-vision.md#topology-c--one-paladin-node-per-organisation--api-gateway).

### Decision expected from this agenda

- Confirm the today/gap classification (add anything we've missed).
- Prioritise the roadmap requests we want to raise with the Paladin community.
- Identify who from our side will engage with the Paladin project (via issues, Discord, or contribution).
- Agree tolerance: which gaps are we willing to live with, and which are showstoppers for early projects?

---

## Meeting decision log template

Please capture decisions here during the meeting so we have a single artefact to distribute.

### Agenda 1 decisions

- [ ] Decision framework and axes agreed / amended? → …
- [ ] Repeatable decision tree adopted (yes / with changes)? → …
- [ ] Intake questionnaire owner and location? → …
- [ ] Nominated decision owner (platform architect)? → …

### Agenda 2 decisions

- [ ] BCP is application co-owned (agreed)? → …
- [ ] Five application patterns adopted as baseline? → …
- [ ] Project intake requires a BCP runbook? → …

### Agenda 3 decisions

- [ ] Four-layer model and owners agreed? → …
- [ ] Hybrid topology (shared Besu, per-project Paladin) as reference? → …
- [ ] HA minimum of 3 member nodes across ≥2 failure domains? → …
- [ ] Governance contract mandatory guardrail? → …

### Agenda 4 decisions

- [ ] Today/gap classification agreed? → …
- [ ] Top three roadmap items to raise with Paladin community? → …
- [ ] Community engagement owner? → …
- [ ] Any gap that is a showstopper for the first project? → …

### Open questions / follow-ups

1. …
2. …
3. …

---

## Related pages

- [Page 1 — What Paladin offers today](01-what-paladin-offers-today.md)
- [Page 2 — Privacy model history](02-privacy-model-history.md)
- [Page 3 — Multi-tenant vision and deployment topologies](03-multi-tenant-vision.md)
- [Page 4 — Deep dive on storage, ephemeral EVM, events, scaling](04-paladin-deep-dive.md)
- [Diagrams pack](../diagrams/)
- [Runnable demo](../demo/)
