import * as coreType from '@actions/core';

import AuthorClassificationService from './services/AuthorClassificationService';
import GithubService from './services/GithubService';
import {config as configType} from './config';

export default class Cla {
  constructor(
    githubService: GithubService,
    authorClassificationService: AuthorClassificationService,
    core: typeof coreType,
    config: typeof configType,
  ) {
    this.githubService = githubService;
    this.authorClassificationService = authorClassificationService;
    this.core = core;
    this.config = config;
  }

  public async checkCla(headSha: string, prNumbers: number[]) {
    this.core.info(`CLA: ${headSha} Fetching commits`);

    const commitsResult = await this.githubService.getPullRequestsInfo(
      prNumbers,
    );

    this.core.info(
      `CLA: ${headSha} Found ${commitsResult.commitCount} commits with ${commitsResult.authors.length} unique authors`,
    );

    const classifiedAuthors = await this.authorClassificationService.classify(
      commitsResult.authors,
    );

    const problematicAuthorCount =
      classifiedAuthors.withoutCla.length +
      classifiedAuthors.withoutGitHubAccount.length;

    if (problematicAuthorCount === 0) {
      this.core.debug(JSON.stringify(classifiedAuthors));
      this.core.info(
        `CLA: ${headSha} All authors have signed a CLA. Passing check`,
      );

      // Remove labels from all PRs affected by this check
      await Promise.all(
        prNumbers.map(async (prNumber) => {
          await this.githubService.removeClaSignatureNeededLabel(
            prNumber,
            this.config.label,
          );
        }),
      );
    } else {
      this.core.debug(JSON.stringify(classifiedAuthors));
      this.core.info(
        `CLA: ${headSha} Not all authors have signed a CLA or have a GitHub account associated with their email. Failing check`,
      );

      this.produceFailureMessage(
        classifiedAuthors.withoutCla.map((author) => author.formattedLogin),
        classifiedAuthors.withoutGitHubAccount.map(
          (author) => author.formattedCommitterLine,
        ),
      );

      // Add labels from all PRs affected by this check
      await Promise.all(
        prNumbers.map(async (prNumber) => {
          await this.githubService.addClaSignatureNeededLabel(
            prNumber,
            this.config.label,
          );
        }),
      );
    }
  }

  private produceFailureMessage(
    usernamesWithoutCla: string[],
    orphanCommitEmails: string[],
  ) {
    const summaryItems = [
      `${this.config.errorMessages.welcome.replace(
        '{{claUrl}}',
        this.config.claUrl,
      )}\n`,
    ];

    if (usernamesWithoutCla.length) {
      summaryItems.push(
        `- ${this.config.errorMessages.requestKnownUsers
          .replace('{{usernames}}', usernamesWithoutCla.join(', '))
          .replace('{{claUrl}}', this.config.claUrl)}`,
      );
    }

    if (orphanCommitEmails.length) {
      summaryItems.push(
        `- ${this.config.errorMessages.requestUnknownUsers
          .replace('{{emails}}', orphanCommitEmails.join(', '))
          .replace('{{claUrl}}', this.config.claUrl)}`,
      );
    }

    this.core.setFailed(summaryItems.join('\n'));
  }

  private readonly githubService: GithubService;
  private readonly authorClassificationService: AuthorClassificationService;
  private readonly core: any;
  private readonly config: any;
}
