# Diagram 04 — Three Deployment Topologies for Multi-Tenant Paladin

The "one blockchain, many isolated sub-blockchains" vision expressed three ways.

## Topology A — One Paladin node per project

Cryptographic isolation between projects, enforced by Paladin's transport layer.

```
                Shared Hyperledger Besu (base chain, one company operates it)
                              │
   ┌────────────┬─────────────┼─────────────┬────────────┐
   ▼            ▼             ▼             ▼            ▼

Project 1     Project 2     Project 3     Project 4   ...Project N
node-P1       node-P2       node-P3       node-P4        node-PN

Each Paladin node is a member ONLY of privacy groups belonging to its project.
Project 1's node never receives Project 2's data — not even the plaintext hashes.

Trade-offs:
  ✓ Cryptographic isolation between projects
  ✓ Ops-friendly (each node has its own DB, backup, upgrade cadence)
  ~ N Paladin processes to run (each is ~1-2 GB RAM, cheap in K8s)
```

## Topology B — One Paladin node per entity

For projects that involve external counterparties, push the granularity further: each participating entity gets its own Paladin node.

```
                Shared Hyperledger Besu (base chain)
                              │
     ┌──────────────┬─────────┼──────────┬──────────────┐
     ▼              ▼         ▼          ▼              ▼

  Entity A       Entity B  Entity C   Entity D      Entity E
  node-A         node-B    node-C     node-D        node-E

A given privacy group might include only { Entity A, Entity C }.
Entity B and Entity D never see that group's state — cryptographic isolation.

Trade-offs:
  ✓ Isolation at the entity level (external-party-safe)
  ✓ Same-node visibility problem disappears (each entity has one node)
  ~ More nodes to run, but linear in participants
```

## Topology C — One Paladin node per organisation + API gateway

Cheapest to run, but privacy is enforced by your gateway code, not by Paladin.

```
                Shared Hyperledger Besu (base chain)
                              │
                              ▼
                   ONE Paladin node
                   hosting all identities from all projects
                              │
                              ▼
                     API Gateway
                     (enforces "identity X may only touch group Y")
                              │
                              ▼
                        Applications

Trade-offs:
  ✓ Very cheap (one Paladin process)
  ✓ Simple ops
  ✗ NOT cryptographic — enforcement is in your gateway code
  ✗ Bypassable if anyone gets direct RPC or DB access
  ✗ NEVER appropriate for external counterparties
```

## Decision guide

```
Do external counterparties participate?
│
├─ Yes → Topology B (per entity)
│
└─ No  → Do the internal identities trust each other?
         │
         ├─ Yes → Topology C is acceptable (with gateway hygiene)
         │
         └─ No  → Topology A (per project)
```

## What changes when Paladin ships sub-node privacy

The roadmap item that would collapse this: **sub-node privacy** (identity-level cryptographic isolation inside a single node).

If it ships:
- Topology C would provide the same guarantees as Topology A does today.
- Existing Topology A / B deployments could optionally consolidate nodes.
- App APIs would not need to change.

Until then, pick topology based on the trust boundary.

## Cost comparison (order of magnitude, illustrative)

Assume 10 projects, mix of internal (6) and external (4 with 5 external entities each):

| Topology | Node count | Ops burden |
|----------|-----------|------------|
| All-A | 10 | Medium |
| All-B (per entity) | 30 (10 internal + 20 external) | Medium-High |
| All-C (per org) | 1 | Low, but crypto-weak |
| Hybrid (A for external, C for internal) | ~24 | Medium |

Actual infra cost of one Paladin node is small — typically 2 vCPU + 2 GB RAM + 20 GB disk. Even the biggest topology is cheap in Kubernetes.
