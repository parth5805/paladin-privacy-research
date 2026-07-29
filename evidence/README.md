# Evidence

Raw artefacts backing every claim in this repo. Nothing here is edited or interpreted — it is the source material.

| File | What it is | How to verify independently |
|------|-----------|-----------------------------|
| [PR-872-full.diff](PR-872-full.diff) | Complete diff of PR #872 as merged 2025-10-28 | `gh api repos/LFDT-Paladin/paladin/pulls/872 -H "Accept: application/vnd.github.v3.diff"` |
| [PR-912-revert.diff](PR-912-revert.diff) | Complete revert diff of PR #912 as merged 2025-11-20 | `gh api repos/LFDT-Paladin/paladin/pulls/912 -H "Accept: application/vnd.github.v3.diff"` |
| [upstream-manager.go](upstream-manager.go) | `core/go/internal/groupmgr/manager.go` from a fresh clone of upstream `main`, showing NO membership check | `git clone https://github.com/LFDT-Paladin/paladin.git && cat paladin/core/go/internal/groupmgr/manager.go` |
| [live-run-truth-table.txt](live-run-truth-table.txt) | Formatted truth table captured from running `demo/` against v1.0.0 | `cd demo && npm install && npm run start` |
| [live-run-raw.txt](live-run-raw.txt) | Untouched raw log from the same demo run | same |
| [deployed-image.txt](deployed-image.txt) | Kubernetes describe output showing the exact Paladin image tag under test | `kubectl -n paladin get pod paladin-node1-0 -o jsonpath='{.spec.containers[*].image}'` |

All GitHub links are to the public LFDT-Paladin/paladin repository. All commit hashes and PR numbers are checkable in a browser.
