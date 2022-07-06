# cla

## Use case

When activated and configured, a check will be added to every PR making sure
your CLA has been signed by all committers. If a committer has not signed your
CLA, the check will fail.

After signing the CLA, contributors can comment "I've signed the CLA!" on the PR to re-run the test suite.

This is intended for Shopify repositories only.

## Getting Started

Add the following workflow to your repository:

```yaml
# .github/workflows/cla.yml
name: Contributor License Agreement (CLA)

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: Shopify/github-actions/cla-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          cla-token: ${{ secrets.CLA_TOKEN }}
```

## Inputs

| Name           | Required | Default                                                                                                                          | Description                                   |
|----------------|----------|----------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| `github-token` | `true`   | [$GITHUB_TOKEN](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret) | The token to be used with GitHub interactions |
| `cla-token`    | `true`   | Provided by github-actions repository secret                                                                                     | The token to access cla.shopify.com           |


## Outputs

None
