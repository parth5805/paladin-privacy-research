# Page 1 — What Paladin v1.0.0 Offers Today

**Version tested:** `docker.io/lfdecentralizedtrust/paladin:v1.0.0` (released 2026-06-25)
**Helm chart:** `paladin/paladin-operator` v1.0.0

This page describes the privacy model as it actually behaves today. Every claim was verified against a live 3-node Paladin cluster; the truth table at the bottom is real, not sketched.

---

## The elevator description

Paladin is a privacy layer that sits on top of any EVM chain (typically Hyperledger Besu). It gives you:

1. **Privacy groups** — sets of Paladin nodes that agree to share confidential EVM state amongst themselves and no one else.
2. **Ephemeral private EVMs** (the Pente domain) — Solidity contracts run inside a fresh in-memory EVM for every transaction; state is persisted in a UTXO store on member nodes only.
3. **Only commitments on the public chain** — the base Besu chain sees opaque UTXO commitments and endorsement proofs. It never sees plaintext state, arguments, return values, or events.
4. **Cross-domain atomicity** — private state changes in different privacy groups (or different domains: Pente EVM, Noto tokens, Zeto ZK tokens) can be bundled into a single atomic transaction on the base chain.

## The one thing you must internalize

**The privacy boundary is the Paladin node.** Not the wallet, not the EOA, not the signing identity — the node.

Every identity resolvable on a Paladin node that is a member of a privacy group can read and write that group's private state, even if that specific identity is not itself listed in the group's members.

This is confirmed by maintainer Andrew Richardson (Firefly / Paladin), 2025-11-20:

> Paladin currently provides node-level privacy. A privacy group represents an agreement between a set of Paladin nodes that they will distribute private transaction data to each other for any transactions in that privacy group, and they all choose at least one key that they control that will be used to sign off on transactions before they can be committed via a proof on the base EVM ledger.
>
> There is no requirement that the signing keys used for endorsing privacy group transactions are the only keys that can interact with the private EVM itself.

Full quote and context in [Page 2](02-privacy-model-history.md).

## The three privacy layers people confuse

| Layer | What it protects | Paladin v1.0.0 behaviour |
|-------|-----------------|--------------------------|
| **Transport privacy** | Which nodes RECEIVE the transaction payload | ✅ Only member nodes. Non-member nodes get nothing. Strong. |
| **Storage privacy** | Where the plaintext state LIVES | ⚠️ On disk in the Paladin DB of each member node. Any process with DB access on a member node can read it. |
| **RPC access control** | Which caller can INVOKE `pgroup_call` or `pgroup_sendTransaction` | ⚠️ Any identity the node can locally sign for. No members-list check. |

When Paladin docs say "private", they mean **transport-private and storage-private from non-members**. They do NOT mean "access-controlled at the identity level within a member node".

## Who can see what — actual truth table from live cluster

Setup used:

```
node1: identity_A, identity_B         (both on node1)
node2: identity_C, identity_D         (both on node2)
node3: identity_E, identity_F         (both on node3)

Privacy Group ALPHA = { identity_A@node1, identity_C@node2 }
```

Reading ALPHA from each identity:

| Caller | Category | Result |
|--------|----------|--------|
| identity_A@node1 | MEMBER | ✅ read succeeds |
| identity_B@node1 | SAME_NODE (not a member, but node1 hosts a member) | ✅ **read succeeds** — this is the surprise |
| identity_C@node2 | MEMBER | ✅ read succeeds |
| identity_D@node2 | SAME_NODE | ✅ **read succeeds** — same surprise |
| identity_E@node3 | NON_MEMBER_NODE (node3 has no members) | ❌ blocked with `PD012502: Privacy group not found` |
| identity_F@node3 | NON_MEMBER_NODE | ❌ blocked with `PD012502` |

Legend:
- **MEMBER** = explicitly listed in the group's members
- **SAME_NODE** = not a member, but shares a Paladin node with a member
- **NON_MEMBER_NODE** = on a node that hosts no members of the group

## What this implies for architecture

If you need identity X's data to be invisible to identity Y, put them on different Paladin nodes. There is no reliable way to achieve that isolation with X and Y on the same node using v1.0.0 alone.

The full multi-tenant / sub-blockchain discussion is on [Page 3](03-multi-tenant-vision.md).

## What upstream `main` does today

Grepping the freshly cloned upstream `groupmgr/manager.go`:

```bash
$ grep -n "MsgPGroupsFromNotMember\|is not a member of privacy group" \
     core/go/internal/groupmgr/manager.go
(no matches — the check does not exist)
```

The current `prepareTransaction` function has zero membership check. It resolves the group, wraps the tx, and hands off to the domain:

```go
func (gm *groupManager) prepareTransaction(ctx context.Context, dbTX persistence.DBTX,
        domain string, groupID pldtypes.HexBytes, pgTX *pldapi.PrivacyGroupEVMTX) (*pldapi.TransactionInput, error) {
    if domain == "" { return nil, i18n.NewError(ctx, msgs.MsgPGroupsNoDomain) }
    if groupID == nil { return nil, i18n.NewError(ctx, msgs.MsgPGroupsNoGroupID) }
    pg, psc, err := gm.resolvePrivateContract(ctx, dbTX, domain, groupID)
    if err != nil { return nil, err }
    // Call the domain to wrap the private tx
    return psc.WrapPrivacyGroupEVMTX(ctx, pg, pgTX)
}
```

This wasn't always the case — see [Page 2 — history](02-privacy-model-history.md) for the two-month window in late 2025 when a membership check briefly existed, and why it was removed.

## What Paladin gets right

- **Cryptographic isolation between nodes is real.** A non-member node genuinely cannot see private state — no plaintext data, no events, no receipts, no reconstructable UTXOs on the public chain. This is the strongest guarantee in enterprise-EVM privacy today.
- **Events are private.** Solidity `emit` inside a private contract stays inside the domain receipt and is only distributed to member nodes.
- **Cross-domain atomicity works.** A single base-chain transaction can atomically settle state changes in multiple privacy groups + multiple token domains. Non-participating groups see nothing.

## What Paladin does not yet offer (the roadmap items)

- **Sub-node privacy** — cryptographic isolation between identities co-located on the same node.
- **True multi-tenant nodes** — one Paladin process safely hosting multiple untrusting tenants.
- **Fine-grained identity-aware read APIs** — asking the node "what can identity X see?" and getting an identity-scoped answer.

Andrew Richardson (2025-11-20):

> Providing sub-node privacy or true multi-tenant nodes with segmented private storage is a roadmap item for Paladin. For now it's a responsibility of an API layer sitting in front of Paladin.

## Verifying this yourself

Run the [demo](../demo/) against a fresh Paladin v1.0.0 cluster. You should see the same truth-table pattern: MEMBER + SAME_NODE succeed, NON_MEMBER_NODE fails. If you see anything different, please open an issue.
