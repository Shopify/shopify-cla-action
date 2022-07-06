import {includes, partition} from 'lodash';
import {HttpClient} from '@actions/http-client';

import Author from './Author';

interface ClassifiedAuthors {
  valid: Author[];
  withoutCla: Author[];
  withoutGitHubAccount: Author[];
}

interface ClaResponse {
  signedUsernames: string[];
}

export default class AuthorClassificationService {
  constructor(
    claSignedCheckerEndpoint: string,
    claSignedCheckerSecret: string,
  ) {
    this.claSignedCheckerEndpoint = claSignedCheckerEndpoint;
    this.claSignedCheckerSecret = claSignedCheckerSecret;
  }

  /**
   * Given an array of Authors, return an object containing three lists:
   * * `valid` contains an array of Authors that have a GH account and have
   *   signed a CLA
   * * `withoutCla` contains an array of Authors that have not signed a CLA
   * * `withoutGitHubAccount` contains an array of Authors that have an email
   *   but are not associated with a GitHub account
   */
  public async classify(authors: Author[]): Promise<ClassifiedAuthors> {
    // Initially valid contains a deduplicated list of all authors, valid and invalid.
    // Each time we run a partition pass a set of invalid authors shall be
    // removed
    let valid = Array.from(new Set(authors));
    let withoutGitHubAccount;
    let withoutCla;

    /* eslint-disable-next-line prefer-const */
    [valid, withoutGitHubAccount] = this.partitionHasGitHubAccount(valid);
    /* eslint-disable-next-line prefer-const */
    [valid, withoutCla] = await this.partitionHasSignedCla(valid);

    // At this point the only thing left in the valid array are authors with
    // a GitHub account that have signed a CLA
    return {valid, withoutCla, withoutGitHubAccount};
  }

  private partitionHasGitHubAccount(authors: Author[]): Author[][] {
    return partition(authors, (author: Author) => author.hasGithubAccount);
  }

  private async partitionHasSignedCla(authors: Author[]): Promise<Author[][]> {
    const logins = authors.map((author) => author.login).join(',');

    let signedUsernames: string[] = [];

    if (logins) {
      const http = new HttpClient('github-actions-cla');

      const response = await http.getJson<ClaResponse>(
        `${this.claSignedCheckerEndpoint}/api/contributor-check?usernames=${logins}`,
        {
          Authorization: `Token ${this.claSignedCheckerSecret}`,
        },
      );

      if (response.result?.signedUsernames) {
        signedUsernames = response.result.signedUsernames;
      }
    }

    return partition(authors, (author: Author) => {
      return includes(signedUsernames, author.login);
    });
  }

  private readonly claSignedCheckerEndpoint: string;
  private readonly claSignedCheckerSecret: string;
}
