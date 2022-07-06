/* eslint-disable @typescript-eslint/naming-convention */
import {flatten, isEqual, uniqWith} from 'lodash';
import {Octokit} from '@octokit/core';

import Author from './Author';

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
