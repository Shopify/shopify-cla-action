import * as core from '@actions/core';
import * as github from '@actions/github';

import {run} from './run';

const main = async (): Promise<void> => {
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
