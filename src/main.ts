import * as core from '@actions/core';
import * as github from '@actions/github';

import {pullRequest} from './events/pullRequest';
import {matchEvents} from './matcher';
import {issueComment} from './events/issueComment';
import {EventInputs} from './types';

const main = async (): Promise<void> => {
  core.debug(JSON.stringify(github.context, null, 2));

  const eventCheck = matchEvents(github.context);

  if (!eventCheck.matched) {
    if (eventCheck.error) {
      throw new Error(eventCheck.message);
    }

    if (eventCheck.message) {
      core.warning(eventCheck.message);
    }

    return;
  }

  const githubToken = core.getInput('github-token', {required: true});
  const claToken = core.getInput('cla-token', {required: true});

  const octokit = github.getOctokit(githubToken);
  const {context} = github;

  const eventInputs: EventInputs = {
    claToken,
    octokit,
    core,
    context,
  };

  if (context.eventName === 'pull_request_target') {
    await pullRequest(eventInputs);
  }

  if (context.eventName === 'issue_comment') {
    await issueComment(eventInputs);
  }
};

main().catch((mainError) =>
  core.setFailed(
    mainError instanceof Error ? mainError.message : JSON.stringify(mainError),
  ),
);
