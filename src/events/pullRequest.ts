import {Context} from '@actions/github/lib/context';
import {PullRequestEvent} from '@octokit/webhooks-definitions/schema';

import AuthorClassificationService from '../services/AuthorClassificationService';
import Cla from '../Cla';
import GithubService from '../services/GithubService';
import {config} from '../config';
import {EventInputs} from '../types';

function buildParametersFromPayload(context: Context): {
  headSha: string;
  prNumber: number;
} {
  const prPayload = context.payload as PullRequestEvent;

  return {
    headSha: prPayload.pull_request.head.sha,
    prNumber: prPayload.pull_request.number,
  };
}

export const pullRequest = async (inputs: EventInputs): Promise<void> => {
  const {core, context, octokit} = inputs;

  if (context.eventName !== 'pull_request_target') {
    throw new Error(`Invoked with incorrect event: ${context.eventName}`);
  }

  const {prNumber, headSha} = buildParametersFromPayload(context);

  core.info(
    `CLA: ${headSha} Triggered "${context.eventName}.${context.payload.action}" hook`,
  );

  const githubService = new GithubService(octokit, context.repo);
  const cla = new Cla(
    githubService,
    new AuthorClassificationService(config.claUrl, inputs.claToken || ''),
    core,
    config,
  );

  await cla.checkCla(headSha, [prNumber]);
  core.info(`CLA: ${headSha} Done`);
};
