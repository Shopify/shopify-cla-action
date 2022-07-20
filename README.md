# Shopify CLA action

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
  pull_request_target:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  cla:
    runs-on: ubuntu-latest
    permissions:
      actions: write
      pull-requests: write
    if: |
      (github.event.issue.pull_request 
        && !github.event.issue.pull_request.merged_at
        && contains(github.event.comment.body, 'signed')
      ) 
      || (github.event.pull_request && !github.event.pull_request.merged)
    steps:
      - uses: Shopify/shopify-cla-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          cla-token: ${{ secrets.CLA_TOKEN }}
```

## How it works / features

The check:

* All PRs commit authors are checked against https://cla.shopify.com/
* If all GitHub usernames signed the CLA, the check will pass
* Otherwise the check will fail and the build message will ask first-time authors to sign the CLA

Comments:

* Every comment is [tested against regexp](https://github.com/Shopify/shopify-cla-action/blob/main/src/matcher.ts#L4)
* If the test was successful, it will trigger re-run of previous failed check

Following comments will be ignored:

* Comment on issue
* Comment on merged PR
* Comment without word `signed` will be filtered by a workflow definition

Reactions:

* If comment is matched with regexp, action will add :eyes: reaction to that comment
* If comment has :eyes: reaction and CLA check succeeded, action will also add :+1: reaction
* If comment has :eyes: reaction and CLA check failed, action will also add :-1: reaction

## Caveats

**This action does not produce any comments.**

If you need additional interaction with your users, please use [@actions/first-interaction](https://github.com/marketplace/actions/first-interaction).

## Inputs

| Name           | Required | Default                                                                                                                          | Description                                   |
|----------------|----------|----------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| `github-token` | `true`   | [$GITHUB_TOKEN](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret) | The token to be used with GitHub interactions |
| `cla-token`    | `true`   | Provided by github-actions repository secret                                                                                     | The token to access cla.shopify.com           |


## Outputs

None
