# Diagram 07 — The Ephemeral EVM

Paladin does not run a persistent private blockchain per privacy group. Instead, every private transaction spins up a **fresh, in-memory Besu EVM instance** just for that transaction.

## ASCII

```
   ┌──────────────────────────────────────────────────────────────┐
   │                    Paladin Node's JVM                         │
   │                                                               │
   │   ┌─────────────────────────────────────────────────────┐    │
   │   │   Pente Domain                                       │    │
   │   │                                                      │    │
   │   │   Incoming pgroup_sendTransaction                    │    │
   │   │              │                                       │    │
   │   │              ▼                                       │    │
   │   │   ┌──────────────────────────────────┐               │    │
   │   │   │  new EVMRunner(evmVersion,       │  ← fresh      │    │
   │   │   │       accountLoader, blockNum)   │    EVM        │    │
   │   │   │                                  │    instance   │    │
   │   │   │  • Load account state from       │               │    │
   │   │   │    Paladin UTXO store            │               │    │
   │   │   │  • Run bytecode                  │               │    │
   │   │   │  • Capture logs                  │               │    │
   │   │   │  • Emit result + state delta     │               │    │
   │   │   └──────────────────────────────────┘               │    │
   │   │              │                                       │    │
   │   │              ▼                                       │    │
   │   │   EVM instance discarded (garbage collected)         │    │
   │   │              │                                       │    │
   │   │              ▼                                       │    │
   │   │   State delta → distribution + persistence           │    │
   │   └─────────────────────────────────────────────────────┘    │
   │                                                               │
   └──────────────────────────────────────────────────────────────┘
```

## Sequence for a single private transaction

```
1. RPC arrives with { group_id, from, function, args }
2. Pente domain looks up group's genesis (members, salt, EVM config)
3. Pente constructs a fresh Hyperledger Besu EVM instance:
      var runner = new EVMRunner(evmVersion, accountLoader, blockNumber)
4. Runner loads on-demand account states from Paladin's UTXO store
5. Runner executes the transaction bytecode
6. Runner returns:
      • Modified account states (new UTXO outputs)
      • EVM logs (Solidity events)
      • Return value
7. Pente builds a JSON receipt with logs included
8. State distribution list built from members
9. State transition committed on base Besu chain (UTXO transition + endorsement)
10. Plaintext state distributed to member nodes only
11. EVM instance garbage collected. No persistent state carries over.
```

## Why this design?

- **No idle cost per group.** With unlimited privacy groups, you don't pay for a persistent EVM per group. Only groups with active transactions consume compute.
- **Isolation.** Each transaction runs in a clean EVM. State bleed between transactions is impossible by construction.
- **Simplicity.** The EVM instance is stateless between transactions; all state lives in the UTXO store. Recovery = replay from the UTXO store.

## Latency implications

- **First transaction in a fresh group (cold):** ~5-20 seconds. EVM boot + bytecode load + endorser resolution + first base-chain settlement.
- **Subsequent transactions (warm JVM):** ~200-800ms end-to-end for a small tx.
- **Read-only calls (pgroup_call):** ~10-50ms. Local read, no endorsement, no settlement round-trip.

## Storage implications

Because the EVM is ephemeral, storage is just the UTXO records:
- Genesis state (~1-3 KB per group)
- One state row per state transition (~500 bytes to few KB, depending on the contract's storage delta)
- Domain receipts including events (~500 bytes to few KB)

An empty group is under 5 KB. A group with 1000 small transactions is a few MB.

## Reference code

- [`domains/pente/src/main/java/io/kaleido/paladin/pente/evmrunner/EVMRunner.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/evmrunner/EVMRunner.java)
- [`domains/pente/src/main/java/io/kaleido/paladin/pente/domain/PenteEVMTransaction.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/domain/PenteEVMTransaction.java)
- [`domains/pente/src/main/java/io/kaleido/paladin/pente/evmstate/PersistedAccount.java`](https://github.com/LFDT-Paladin/paladin/blob/main/domains/pente/src/main/java/io/kaleido/paladin/pente/evmstate/PersistedAccount.java)
