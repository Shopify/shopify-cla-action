import * as coreImport from '@actions/core';

import {issueComment} from '../../src/events/issueComment';
import {createContext} from '../mocks';
import issueCommentPayload from '../fixtures/issue_comment.created.json';
import {COMMENTS} from '../../src/templates';

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
      issues: {
        createComment: jest.fn(),
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
  it('should not trigger any actions for other event names', async () => {
    const context = createContext('pull_request', issueCommentPayload);
    context.workflow = 'current context';

    await issueComment({
      claToken,
      core,
      octokit,
      context,
    });

    expect(octokit.rest.actions.listRepoWorkflows).not.toHaveBeenCalled();
  });

  it('should add a comment and throw an error if no last run found', async () => {
    const context = createContext('issue_comment', issueCommentPayload);
    context.workflow = 'current context';

    octokit.rest.pulls.get.mockReturnValue(
      Promise.resolve({data: {head: {ref: 'feature-branch'}}}),
    );

    octokit.rest.actions.listRepoWorkflows.mockReturnValue(
      Promise.resolve({data: {workflows: [{name: context.workflow}]}}),
    );

    octokit.rest.actions.listWorkflowRuns.mockReturnValue(
      Promise.resolve({data: {workflow_runs: []}}),
    );

    await expect(
      issueComment({
        claToken,
        core,
        octokit,
        context,
      }),
    ).rejects.toThrowError(/Cannot find last run for the workflow/);

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      body: COMMENTS.restartWorkflowComment,
      issue_number: context.issue.number,
      owner: issueCommentPayload.repository.owner.login,
      repo: issueCommentPayload.repository.name,
    });
  });

  it('should add a success reaction if the recent workflow run was successful', async () => {
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
      Promise.resolve({data: {conclusion: 'success'}}),
    );

    await issueComment({
      claToken,
      core,
      octokit,
      context,
    });

    expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
      comment_id: issueCommentPayload.comment.id,
      content: '+1',
      owner: issueCommentPayload.repository.owner.login,
      repo: issueCommentPayload.repository.name,
    });

    expect(octokit.rest.actions.reRunWorkflow).not.toHaveBeenCalled();
  });
});
