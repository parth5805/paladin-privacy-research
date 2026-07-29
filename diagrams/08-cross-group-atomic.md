# Diagram 08 — Atomic Cross-Group Transaction

Two privacy groups cannot directly read or write each other's state (that would defeat isolation). But they CAN atomically settle a coordinated transaction via the base chain — either both state transitions apply or both revert.

## Mermaid sequence

```mermaid
sequenceDiagram
    autonumber
    participant App as Application
    participant G1 as Group 1 nodes<br/>(private state 1)
    participant G2 as Group 2 nodes<br/>(private state 2)
    participant Besu as Base Besu chain

    App->>G1: Prepare state transition A<br/>(e.g. transfer asset out)
    G1->>G1: Simulate in ephemeral EVM<br/>Produce prepared transition
    G1-->>App: prepared-tx-1<br/>(state delta + endorsements)

    App->>G2: Prepare state transition B<br/>(e.g. receive asset in)
    G2->>G2: Simulate in ephemeral EVM<br/>Produce prepared transition
    G2-->>App: prepared-tx-2<br/>(state delta + endorsements)

    App->>Besu: Bundle prepared-tx-1 + prepared-tx-2<br/>into ONE atomic transaction
    Besu->>Besu: Execute bundled transaction<br/>Either BOTH apply or NONE
    Besu-->>App: Bundled tx included

    G1->>G1: Materialise new private state (Group 1 nodes only)
    G2->>G2: Materialise new private state (Group 2 nodes only)
    Note over G1,G2: Neither group sees the other's plaintext.<br/>Both see the same atomic commit hash.
```

## What this enables

- Cross-project composite transactions.
- Atomic asset swaps across privacy boundaries.
- Multi-party settlement flows where each party sees only their side of the transaction.

## Reference implementations

- [`examples/swap/`](https://github.com/LFDT-Paladin/paladin/tree/main/examples/swap) — atomic swap of a Zeto (ZK) asset for a Noto (notary) asset, coordinated across two privacy groups.
- [`examples/notarized-tokens/`](https://github.com/LFDT-Paladin/paladin/tree/main/examples/notarized-tokens) — token flows spanning multiple contexts.

## What is NOT possible

Directly reading or writing across group boundaries is not supported. If Group 1 needs a value from Group 2, it must be moved via an atomic-swap-style flow (or exposed via a shared meta-group that both are members of).

## Isolation properties preserved

- Each group's plaintext never leaves its member nodes.
- The base chain sees only opaque commitments for both transitions.
- Non-participating groups (or nodes) see nothing beyond the bundled base-chain transaction hash.
