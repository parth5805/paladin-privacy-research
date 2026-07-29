# Diagram 06 — Storage Model

Where the plaintext lives vs what's on the public chain.

## ASCII

```
                          BASE BESU CHAIN (public within the network)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │   Block 1234:                                                        │
   │     Tx: [Pente factory contract] createGroup(...)                    │
   │       → GroupExists(groupID=0xabc, hash=0xdef, members=[h1,h2])      │
   │                                                                     │
   │   Block 1235:                                                        │
   │     Tx: [Pente factory contract] transitionState(...)                │
   │       → Spend inputs [h1], create outputs [h2]                       │
   │       → Endorsement proof (multi-signature)                          │
   │                                                                     │
   │   ⚠ NO plaintext contract call args, no return values, no events.  │
   │   ⚠ Even a full base-chain observer sees only opaque hashes.       │
   │                                                                     │
   └─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
              (opaque commitments only, cryptographically bound)
                                    │
   ┌────────────────────────────────┴────────────────────────────────┐
   │        Paladin Node A DB           Paladin Node B DB             │
   │      (member of Group G)         (member of Group G)             │
   │                                                                  │
   │    states table:                 states table:                   │
   │    ┌──────────────────┐          ┌──────────────────┐            │
   │    │ id: outputHash2  │          │ id: outputHash2  │            │
   │    │ group: 0xabc     │          │ group: 0xabc     │            │
   │    │ data: {          │          │ data: {          │            │
   │    │   contractAddr,  │          │   contractAddr,  │            │
   │    │   accounts: {    │          │   accounts: {    │            │
   │    │     0x111: {     │          │     0x111: {     │            │
   │    │       balance,   │          │       balance,   │            │
   │    │       storage,   │          │       storage,   │            │
   │    │     }            │          │     }            │            │
   │    │   },             │          │   },             │            │
   │    │   logs: [...]    │          │   logs: [...]    │            │
   │    │ }                │          │ }                │            │
   │    └──────────────────┘          └──────────────────┘            │
   │                                                                  │
   │  ← PLAINTEXT lives here, only on Group G's member nodes.        │
   │  ← Anyone with DB or RPC access on these nodes can read it.     │
   │  ← Non-member nodes have no row for Group G at all.             │
   └──────────────────────────────────────────────────────────────────┘
```

## Table reference

| Data | Location | Who can read |
|------|----------|--------------|
| Privacy group definition | Paladin Postgres, `privacy_groups`, `privacy_group_members` tables | Member nodes only |
| Private EVM state (accounts, storage, code) | Paladin Postgres, `states` table | Member nodes only |
| Private EVM events / logs | Included in domain receipts, distributed with state | Member nodes only |
| Endorsement signatures | Base Besu chain, on Pente factory contract | Public within the base chain (but opaque) |
| UTXO state commitments | Base Besu chain | Public within the base chain (but opaque) |
| Base-chain settlement transaction | Base Besu chain | Public within the base chain |

## Compliance / auditor talking points

- Base chain observers see **no meaningful data** — only opaque commitments.
- Plaintext lives ONLY on member-node databases. Encryption at rest, backup handling, DBA access review, and key management should focus there.
- Loss of a member node's DB while the group has state is a **data loss** event (not automatically a privacy breach — unless the DB media is stolen).
- Geographic / jurisdictional data placement is enforced by node membership choices. A group's data does not travel to nodes outside the members list. You can, for instance, keep EU-resident data off US-region nodes by simply not making US nodes members of the relevant groups.
