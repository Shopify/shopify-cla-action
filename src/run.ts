import {Context} from '@actions/github/lib/context';
import {PullRequestEvent} from '@octokit/webhooks-definitions/schema';
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

export const run = async (inputs: Inputs): Promise<void> => {
  const {core, context, octokit} = inputs;
  const {prNumbers, headSha} = buildParametersFromPayload(context);

  core.info(
    `CLA: ${headSha} Triggered "${context.eventName}.${context.payload.action}" hook`,
  );

  const cla = new Cla(
    new GithubService(octokit, context.repo),
    new AuthorClassificationService(config.claUrl, inputs.claToken || ''),
    core,
    config,
  );

  await cla.checkCla(headSha, prNumbers);

  core.info(`CLA: ${headSha} Done`);
};
