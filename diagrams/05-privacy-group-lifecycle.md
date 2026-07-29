# Diagram 05 — Privacy Group Lifecycle

End-to-end sequence for a single private transaction.

## Mermaid sequence

```mermaid
sequenceDiagram
    autonumber
    participant App as Application
    participant N1 as Paladin Node 1<br/>(identity_A@node1)
    participant N2 as Paladin Node 2<br/>(identity_C@node2)
    participant N3 as Paladin Node 3<br/>(non-member)
    participant Besu as Base Besu chain

    Note over App,Besu: Group ALPHA = { identity_A@node1, identity_C@node2 }

    App->>N1: pgroup_sendTransaction<br/>{group: ALPHA, from: identity_A@node1, fn: store(42)}
    N1->>N1: Look up group ALPHA members
    N1->>N1: prepareTransaction()
    N1->>N1: Pente EVM (fresh, in-memory):<br/>load state, execute store(42), collect logs
    N1->>N2: Endorsement request (reliable messaging)
    N2->>N2: Independently execute in fresh EVM<br/>Verify identical result
    N2-->>N1: Endorsement signature
    N1->>N1: Build state distribution list:<br/>{local: node1, remote: [node2]}
    N1->>Besu: Submit UTXO transition + endorsement proof
    Besu-->>N1: Included in block
    N1->>N2: State distribution (plaintext of new state)<br/>via reliable transport
    N1->>N1: Persist new state locally
    N2->>N2: Persist new state locally
    Note over N3: Node 3 receives NOTHING.<br/>Sees only opaque UTXO commit on Besu.

    App->>N1: pgroup_call<br/>{group: ALPHA, from: identity_A@node1, fn: retrieve()}
    N1->>N1: Load state from local DB
    N1->>N1: Execute in ephemeral EVM (read-only)
    N1-->>App: 42
```

## Reading the diagram

- Steps 3–5 are the ephemeral EVM: fresh Besu EVM instance in memory, discarded after use.
- Steps 6–7 give multi-party endorsement. Each endorser independently executes and confirms the same result before signing.
- Step 8 is the state distribution list. Only member nodes appear.
- Step 9 is what hits the base chain: a UTXO transition plus an endorsement proof. **No plaintext data.**
- The `Note over N3` line is the privacy guarantee — non-member nodes get nothing.
- Steps 13–17 are the read path. Entirely local. No base-chain round-trip. Fast.

## What if the caller is a same-node non-member?

If in step 1 the application had called with `from: identity_B@node1` (identity_B is NOT in ALPHA's members but is on node 1):

- Under Paladin v1.0.0 (the current state): the call proceeds the same way. Node 1 has ALPHA's state locally, so the read/write goes through.
- Under the brief PR #872 window (Oct 28 – Nov 20 2025): the call was rejected at step 3 with `PD012524: From identity 'identity_B@node1' is not a member of privacy group 'ALPHA'`.

See [Page 2 — history](../docs/02-privacy-model-history.md).

## What if the caller's node is not a member at all?

If a client tries to `pgroup_call` on node 3 (which is not in ALPHA):

- Node 3 never received ALPHA's state distribution — its DB has no rows for ALPHA.
- The call fails with `PD012502: Privacy group '0x...' not found`.
- This is cryptographic isolation: node 3 cannot possibly answer, because it doesn't have the data.
