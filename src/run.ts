import {Context} from '@actions/github/lib/context';
import {
  IssueCommentEvent,
  PullRequestEvent,
} from '@octokit/webhooks-definitions/schema';
import {Octokit} from '@octokit/core';
import {PaginateInterface} from '@octokit/plugin-paginate-rest';
import {Api} from '@octokit/plugin-rest-endpoint-methods/dist-types/types';
import * as core from '@actions/core';

import AuthorClassificationService from './AuthorClassificationService';
import Cla from './Cla';
import GithubService from './GithubService';
import {config} from './config';

interface Inputs {
  claToken: string;
  core: typeof core;
  context: Context;
  octokit: Octokit & Api & {paginate: PaginateInterface};
}

const CLA_REGEX = /I.*signed.*CLA/i;

export const run = async (inputs: Inputs): Promise<void> => {
  const {core, context, octokit} = inputs;

  const qualifiedEventName = `${context.eventName}.${context.payload.action}`;

  if (
    [
      'pull_request.opened',
      'pull_request.synchronize',
      'issue_comment.created',
    ].includes(qualifiedEventName)
  ) {
    await onCheck();
  } else {
    core.warning(`Hooked with invalid event type: ${qualifiedEventName}`);
  }

  async function onCheck() {
    if (context.eventName === 'issue_comment') {
      const commentPayload = context.payload as IssueCommentEvent;

      if (!commentPayload.issue.pull_request) {
        // ignore comments not on PR
        return;
      }

      if (!CLA_REGEX.test(commentPayload.comment.body)) {
        return;
      }
    }

    const {prNumbers, headSha} = buildParametersFromPayload(context);

    core.info(
      `CLA: ${headSha} Triggered "${context.eventName}.${context.payload.action}" hook`,
    );

    // If the check is triggered by pushing a new branch to the repo then there
    // won't be a PR associated with the commits yet.
    // Only run checks when there are PRs associated with the commit
    if (prNumbers.length === 0) {
      core.info(`CLA: ${headSha} Skipping as commit has no open PRs`);
      return;
    }

    const cla = new Cla(
      new GithubService(octokit, context.repo),
      new AuthorClassificationService(config.claUrl, inputs.claToken || ''),
      core,
      config,
    );

    await cla.checkCla(headSha, prNumbers);

    core.info(`CLA: ${headSha} Done`);
  }

  function buildParametersFromPayload(context: Context): {
    headSha: string;
    prNumbers: number[];
  } {
    const prPayload = context.payload as PullRequestEvent;

    return {
      headSha: prPayload.pull_request.head.sha,
      prNumbers: [prPayload.pull_request.number],
    };
  }
};
