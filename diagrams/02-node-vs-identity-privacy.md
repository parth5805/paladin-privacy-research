# Diagram 02 — Node-Level vs Identity-Level Privacy

The single most important picture in this repo.

## Setup

```
3 Paladin nodes. Each node hosts 2 identities.

┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│    Paladin Node 1       │  │    Paladin Node 2       │  │    Paladin Node 3       │
│                         │  │                         │  │                         │
│   identity_A            │  │   identity_C            │  │   identity_E            │
│   identity_B            │  │   identity_D            │  │   identity_F            │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘

Privacy Group ALPHA = { identity_A@node1, identity_C@node2 }
```

## Question: who can read ALPHA's private state?

```
┌──────────────────┬───────────────────────┬──────────────────────────────────────┐
│    Identity      │       Result          │        Why                            │
├──────────────────┼───────────────────────┼──────────────────────────────────────┤
│  identity_A      │  READ succeeds        │  Explicit member                     │
│  identity_B      │  READ succeeds  ⚠️    │  Node 1 has ALPHA's state on disk;   │
│                  │  (same-node non-      │  RPC accepts any local identity      │
│                  │   member)             │                                      │
│  identity_C      │  READ succeeds        │  Explicit member                     │
│  identity_D      │  READ succeeds  ⚠️    │  Node 2 has ALPHA's state on disk    │
│  identity_E      │  READ blocked         │  Node 3 has no ALPHA state at all    │
│  identity_F      │  READ blocked         │  Same reason                         │
└──────────────────┴───────────────────────┴──────────────────────────────────────┘
```

The ⚠️ rows are the surprise. They are the entire architectural difference between "node-level privacy" and "identity-level privacy".

## What actually enforces what

```
                Cryptographic isolation (STRONG, unbypassable)
             ┌───────────────────────────────────────────────┐
             │                                               │
             │       Node 1     Node 2     Node 3            │
             │     ┌────────┐ ┌────────┐ ┌────────┐          │
             │     │ ALPHA  │ │ ALPHA  │ │  (no   │          │
             │     │ state  │ │ state  │ │ state) │          │
             │     └────────┘ └────────┘ └────────┘          │
             │        │           │           │              │
             └────────┼───────────┼───────────┼──────────────┘
                      │           │           │
                      ▼           ▼           ▼
             Any local identity on this node can access.
              (This is where sub-node privacy would apply,
               but Paladin v1.0.0 does not enforce it.)
```

## Two takeaways

1. **Cross-node isolation is real** — it's enforced by Paladin's transport layer. Non-member nodes get zero plaintext.
2. **Same-node isolation is not** — inside a member node, any local identity can access. To enforce isolation between identities today, put them on different nodes.

## For the "one blockchain, many isolated sub-blockchains" question

- If your sub-blockchains must be isolated from each other, deploy their nodes separately.
- One-node-per-tenant works today and matches Paladin's cryptographic guarantees.
- One-node-per-organisation with app-layer ACLs works only if all tenants inside the org trust each other.
- One-node-per-organisation with cryptographic sub-tenant isolation requires the sub-node privacy roadmap item.
