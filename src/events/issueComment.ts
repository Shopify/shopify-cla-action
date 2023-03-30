import {IssueCommentEvent} from '@octokit/webhooks-definitions/schema';
import * as core from '@actions/core';

import GithubService from '../services/GithubService';
import {EventInputs} from '../types';
import {COMMENTS} from '../templates';

export const issueComment = async (inputs: EventInputs): Promise<void> => {
  const {context, octokit} = inputs;

  if (context.eventName !== 'issue_comment') {
    return;
  }

  const prNumber = context.issue.number;
  const githubService = new GithubService(octokit, context.repo);

  const currentWorkflow = await githubService.getWorkflowIdByName(
    context.workflow,
  );

  if (!currentWorkflow) {
    throw new Error('Cannot find current workflow');
  }

  const recentRuns = await githubService.getPullRequestWorkflowRuns(
    prNumber,
    currentWorkflow.id,
    'pull_request_target',
  );

  const lastRun = recentRuns.shift();

  if (!lastRun) {
    githubService.addComment(prNumber, COMMENTS.restartWorkflowComment);

    throw new Error(
      `Cannot find last run for the workflow: ${currentWorkflow.id}`,
    );
  }

  const hasLastRunFailed = await githubService.hasWorkflowFailed(lastRun.id);
  const commentPayload = context.payload as IssueCommentEvent;

  if (hasLastRunFailed) {
    core.info(`CLA: Adding comment reaction`);
    githubService.addCommentReaction(commentPayload.comment.id);

    try {
      core.info('CLA: Restarting workflow to check the endpoint status');
      await githubService.reRunWorkflow(lastRun.id);
    } catch (error) {
      githubService.addComment(prNumber, COMMENTS.restartWorkflowComment);
      core.error('CLA: Failed to restart workflow, please try again later.');
    }
  } else {
    core.info(
      'CLA: Recent workflow run was successful (cla signed), aborting...',
    );

    core.info(`CLA: Adding comment reaction`);
    githubService.addCommentReaction(commentPayload.comment.id, '+1');
  }
};
