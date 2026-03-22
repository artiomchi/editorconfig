# editorconfig.build — GitHub Action

GitHub Action that validates or syncs your `.editorconfig` against a project published on [editorconfig.build](https://editorconfig.build).

## Modes

| Mode | What it does |
|------|-------------|
| `validate` | Compares the repo's `.editorconfig` with the remote config and **fails** if they differ. Use as a status check. |
| `apply` | Fetches the remote config, commits any changes directly to the branch, and posts (or updates) a PR comment with the diff. |

## Usage

### Validate — status check on PRs and main

```yaml
# .github/workflows/validate-editorconfig.yml
name: Validate .editorconfig

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: editorconfig-build/action@v1
        with:
          project-id: your-project-id
          token: your-project-token
```

### Apply — auto-sync on PR open, re-sync on demand

```yaml
# .github/workflows/sync-editorconfig.yml
name: Sync .editorconfig

on:
  pull_request:
    types: [opened]
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref || github.ref_name }}
      - uses: editorconfig-build/action@v1
        with:
          project-id: your-project-id
          token: your-project-token
          mode: apply
```

When a PR is opened the action will automatically commit the synced `.editorconfig` to the PR branch (if needed) and post a comment with the diff. Re-running via the Actions tab updates the comment in place rather than posting a duplicate.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `project-id` | Yes | — | Project ID from editorconfig.build |
| `token` | Yes | — | Project token from editorconfig.build (not secret — prevents enumeration) |
| `mode` | No | `validate` | `validate` or `apply` |
| `path` | No | `.editorconfig` | Path to the `.editorconfig` file in the repo |
| `github-token` | No | `${{ github.token }}` | GitHub token — needs `contents: write` and `pull-requests: write` for apply mode |
| `commit-message` | No | `chore: sync .editorconfig from editorconfig.build` | Commit message used by apply mode |

## Outputs

| Output | Description |
|--------|-------------|
| `diff` | Unified diff between the remote and local configs (empty string if in sync) |
| `in-sync` | `'true'` if the configs match, `'false'` if they differ |

## Where to find your project ID and token

Both are generated when you publish your project on [editorconfig.build](https://editorconfig.build).

## Limitations

- **Apply mode only works on PRs from the same repository.** The default `GITHUB_TOKEN` cannot push to fork branches, so PRs opened from forks will have the commit step skipped.
- The apply workflow is intentionally triggered only on `pull_request: opened` (not `synchronize`) to avoid a loop — committing a change would otherwise re-trigger the workflow.
