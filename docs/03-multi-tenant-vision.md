# Page 3 — The Multi-Tenant Vision

## The idea

A single company (or bank, or organisation) has many independent projects:

```
                     One Company
                          │
   ┌──────────┬───────────┼───────────┬──────────┐
   ▼          ▼           ▼           ▼          ▼
Project 1  Project 2  Project 3  Project 4 ... Project N
```

Each project needs its own private ledger. Each project has multiple smart contracts. Each contract may serve multiple deals or business flows. The company wants:

- **One shared blockchain infrastructure** (one Hyperledger Besu network) — cheaper to run, one ops team, one upgrade cadence.
- **Sub-blockchains under it**, one per project, cryptographically isolated from every other project.
- **Fine-grained privacy within a project**, so different deals or counterparties inside the same project cannot see each other's data.
- **Optional cross-project interoperability** when a deal really needs to span two projects, atomically settled.

## Can Paladin v1.0.0 do this today?

Partially. The answer depends on how you deploy Paladin nodes.

### What Paladin definitely gives you today

- **One shared Besu chain, many privacy groups.** Unlimited privacy groups per node. Cross-project isolation works well if you set up nodes correctly.
- **Events are private** (they live in domain receipts, distributed only to member nodes).
- **Atomic cross-group settlement** via the base Besu chain.
- **No vendor lock-in.** Apache-2.0. You operate the whole stack.

### What Paladin does NOT give you today

- **Cryptographic isolation between identities on the same node.** If two projects share a Paladin node, identities in one project can read the other's private state via the RPC.
- **True multi-tenant Paladin nodes.** There's no "namespace" concept inside a node that would cordon off one tenant's state from another's.

Both of these are on the Paladin roadmap ([Page 2](02-privacy-model-history.md)).

## Three deployment topologies you can pick from today

### Topology A — One Paladin node per project

```
                Shared Hyperledger Besu (base chain)
                              │
   ┌────────────┬─────────────┼─────────────┬────────────┐
   ▼            ▼             ▼             ▼            ▼

Project 1     Project 2     Project 3     Project 4   ...Project N
node-P1       node-P2       node-P3       node-P4        node-PN

Each Paladin node is a member ONLY of privacy groups belonging to its project.
```

**Isolation:** cryptographic. Enforced by Paladin's transport layer. A Project 1 node never receives Project 2's data. Not even the operator of Project 2 can see Project 1 without physically accessing Project 1's node.

**Cost:** one Paladin process (~1-2 GB RAM, one Postgres) per project. Very manageable in K8s.

**Fit:** great for organisations that need clean cryptographic separation, or where different projects are owned by different business units with different regulators.

### Topology B — One Paladin node per counterparty / entity

Push further: give each participating entity (each business unit, each external partner, each legal entity) its own Paladin node.

```
                Shared Hyperledger Besu (base chain)
                              │
     ┌──────────────┬─────────┼──────────┬──────────────┐
     ▼              ▼         ▼          ▼              ▼

  Entity A       Entity B  Entity C   Entity D      Entity E
  node-A         node-B    node-C     node-D        node-E

Privacy groups are formed only between the specific entities in a given deal.
Entities not in a deal have their node excluded from that group.
```

**Isolation:** cryptographic at the entity level. Two entities on different nodes cannot see each other's shared or unshared state.

**Cost:** more nodes to run. Still small in absolute terms — 50 nodes is trivially cheap in K8s.

**Fit:** required for external counterparties, deal-level isolation, regulator-visible segregation.

### Topology C — One Paladin node per company + application-layer gateway

The cheapest option, but it moves the security burden to your own code.

```
                Shared Hyperledger Besu (base chain)
                              │
                              ▼
                   ONE Paladin node
                   hosting many identities
                              │
                              ▼
              Company's own API Gateway
              (enforces "identity X can only touch group Y")
                              │
                              ▼
                         Applications
```

**Isolation:** organisational. Paladin does not enforce it. The gateway does. If the gateway has a bug, or if someone bypasses it (direct DB access, direct RPC access via kubectl port-forward), the isolation is gone.

**Cost:** minimal — one node.

**Fit:** internal-only environments where all identities already trust each other, and the gateway is just for auditing / RBAC hygiene. Never appropriate for cross-tenant or external-counterparty flows.

## What HAS to change in Paladin for a true "10 projects on 1 blockchain, all isolated inside one node" experience

This is the roadmap. The maintainers have named it "sub-node privacy" or "true multi-tenancy". Concretely, at least these building blocks would need to exist inside Paladin:

### 1. Identity-scoped state store

Today, state records in a Paladin node's UTXO store are tagged by domain + contract + group. To achieve sub-node privacy, they'd need an additional tenant/identity dimension — and every read from disk would need to be filtered by "which tenant is asking".

```
Today:            State { domain, contract, group, data }
Sub-node-privacy: State { domain, contract, group, tenant, data }
                                                     ↑ new
```

### 2. Identity-aware RPC boundary

Every RPC call would need to authenticate not just "which node" but "which tenant on this node". Today, that's implicit — any local caller can use any local identity. Sub-node privacy requires proving the caller is authorised for the identity they claim.

Possible mechanisms:
- Per-tenant API keys (managed by the node operator).
- Per-tenant TLS client certificates.
- OIDC / JWT with a tenant claim.
- HSM-backed signing keys where the key material never leaves the tenant's control.

### 3. Identity-scoped transport

State distribution today decides "which nodes receive this transition". It would need to be extended to "which tenants on which nodes". A member node might receive state but only replicate it into the tenant's isolated store.

### 4. Endorsement policy that references identities, not just nodes

Currently a privacy group's endorsement policy is expressed at the node level. For meaningful sub-node privacy the policy would need to reference specific tenant identities — so a compromised node operator cannot forge endorsements on behalf of any tenant they host.

### 5. Auditable per-tenant access logs

Every access to every state record would need to be attributable to a specific tenant, with a tamper-evident audit trail. This is a general enterprise requirement but becomes critical when many tenants share one process.

### 6. Compatibility with token domains

Andrew Richardson explicitly flagged that sub-node privacy has to work for **all** Paladin state, not just Pente privacy groups. Tokens (Noto, Zeto) and any future domain also need the tenant dimension. This is why it's a bigger scope item than "just add a check to `pgroup_call`".

Andrew's own words (2025-11-20):

> There is still work to think about tagging all the data in the Paladin runtime and providing fine-grained access to ask the API questions in the context of a particular identity. That won't be only an EVM privacy group feature either — it needs to work for tokens too, and other constructs that aren't locked inside of a privacy group.

## If Paladin adds sub-node privacy tomorrow, does the "one blockchain, 10 sub-blockchains" vision work?

Yes — that's exactly what it unlocks.

Under sub-node privacy, Topology C (one node per company) would provide the same isolation guarantees that Topology A (one node per project) provides today. You'd be able to run 10 projects on a single Paladin node, with each project's data invisible to the other 9 projects' identities, all backed by cryptographic enforcement rather than gateway-hoping.

Until then, get the same guarantees by deploying nodes at the granularity that matches your isolation boundary.

## Recommended decision framework

Ask yourself, for each project:

**Q1: Do the identities in this project trust each other?**
- If yes → Topology C is fine for this project.
- If no → do not use Topology C.

**Q2: Do any external parties participate in this project's privacy groups?**
- If yes → Topology B (per entity). Non-negotiable — external parties cannot trust your gateway.
- If no → Topology A or C, based on Q1.

**Q3: Is there regulatory segregation between projects?**
- If yes → separate nodes per project (at minimum Topology A).
- If no → any topology can technically work.

**Q4: Do you need atomic settlement across projects?**
- Paladin supports this regardless of topology. No topology change needed for interop.

## Example: applying this to 10 projects

An organisation with 10 projects. Suppose:
- 6 projects have only internal identities (Projects 1–6).
- 4 projects have external counterparties (Projects 7–10).

Recommended split:
- Projects 1–6 → **Topology C** (one node, gateway-enforced) — one shared node, or one node per project if you want extra hygiene.
- Projects 7–10 → **Topology B** (one node per external entity). Each external entity gets its own Paladin node.

Total node count: ~10 for internal projects + N for external entities (where N depends on how many external entities you have across the four external-facing projects).

Cross-project atomicity remains available via Paladin's base-chain atomic bundling.

---

## Summary

- The "one blockchain, many isolated sub-blockchains" vision is fully compatible with Paladin **if you deploy at the right node granularity today**.
- The **one-node-per-tenant** future (where all projects live on one Paladin node with cryptographic isolation between them) requires the sub-node-privacy roadmap item to ship.
- Nothing prevents starting now with Topology A or B and consolidating to one node later, once sub-node privacy exists.

## Related pages

- [Page 1 — What Paladin offers today](01-what-paladin-offers-today.md)
- [Page 4 — Paladin deep dive: storage, ephemeral EVMs, events, scaling](04-paladin-deep-dive.md)
