# ci-shared

Reusable GitHub Actions pieces for vamahatech projects. Each project keeps its own tests
and triggers; the parts that are the same everywhere live here.

| What | Kind | Use it as |
|---|---|---|
| Deploy a Node app to EC2 with pm2 | reusable workflow | `uses: vamahatech/ci-shared/.github/workflows/deploy-node-ec2.yml@v1` (job) |
| Capacitor Android → Google Play | reusable workflow | `uses: vamahatech/ci-shared/.github/workflows/capacitor-android-play.yml@v1` (job) |
| Discord ✅/❌ message | composite action | `uses: vamahatech/ci-shared/discord-notify@v1` (step) |

Inputs, secrets and a caller example are at the top of each file.

### Capacitor Android → Google Play

Optional inputs for Play release configuration:

| Input | Type | Default | Description |
|---|---|---|---|
| `whatsnew-dir` | string | `''` | Directory of whatsnew-<locale> files (≤500 chars each) uploaded as Play release notes. Empty = none. |
| `status` | string | `completed` | Play release status - completed, inProgress (staged; needs user-fraction), draft or halted. |
| `user-fraction` | string | `''` | Staged rollout fraction 0-1 (exclusive) when status is inProgress. Empty = full rollout. |

Defaults keep the previous behaviour: full rollout, no release notes.

## Rules

- **No secrets, hostnames or project names in this repo.** Callers pass them in. (That is
  why it can be public, and why private repos can call it with no access setup.)
- **Callers pin `@v1`, never `@main`.** An edit here then can't break every project's
  deploy at once.
- **Only share what's genuinely identical.** Tests and builds differ per project and stay
  in the project's repo.

## Releasing a change

Compatible fix (callers need no change): merge to `main`, then move the major tag:

```bash
git tag -f v1 && git push -f origin v1
```

Breaking change (renamed input, changed behaviour): tag `v2`, then move projects to `@v2`
one at a time, checking each one's next run.

## Example caller

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps: [ ... project's own tests ... ]

  deploy:
    needs: test
    permissions: { contents: write }
    uses: vamahatech/ci-shared/.github/workflows/deploy-node-ec2.yml@v1
    with: { app-dir: MyApp, pm2-name: myapp, migrate-script: db:migrate }
    secrets: inherit

  notify:
    needs: [test, deploy]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: vamahatech/ci-shared/discord-notify@v1
        with:
          webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
          title: MyApp deploy
          status: ${{ needs.test.result == 'success' && needs.deploy.result || needs.test.result }}
```
