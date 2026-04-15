# editorconfig.build — GitHub Action

[![CI](https://github.com/artiomchi/editorconfig/actions/workflows/ci.yml/badge.svg)](https://github.com/artiomchi/editorconfig/actions/workflows/ci.yml)
[![.editorconfig](https://github.com/artiomchi/editorconfig/actions/workflows/editorconfig.yml/badge.svg)](https://github.com/artiomchi/editorconfig/actions/workflows/editorconfig.yml)

GitHub Action that validates or syncs your `.editorconfig` against a project published on [editorconfig.build](https://editorconfig.build).

## How it works

The action runs on every push and pull request. When drift is detected:

- **On a PR** — posts (or updates) a comment describing the drift. Depending on your configuration, the comment will either prompt you to add a label (`fix-editorconfig`) or tick a checkbox to trigger the automatic fix.
- **On push to main** — reports sync status to editorconfig.build (if telemetry is enabled in your project's config).

## Usage

```yaml
# .github/workflows/editorconfig.yml
name: .editorconfig

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, labeled]

permissions:
  contents: write       # required to commit the fixed .editorconfig
  pull-requests: write  # required to post/update PR comments and remove labels

jobs:
  editorconfig:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref || github.ref_name }}
      - uses: artiomchi/editorconfig@v2
        with:
          token: your-project-token
```

When a PR has drift, the action will post a comment like:

> **.editorconfig is out of sync with editorconfig.build**
> *(diff)*
> Add the `fix-editorconfig` label to this PR to have the action fix it for you.

Adding the label triggers a new run that writes and commits the correct `.editorconfig` to the PR branch, then updates the comment with the commit hash.

### Checkbox opt-in (alternative)

If you prefer a checkbox instead of a label, set `fix-trigger: checkbox` and add the `issue_comment` trigger:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [edited]
```

```yaml
      - uses: artiomchi/editorconfig@v2
        with:
          token: your-project-token
          fix-trigger: checkbox
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | — | Project token from editorconfig.build |
| `tag` | No | — | Version tag of the published config (defaults to latest) |
| `path` | No | `.editorconfig` | Path to the `.editorconfig` file in the repo |
| `auto-fix` | No | `false` | If `true`, write and commit the canonical `.editorconfig` automatically when drift is detected (no label/checkbox needed) |
| `fail-on-drift` | No | `true` | If `false`, emit a warning instead of failing when drift is detected |
| `pr-comment` | No | `true` | Whether to post (or update) a PR comment |
| `fix-trigger` | No | `label` | Opt-in mechanism when `auto-fix` is `false`: `label` or `checkbox` |
| `fix-label` | No | `fix-editorconfig` | Label name the action listens for when `fix-trigger: label` |
| `report-status` | No | `true` | Whether to report sync status to editorconfig.build for telemetry/dashboard purposes (only if enabled on project) |
| `github-token` | No | `${{ github.token }}` | GitHub token — needs `contents: write` and `pull-requests: write` |

## Outputs

| Output | Description |
|--------|-------------|
| `diff` | Unified diff between the remote and local configs (empty string if in sync) |
| `in-sync` | `'true'` if the configs match, `'false'` if they differ |

## Permissions

The action requires these permissions in the calling workflow:

| Permission | Reason |
|------------|--------|
| `contents: write` | Commit the fixed `.editorconfig` (`auto-fix: true` or label/checkbox trigger) |
| `pull-requests: write` | Post/update PR comments and remove the fix label |

## Fork PRs

The `github-token` cannot push to fork branches, so automatic fixes are not available on fork PRs. The action will still post an informational comment describing the drift.

## Where to find your token

Your project token is generated when you publish your project on [editorconfig.build](https://editorconfig.build).
