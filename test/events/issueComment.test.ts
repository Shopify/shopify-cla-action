import * as coreImport from '@actions/core';

import {issueComment} from '../../src/events/issueComment';
import {createContext} from '../mocks';
import issueCommentPayload from '../fixtures/issue_comment.created.json';

const core = {
  ...coreImport,
  info: jest.fn(),
  warning: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
};

function createOctokitMock() {
  return {
    rest: {
      reactions: {
        createForIssueComment: jest.fn(),
      },
      actions: {
        listRepoWorkflows: jest.fn(),
        listWorkflowRuns: jest.fn(),
        getWorkflowRun: jest.fn(),
        reRunWorkflow: jest.fn(),
      },
      pulls: {
        get: jest.fn(),
      },
    },
  };
}

describe('issue_comment event:', () => {
  let octokit: any;
  const claToken = 'secret';

  beforeEach(() => {
    octokit = createOctokitMock();
  });

  it('adds reaction to the comment and reruns the workflow', async () => {
    const context = createContext('issue_comment', issueCommentPayload);
    context.workflow = 'current context';

    octokit.rest.pulls.get.mockReturnValue(
      Promise.resolve({data: {head: {ref: 'feature-branch'}}}),
    );

    octokit.rest.actions.listRepoWorkflows.mockReturnValue(
      Promise.resolve({data: {workflows: [{name: context.workflow}]}}),
    );

    octokit.rest.actions.listWorkflowRuns.mockReturnValue(
      Promise.resolve({data: {workflow_runs: [{id: 'some fake id'}]}}),
    );

    octokit.rest.actions.getWorkflowRun.mockReturnValue(
      Promise.resolve({data: {conclusion: 'failure'}}),
    );

    await issueComment({
      claToken,
      core,
      octokit,
      context,
    });

    expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
      comment_id: issueCommentPayload.comment.id,
      content: 'eyes',
      owner: issueCommentPayload.repository.owner.login,
      repo: issueCommentPayload.repository.name,
    });

    expect(octokit.rest.actions.reRunWorkflow).toHaveBeenCalledWith({
      owner: issueCommentPayload.repository.owner.login,
      repo: issueCommentPayload.repository.name,
      run_id: 'some fake id',
    });
  });
});
