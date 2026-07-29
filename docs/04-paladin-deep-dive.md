# Page 4 — Paladin Deep Dive

Storage, ephemeral EVMs, events, and what happens at scale. Every claim in this page points to a specific file in the upstream Paladin repository.

---

## Contents

1. [What a privacy group actually is](#1-what-a-privacy-group-actually-is)
2. [Ephemeral EVMs — the private compute layer](#2-ephemeral-evms--the-private-compute-layer)
3. [Where the plaintext lives (storage model)](#3-where-the-plaintext-lives-storage-model)
4. [Are events private?](#4-are-events-private)
5. [How many privacy groups can you create?](#5-how-many-privacy-groups-can-you-create)
6. [Storage cost per privacy group](#6-storage-cost-per-privacy-group)
7. [What happens at scale (10s, 100s, 1000s of groups)](#7-what-happens-at-scale)
8. [Cross-group interoperability](#8-cross-group-interoperability)

---

## 1. What a privacy group actually is

A privacy group is created via the `pgroup_createGroup` RPC. On creation:

1. A random 32-byte **group ID** is generated.
2. A **members list** is persisted: fully-qualified identity locators of the form `identifier@nodeName`.
3. A **genesis state** is agreed via endorsement — a base-chain UTXO state representing "this group exists".
4. A **contract address** is assigned on the base Besu chain. This is where the Pente factory contract publishes group-related state commitments (opaque UTXO transitions, not plaintext).

Once created, the group lives simultaneously in:

- Each member node's local Postgres (the `privacy_groups` and `privacy_group_members` tables).
- The base Besu chain as a set of UTXO commitments.

No separate "private chain" is spun up. No persistent private EVM runs anywhere. The compute is on-demand and ephemeral (see next section).

**Code:** [`core/go/internal/groupmgr/manager.go`](https://github.com/LFDT-Paladin/paladin/blob/main/core/go/internal/groupmgr/manager.go) — `createGroup`, `resolvePrivateContract`, `SendTransaction`, `Call`.

---

## 2. Ephemeral EVMs — the private compute layer

For every private transaction, each endorsing member node:

1. Constructs a **fresh Besu EVM instance in memory** (using the standard Hyperledger Besu EVM library, `org.hyperledger.besu.evm.EVM`).
2. Loads the accounts touched by the transaction from the Paladin state store via an `AccountLoader`.
3. Executes the transaction bytecode.
4. Captures output state (modified accounts, storage slots), EVM logs (events), and the return value.
5. Throws the EVM instance away (garbage collected).

This is what "ephemeral EVM" means in Paladin's marketing. It's real — there is no persistent per-group EVM process. Every transaction gets a fresh, disposable instance.

**Code:**
- [`domains/pente/src/main/java/io/kaleido/paladin/pente/evmrunner/EVMRunner.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/evmrunner/EVMRunner.java) — constructs the fresh EVM.
- [`domains/pente/src/main/java/io/kaleido/paladin/pente/domain/PenteEVMTransaction.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/domain/PenteEVMTransaction.java) — orchestrates execution, receipt building.
- [`domains/pente/src/main/java/io/kaleido/paladin/pente/evmstate/PersistedAccount.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/evmstate/PersistedAccount.java) — serialises account state as JSON for persistence.

### Consequences of the ephemeral model

- **Cold-start cost:** the first transaction in a fresh group has to build the EVM, load bytecode, resolve endorsers. Subsequent transactions are much faster (JIT-warmed JVM, cached endorser lookups). In practice: expect ~5–20s cold, ~200–500ms warm per private tx on a modest node.
- **Memory profile:** each in-flight transaction holds a full EVM instance briefly. Not a concern in normal load — the JVM GCs them. Could become one under extreme concurrent-transaction bursts.
- **No shared warm cache across groups:** if 100 groups each do a transaction per hour, that's 100 cold starts per hour. Fine for most workloads.

---

## 3. Where the plaintext lives (storage model)

The single most important distinction for compliance and audit conversations:

| Data | Location | Who can read it |
|------|----------|-----------------|
| Privacy group definition (members, ID) | Paladin's Postgres on each member node (`privacy_groups`, `privacy_group_members` tables) | Member nodes only |
| Private EVM state (accounts, storage, code) | Paladin's UTXO state store on each member node (`states` table) | Member nodes only |
| Private EVM events / logs | Included in the domain receipt, distributed with state | Member nodes only |
| Endorsement signatures | Base Besu chain, on the Pente factory contract | Everyone (opaque) |
| UTXO state commitments (spend/create) | Base Besu chain | Everyone (opaque hashes) |
| Base-chain settlement transaction | Base Besu chain | Everyone |

### ASCII picture

```
                  BASE BESU CHAIN (public within the network)
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                 │
   │   Block N:                                                       │
   │     [Pente factory] transitionState(...)                         │
   │       spend [inputHash1], create [outputHash2]                   │
   │       endorsement proof (multi-sig)                              │
   │                                                                 │
   │   NO PLAINTEXT contract args, return values, events, or state.  │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │
                       (opaque commitments only)
                                     │
   ┌─────────────────────────────────┴──────────────────────────────┐
   │      Paladin Node A DB           Paladin Node B DB             │
   │      (member of group G)        (member of group G)            │
   │                                                                │
   │    states table:                states table:                  │
   │    ┌────────────────────┐       ┌────────────────────┐         │
   │    │ id: outputHash2    │       │ id: outputHash2    │         │
   │    │ group: 0xabc       │       │ group: 0xabc       │         │
   │    │ data: {            │       │ data: {            │         │
   │    │   accounts: {...}, │       │   accounts: {...}, │         │
   │    │   logs:    [...],  │       │   logs:    [...],  │         │
   │    │   ...              │       │   ...              │         │
   │    │ }                  │       │ }                  │         │
   │    └────────────────────┘       └────────────────────┘         │
   │                                                                │
   │  PLAINTEXT lives here, only on the group's member nodes.       │
   │  Anyone with DB / RPC access on a member node can read it.     │
   └────────────────────────────────────────────────────────────────┘
```

**Code path for state distribution:** [`core/go/internal/privatetxnmgr/state_distribution_builder.go`](https://github.com/LFDT-Paladin/paladin/blob/main/core/go/internal/privatetxnmgr/state_distribution_builder.go). The builder iterates the group's membership list and routes state to member nodes only. Non-member nodes never receive the plaintext.

### Regulator / auditor talking points

- The base chain sees **no meaningful data** — only opaque commitments.
- Plaintext exists only on member-node databases. Encryption at rest, DB backup handling, and DBA access control are where compliance controls apply.
- Loss of a member node's DB while the group has state = **data loss**, not a privacy breach (unless the media is exfiltrated).
- Geographic / jurisdictional data placement is enforced by node membership choices. A group's data does not travel to nodes outside the members list.

---

## 4. Are events private?

**Yes.** Events emitted by a private smart contract (Solidity `emit`) are:

1. Captured in the ephemeral EVM's log accumulator during execution.
2. Folded into a Pente domain receipt.
3. Distributed only to member nodes via the state-distribution transport.

They are **not** broadcast to the base Besu chain, and non-member nodes never receive the receipt.

**Code:** in [`PenteEVMTransaction.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/domain/PenteEVMTransaction.java), the `buildJSONReceipt` method:

```java
JSONReceipt buildJSONReceipt(EVMExecutionResult execResult) {
    var evmReceipt = new EVMReceipt(
        new Address(execResult.senderAddress.toArray()),
        this.to,
        new JsonHexNum.Uint256(execResult.gasUsed),
        contractAddress,
        execResult.logs   // ← EVM events stay inside the receipt
    );
    return new JSONReceipt(this, evmReceipt);
}
```

To retrieve events, applications call `ptx_getDomainReceipt` on a member node. Non-member nodes will return "not found".

### Practical example

A private contract that emits `event Transfer(address from, address to, uint256 amount)`:
- Members of the group see the `Transfer` events in the domain receipt for the transaction that emitted them.
- Non-members never see the events. There is no public event log they could scan.

This is one of the strongest properties of Paladin for confidential business flows.

---

## 5. How many privacy groups can you create?

**Effectively unlimited.** There is no hard cap in the codebase — groups are rows in a Postgres table and states in the state store. The practical limits are:

| Constraint | Limit |
|-----------|-------|
| Group ID space | 2²⁵⁶ (random 32-byte IDs) |
| Groups per Paladin node | Limited only by DB storage and query performance |
| Members per group | Limited by endorsement latency (each new member is one more endorser to gather signatures from) |
| Concurrent open groups | No fundamental limit; Paladin doesn't hold a persistent EVM per group |

Real-world Paladin deployments have run into the thousands of privacy groups per node without architectural changes. Beyond that, the questions become the usual Postgres ones (index maintenance, backup size, query plan quality).

---

## 6. Storage cost per privacy group

Rough order-of-magnitude, from the schema and code:

| Item | Size |
|------|------|
| Group definition row (`privacy_groups`) | ~200–500 bytes |
| Member row per member (`privacy_group_members`) | ~100–200 bytes per member |
| Genesis state (one row in `states`) | ~1–3 KB depending on member count |
| Per-transaction state row | ~500 bytes to a few KB depending on the smart contract's storage delta |
| Per-transaction domain receipt (with events) | ~500 bytes to several KB |

An empty group is under 5 KB. A group with 100 transactions each modifying a few storage slots and emitting one event might be a few MB total.

**Storage at scale:** 10,000 privacy groups with ~1000 transactions each = tens of GB per member node. Fits comfortably on any modern Postgres deployment.

---

## 7. What happens at scale

### Latency

- Cold group first transaction: **5–20s** (EVM boot + endorser resolution + first base-chain settlement).
- Warm group transaction: **200–800ms** end-to-end for a small tx (execute + endorse + settle on base chain).
- Read-only `pgroup_call`: **10–50ms** (local read, no endorsement, no settlement).

### Throughput bottlenecks

The typical bottlenecks appear in this order as you scale:

1. **Base chain (Besu) TPS.** Every private tx eventually commits a UTXO transition on Besu. Besu's TPS ceiling caps your privacy-tx throughput. A single QBFT Besu network usually delivers 50–200 TPS. You can shard by running multiple Besu networks if that becomes limiting.
2. **Endorsement latency.** Multi-member groups need all endorsers to independently execute + sign. Latency grows with the slowest endorser.
3. **State distribution.** For groups with many members, each state transition has to be reliably delivered to every member node. Network / message-broker throughput matters.
4. **DB write throughput on member nodes.** Rarely limiting in practice.

### Failure modes

- **A member node offline** — reads continue from other member nodes. Writes fail if the offline node is required for endorsement.
- **Base chain finality delay** — private tx receipts include the base-chain block confirmation; slow Besu finality slows private tx acknowledgement.
- **Large state per transaction** — very big storage deltas or event payloads increase distribution size and DB write time. Usually still fine.

### What DOES NOT scale independently

- **Ephemeral EVM cold starts** — each private tx on a cold group has a fixed overhead. Very-high-frequency small transactions on many different groups may hit this. Mitigation: batch, keep groups warm, or bump JVM heap.

---

## 8. Cross-group interoperability

Two privacy groups **cannot directly read or write each other's state** — that would defeat isolation. But Paladin supports **atomic cross-group transactions** via the base chain.

### The pattern

1. Group A prepares its state transition (locally, privately, with its own endorsements).
2. Group B prepares its state transition.
3. Both prepared transactions are bundled into a **single base-chain transaction**.
4. The base EVM guarantees atomicity: either both transitions apply or both revert.
5. Each group materialises its own new state privately. Neither group sees the other's plaintext.

### Reference implementations

- [`examples/swap/`](https://github.com/LFDT-Paladin/paladin/tree/main/examples/swap) — atomic swap of a Zeto ZK-asset for a Noto notarised asset across two privacy groups.
- [`examples/notarized-tokens/`](https://github.com/LFDT-Paladin/paladin/tree/main/examples/notarized-tokens) — token minted in one context, atomically transferred.

### Practical use

Any composite transaction that spans multiple privacy groups or multiple domains (Pente + Noto + Zeto) can be modelled this way. Neither group learns the other's private state; both see the same atomic base-chain commit hash for their records.

---

## Summary — the mental model to keep

1. **A privacy group is an agreement between nodes** to share private state.
2. **Compute is ephemeral** — fresh EVM per transaction, no persistent private chain.
3. **Plaintext lives on member-node DBs.** Base chain sees only commitments.
4. **Events are private** to the group.
5. **Unlimited groups per node**, sub-MB storage per group typical.
6. **Cross-group atomicity works** via base-chain bundling.
7. **Node-level privacy is the enforcement boundary today.** Sub-node privacy is roadmap.

## Related pages

- [Page 1 — What Paladin offers today](01-what-paladin-offers-today.md)
- [Page 2 — Privacy model history](02-privacy-model-history.md)
- [Page 3 — Multi-tenant vision](03-multi-tenant-vision.md)
