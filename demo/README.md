# Demo — Live Truth Table

Self-contained TypeScript demo that proves the privacy model documented in this repo on a real Paladin v1.0.0 cluster.

## What it does

- Creates **two projects** sharing one Paladin/Besu network
- Each project gets **two privacy groups** (four groups total)
- 3 Paladin nodes host 6 identities with intentional cross-project co-tenancy
- Writes a distinct secret into each privacy group's private `Storage` contract
- Attempts to read every secret from every identity
- Prints a coloured truth table showing MEMBER / SAME-NODE / NON-MEMBER-NODE outcomes

Runs in ~90 seconds against a warm cluster (first-time cluster ~3 min while Pente EVM warms up).

## Prerequisites

Paladin v1.0.0 up in a local Kind cluster, reachable at ports 31548 / 31648 / 31748. See the [top-level README](../README.md) for the one-shot Helm install.

Quick check:

```bash
kubectl -n paladin get pods
# all 3 paladin-node* pods should be 2/2 Running
```

## Run it

```bash
cd demo
npm install
npm run start
```

## Expected output (real, from a live cluster)

```
=== Paladin Privacy Research — Live Demo ===

Identity map:
  node1: a_user1, a_user2                        (both Project A)
  node2: a_agent, b_issuer                       (cross-project co-tenants)
  node3: a_user3, b_investor                     (cross-project co-tenants)

Creating privacy groups...
  [OK] ProjectA-Group1  members: { a_user1@node1, a_agent@node2 }
  [OK] ProjectA-Group2  members: { a_user3@node3, a_agent@node2 }
  [OK] ProjectB-Group1  members: { b_issuer@node2, b_investor@node3 }
  [OK] ProjectB-Group2  members: { b_issuer@node2, b_investor@node3 }

Deploying a Storage contract into each privacy group...
  [OK] Contracts deployed.

Writing distinct secrets into each contract...
  [OK] ProjectA-Group1 = 1111
  [OK] ProjectA-Group2 = 2222
  [OK] ProjectB-Group1 = 3333
  [OK] ProjectB-Group2 = 4444

=== Truth Table ===

Identity              | ProjectA-Group1     | ProjectA-Group2     | ProjectB-Group1     | ProjectB-Group2
----------------------+---------------------+---------------------+---------------------+---------------------
a_user1@node1         | [M] OK (1111)       | [N] BLOCKED         | [N] BLOCKED         | [N] BLOCKED
a_user2@node1         | [S] OK (1111)       | [N] BLOCKED         | [N] BLOCKED         | [N] BLOCKED
a_agent@node2         | [M] OK (1111)       | [M] OK (2222)       | [S] OK (3333)       | [S] OK (4444)
b_issuer@node2        | [S] OK (1111)       | [S] OK (2222)       | [M] OK (3333)       | [M] OK (4444)
a_user3@node3         | [N] BLOCKED         | [M] OK (2222)       | [S] OK (3333)       | [S] OK (4444)
b_investor@node3      | [N] BLOCKED         | [S] OK (2222)       | [M] OK (3333)       | [M] OK (4444)

=== Summary ===
  MEMBER reads succeeded:              8 / 8
  SAME-NODE non-member reads succeeded: 8 / 8   (node-level privacy — v1.0.0 allows this)
  NON-MEMBER-NODE reads blocked:        8 / 8   (cryptographic isolation)
```

## Reading the truth table

- **`[M] OK (nnnn)`** — the identity is a member of this group and reads its secret.
- **`[S] OK (nnnn)`** — the identity is NOT a member, but shares a Paladin node with a member. It reads the secret anyway. This is the "node-level privacy" behaviour: Paladin's isolation boundary is the node, not the identity.
- **`[N] BLOCKED`** — the identity is on a node that has no members of the group. Paladin's transport layer never delivered the state to that node; the read fails with `PD012502: Privacy group not found`. This is the cryptographic guarantee that node-level privacy provides.

## What this proves

- Cross-node cryptographic isolation is real. 8/8 non-member-node reads blocked.
- Same-node identities share visibility. 8/8 same-node non-member reads returned the exact secret.
- Cross-project visibility occurs whenever identities from different projects share a Paladin node. In this demo, 7 of the 8 same-node reads are cross-project — proving that "one blockchain, many projects" needs one-node-per-project (or per-tenant) to give cryptographic isolation between projects.

For the full analysis and architecture options, see the [docs](../docs/) folder.
