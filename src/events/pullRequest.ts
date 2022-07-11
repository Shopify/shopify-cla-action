import {Context} from '@actions/github/lib/context';
import {PullRequestEvent} from '@octokit/webhooks-definitions/schema';

import AuthorClassificationService from '../services/AuthorClassificationService';
import Cla from '../services/Cla';
import GithubService from '../services/GithubService';
import {config} from '../config';
import {EventInputs} from '../types';
import {CLA_REGEX} from '../matcher';

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

  const successful = await cla.checkCla(headSha, [prNumber]);
  const reaction = successful ? '+1' : '-1';

  const comments = (await githubService.listPrComments(prNumber)).filter(
    (comment: any) => CLA_REGEX.test(comment.body),
  );

  await Promise.all(
    comments.map(async (comment: any) => {
      const reactions = await githubService.listCommentReactions(comment.id);

      if (
        reactions.includes('eyes') &&
        !reactions.includes('+1') &&
        !reactions.includes('-1')
      ) {
        await githubService.addCommentReaction(comment.id, reaction);
      }
    }),
  );

  core.info(`CLA: ${headSha} Done`);
};
