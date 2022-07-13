import {flatten, isEqual, uniqWith} from 'lodash';
import {Octokit} from '@octokit/core';
import {Workflow, WorkflowRun} from '@octokit/webhooks-definitions/schema';

import Author from '../model/Author';

interface Repo {
  owner: string;
  repo: string;
}

interface PrInfoResponse {
  authors: Author[];
  commitCount: number;
}

export default class GithubService {
  constructor(github: Octokit, repo: Repo) {
    this.github = github;
    this.repo = repo;
  }

  public async getPullRequestsInfo(prNums: number[]): Promise<PrInfoResponse> {
    const resultData = await Promise.all(
      prNums.map((prNumber) => {
        return this.github.paginate(
          this.github.rest.pulls.listCommits,
          {
            pull_number: prNumber,
            ...this.repo,
          },
          (res: any) => res.data,
        );
      }),
    );

    const commits = uniqWith(flatten(resultData), isEqual);

    const allAuthors = commits.reduce((memo: any, commit: any) => {
      const {name = '', email = ''} = commit.commit.author;
      const {id = undefined, login = undefined} = commit.author || {};

      memo.push(new Author(name, email, id, login));
      return memo;
    }, []);

    return {
      authors: uniqWith(allAuthors, isEqual),
      commitCount: commits.length,
    };
  }

  public async listPrComments(prNumber: number) {
    const response = await this.github.paginate(
      this.github.rest.issues.listComments,
      {
        ...this.repo,
        issue_number: prNumber,
      },
      (res: any) => res.data,
    );

    return flatten(response);
  }

  public async listCommentReactions(commentId: number) {
    const response = await this.github.rest.reactions.listForIssueComment({
      ...this.repo,
      comment_id: commentId,
    });

    return response.data.map((reaction: any) => reaction.content);
  }

  public addCommentReaction(commentId: number, reaction = 'eyes') {
    return this.github.rest.reactions.createForIssueComment({
      ...this.repo,
      comment_id: commentId,
      content: reaction,
    });
  }

  public async getPullRequestWorkflowRuns(
    prNumber: number,
    workflowId: number,
    eventName: string,
  ): Promise<WorkflowRun[]> {
    const pr = await this.github.rest.pulls.get({
      ...this.repo,
      pull_number: prNumber,
    });

    const branch = pr.data.head.ref;

    const response = await this.github.rest.actions.listWorkflowRuns({
      ...this.repo,
      branch,
      workflow_id: workflowId,
      event: eventName,
    });

    return response.data.workflow_runs || [];
  }

  public async getWorkflowIdByName(name: string) {
    const workflows = await this.github.rest.actions.listRepoWorkflows({
      ...this.repo,
    });

    return workflows.data.workflows.find(
      (workflowItem: Workflow) => workflowItem.name === name,
    );
  }

  public async hasWorkflowFailed(id: number): Promise<boolean> {
    const workflow = await this.github.rest.actions.getWorkflowRun({
      ...this.repo,
      run_id: id,
    });

    return workflow.data.conclusion === 'failure';
  }

  public reRunWorkflow(id: number) {
    return this.github.rest.actions.reRunWorkflow({
      ...this.repo,
      run_id: id,
    });
  }

  public async addClaSignatureNeededLabel(
    prNumber: number,
    label: string,
  ): Promise<void> {
    await this.github.rest.issues.addLabels({
      labels: [label],
      issue_number: prNumber,
      ...this.repo,
    });
  }

  public async removeClaSignatureNeededLabel(
    prNumber: number,
    label: string,
  ): Promise<void> {
    // removeLabel will throw an exception if we try to remove a label that does
    // not exist. That's an acceptable case for us, so we don't want to log it.
    // Wrap the request in a try/catch so that we can silence that one exception
    try {
      await this.github.rest.issues.removeLabel({
        name: label,
        issue_number: prNumber,
        ...this.repo,
      });
    } catch (err: any) {
      const isLabelDoesNotExistError =
        err.name === 'HttpError' && err.message === 'Label does not exist';

      // Swallow the error if the label does not exist, but rethrow any others
      if (!isLabelDoesNotExistError) {
        throw err;
      }
    }
  }

  private readonly github: any;
  private readonly repo: Repo;
}
