# Page 2 — How Paladin's Privacy Model Evolved (Oct 2025 → Nov 2025)

For roughly three weeks in late 2025, Paladin's main branch briefly enforced identity-level access on privacy groups. That change was then reverted on explicit design grounds. Anyone reading Paladin docs today, or running v1.0.0, sees the post-revert behaviour. This page tells the whole story.

Every date, quote, PR number and commit hash below is public and linkable.

---

## Timeline at a glance

```
 2025-09-24  Discord question raised: "does the same-node non-member
             also get access to a privacy group's state?"
             Answer at that time: yes (unintended, according to community)
                    │
 2025-10-09  Paladin maintainer opens Issue #861:
             "Test access control to state within a single node"
                    │
 2025-10-20  PR #872 opened: "Restrict privacy group access to members"
             Adds a membership check to pgroup_sendTransaction / pgroup_call
                    │
 2025-10-28  PR #872 MERGED into main (commit 5bc44dc3b)
             Paladin's main briefly enforces identity-level RPC access
                    │
                    │   (three weeks pass with the new check in main)
                    │
 2025-11-20  PR #912 opened AND merged: "Revert 872 privacy group access"
             Removes the check. Design rationale published by maintainers.
                    │
 2026-06-25  Paladin v1.0.0 released — contains the revert.
                    │
 2026-07-29  This research package verifies v1.0.0 behaviour on a live
             Kind cluster. Same-node non-member reads succeed;
             non-member-node reads fail. Consistent with the design intent.
```

---

## The Discord conversation (2025-09-24 to 2025-09-26)

A community member ran a small test:

> There are 3 Paladin nodes, each hosting 2 identities.
> A privacy group is created with { identity_A@node1, identity_C@node2 } as members.
>
> Question: can identity_B@node1 (not a member, but on the same node as a member) read the group's private state?

Maintainer response (Matthew Whitehead, Firefly maintainer):

> We're looking into whether there is an issue with privacy group behaviour for identities on the same node. If it's OK we'll drop an update here very soon once we know more.

Follow-up from the community member:

> Right now it is behaving like node-level privacy but not member (EOA) level. If EOA level is not possible please let me know.

---

## Issue #861 — 2025-10-09

**URL:** https://github.com/LFDT-Paladin/paladin/issues/861
**Opened by:** matthew1001 (Matthew Whitehead)
**Title:** *Test access control to state within a single node*

Description:

> We need a test that ensures access to state within a single Paladin node is restricted to identities who should have access to it.
>
> To ensure that multi-identity nodes don't leak private data.

The wording is important: the issue framed the current same-node visibility as a **potential leak requiring a fix**, not as intended behaviour. That framing led to PR #872.

---

## PR #872 — 2025-10-20 to 2025-10-28

**URL:** https://github.com/LFDT-Paladin/paladin/pull/872
**Opened by:** annamcallister (Anna McAllister)
**Title:** *Restrict privacy group access to members*
**Merged:** 2025-10-28 as commit `5bc44dc3b`
**Diff size:** +148 / −29 across 7 files
**Full diff:** [../evidence/PR-872-full.diff](../evidence/PR-872-full.diff)

### PR description (verbatim)

> Add a missing check into the group manager that `from` is a member of the privacy group. This covers `pgroup_sendTransaction` and `pgroup_call`. Without this check both these RPC calls can be made from an identity that is not part of the privacy group, provided that another identity on the same node is part of the group.
>
> Update the `privacy-storage` example to include a failed read from an identity who is not part of the privacy group but is on the same node as an identity who is a member.

### What was actually added

One 22-line block in [`core/go/internal/groupmgr/manager.go`](https://github.com/LFDT-Paladin/paladin/blob/5bc44dc3b/core/go/internal/groupmgr/manager.go#L514) inside the `prepareTransaction` function:

```go
// Validate that the from identity is a member of the privacy group
if pgTX.From != "" {
    identifier, node, err := pldtypes.PrivateIdentityLocator(pgTX.From).Validate(ctx,
        gm.transportManager.LocalNodeName(), false)
    if err != nil {
        return nil, i18n.WrapError(ctx, err, msgs.MsgTxMgrPublicSenderNotValidLocal, pgTX.From)
    }
    fullyQualifiedFrom := fmt.Sprintf("%s@%s", identifier, node)

    isMember := false
    for _, member := range pg.Members {
        if member == fullyQualifiedFrom {
            isMember = true
            break
        }
    }
    if !isMember {
        return nil, i18n.NewError(ctx, msgs.MsgPGroupsFromNotMember, fullyQualifiedFrom, pg.ID)
    }
    pgTX.From = fullyQualifiedFrom
}
```

New error code: `PD012524 — "From identity '%s' is not a member of privacy group '%s'"`.

Three test cases added to `manager_test.go`:
- `TestSendTransactionFromNotMember` — sending as a non-member returns `PD012524`
- `TestCallFromNotMember` — calling as a non-member returns `PD012524`
- `TestSendTransactionFromValidMemberUnqualified` — unqualified names resolve correctly

The `privacy-storage` example was updated to include a same-node-non-member test that expected the new error.

### What was in force during Oct 28 – Nov 20 2025

Every same-node non-member attempt returned `PD012524`. The identity-level access-control test that the community had been asking for now passed. Anyone running Paladin `main` during this window saw what looked like sub-node privacy.

---

## PR #912 — 2025-11-20 (revert)

**URL:** https://github.com/LFDT-Paladin/paladin/pull/912
**Opened by:** annamcallister
**Title:** *Revert 872 privacy group access*
**Merged:** 2025-11-20 (same day it was opened)
**Diff size:** +28 / −144 across 5 files — a clean revert of PR #872
**Full diff:** [../evidence/PR-912-revert.diff](../evidence/PR-912-revert.diff)

The PR body is one line:

> Reverts #872 which changed intended behaviour.

### The design rationale — Andrew Richardson

Posted on the PR immediately after merge:

> Thanks @annamcallister — for the record, I flagged this one as being probably a step in the wrong direction. Paladin does currently provide node-level privacy. Locking down the keys you can use to sign things in a privacy group doesn't fundamentally change the privacy or visibility in that situation. On the other hand, I'd argue that the change in #872 put an unnecessary constraint between the keys used to validate the privacy group and the keys used to interact within the privacy group. There's no reason these need to be the same set of keys, and in some situations it may be beneficial to use different keys within the privacy group vs. the ones used to validate it.
>
> If the original intent was to provide multi-tenancy, or sub-node privacy in the context of private transactions, then that is definitely a larger feature we'll want to scope for the roadmap.

Andrew also posted a longer explanation on the Paladin Discord that day. The key sentence:

> Providing sub-node privacy or true multi-tenant nodes with segmented private storage is a roadmap item for Paladin. For now it's a responsibility of an API layer sitting in front of Paladin.

### Translating the design argument for engineers

Paladin's mental model separates **endorsement keys** (which sign off on a privacy group's transactions being valid) from **interaction keys** (which any application can use to call into the group). PR #872 conflated these — it treated the members list as the whitelist of legitimate callers. Andrew's argument is that this coupling is:

1. Unnecessary — the security guarantee doesn't come from restricting who calls the RPC; it comes from the endorsement policy.
2. Actively harmful — real applications sometimes want to segregate endorser keys from interactive keys (for example, using dedicated cold-signing keys for endorsement).
3. A partial fix at best — even with PR #872's check in place, a compromised or malicious node operator could still call locally, since the check gates the RPC entry point but not the underlying data-distribution layer or DB.

The reversal is therefore about **honesty of the security model**, not about capability. Paladin's real privacy boundary was always the node; the check made it look like the boundary was the identity, which was misleading.

### The consequence

Any Paladin release after 2025-11-20 — including v1.0.0-rc.1 onwards and v1.0.0 (2026-06-25) — behaves exactly like it did before PR #872. Same-node non-member access is allowed. Identity-level access control has to be built at an application layer above Paladin, not expected from Paladin itself.

---

## Why this history matters

If you inherit a Paladin evaluation report written between Oct 28 and Nov 20 2025, or read any documentation that references "PR #872 fixes identity-level access", **that documentation is out of date**. The check was removed. The design intent is node-level.

Concretely:
- Test scripts that expected `PD012524` for same-node non-members no longer see it.
- The `privacy-storage` example was reverted to test only cross-node isolation (not same-node).
- Any architecture proposal that treated same-node isolation as "already there" needs to be revisited.

---

## Verifying the current state yourself

```bash
git clone --depth 5 https://github.com/LFDT-Paladin/paladin.git /tmp/paladin-verify
cd /tmp/paladin-verify

# 1. Confirm the PR #872 check does not exist
grep -n "MsgPGroupsFromNotMember\|isMember" \
     core/go/internal/groupmgr/manager.go
# expected: no output

# 2. Confirm PD012524 has no producers in the codebase either
grep -rn "PD012524" --include="*.go" core/
# expected: no output
```

You can also inspect the specific tag:

```bash
gh api "repos/LFDT-Paladin/paladin/contents/core/go/internal/groupmgr/manager.go?ref=v1.0.0" \
  --jq '.content' | base64 -d | grep -c "MsgPGroupsFromNotMember"
# expected: 0
```

## What comes next

If sub-node / multi-tenant privacy matters to you, the interesting question is: what would it take? Continue to [Page 3 — the multi-tenant vision](03-multi-tenant-vision.md).
