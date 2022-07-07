import * as core from '@actions/core';
import * as github from '@actions/github';

import {run} from './run';
import {matchEvents} from './matcher';

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

  await run({
    claToken,
    octokit,
    core,
    context: github.context,
  });
};

main().catch((mainError) =>
  core.setFailed(
    mainError instanceof Error ? mainError.message : JSON.stringify(mainError),
  ),
);
