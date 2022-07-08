import * as coreImport from '@actions/core';

import {run} from '../src/run';

import pullRequestPayload from './fixtures/pull_request.opened.json';
import issueCommentPayload from './fixtures/issue_comment.created.json';
import {createContext} from './mocks';

const httpGetJsonMock = jest.fn();

const core = {
  ...coreImport,
  info: jest.fn(),
  warning: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@actions/http-client', () => ({
  HttpClient: jest.fn().mockImplementation(() => {
    return {getJson: httpGetJsonMock, getAgent: jest.fn()};
  }),
}));

const claToken = 'secret';
const githubToken = 'secret';

function authorEndpointUrl(usernames: string) {
  return `https://cla.shopify.com/api/contributor-check?usernames=${usernames}`;
}

const httpClientHeaders = {Authorization: `Token ${githubToken}`};

function setClaServiceResponse(data: any) {
  httpGetJsonMock.mockImplementation(() =>
    Promise.resolve({
      result: data,
    }),
  );
}

function createGitHubUserCommit(username: string) {
  return [
    {
      author: {id: 123, login: username},
      commit: {author: {email: `${username}@example.com`}},
      sha: 'abcdef',
    },
  ];
}

function createAnonymousUserCommit() {
  return [
    {
      author: null,
      commit: {author: {name: 'Mystery', email: 'mystery-user@example.com'}},
      sha: 'abcdef',
    },
  ];
}

function createOctokitMock() {
  const configBody = {data: {content: ''}};

  return {
    paginate: async (action: any, params: any, aggregator: any) =>
      aggregator(await action(params)),

    rest: {
      repos: {
        getContent: jest.fn().mockReturnValue(Promise.resolve(configBody)),
      },
      issues: {
        addLabels: jest.fn().mockReturnValue(Promise.resolve({})),
        removeLabel: jest.fn().mockReturnValue(Promise.resolve({})),
      },
      pulls: {
        listCommits: jest.fn(),
      },
    },
  };
}

describe('Shopify CLA Action', () => {
  let octokit: any;
  const fixedNow = new Date('2018-07-01T13:00:00Z');

  function setListCommitsData(commitData: any) {
    octokit.rest.pulls.listCommits.mockReturnValue(
      Promise.resolve({headers: {link: ''}, data: commitData}),
    );
  }

  beforeEach(() => {
    Date.now = jest.fn().mockReturnValue(fixedNow);
    octokit = createOctokitMock();
  });

  describe('cla signed for all authors: remove cla-signed labels', () => {
    const username = 'signed-user';

    it('pull_request_target.opened', async () => {
      setListCommitsData(createGitHubUserCommit(username));
      setClaServiceResponse({signedUsernames: [username]});

      await run({
        claToken,
        core,
        octokit,
        context: createContext('pull_request', pullRequestPayload),
      });

      assertClaSignedBehaviour();
    });

    it('issue_comment.created', async () => {
      setListCommitsData(createGitHubUserCommit(username));
      setClaServiceResponse({signedUsernames: [username]});

      await run({
        claToken,
        core,
        octokit,
        context: createContext('issue_comment', issueCommentPayload),
      });

      assertClaSignedBehaviour();
    });

    function assertClaSignedBehaviour() {
      expect(httpGetJsonMock).toHaveBeenCalledTimes(1);
      expect(httpGetJsonMock).toHaveBeenCalledWith(
        authorEndpointUrl(username),
        httpClientHeaders,
      );

      expect(octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        name: 'cla-needed',
        issue_number: 3,
        owner: 'BPScott',
        repo: 'cla-test',
      });

      expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
    }
  });

  describe('cla is not signed for authors: add cla-signed label', () => {
    const username = 'unsigned-user';

    it('pull_request_target.opened', async () => {
      setListCommitsData(createGitHubUserCommit(username));
      setClaServiceResponse({signedUsernames: []});

      await run({
        claToken,
        core,
        octokit,
        context: createContext('pull_request', pullRequestPayload),
      });

      assertClaNotSignedBehaviour();
    });

    it('issue_comment.created', async () => {
      setListCommitsData(createGitHubUserCommit(username));
      setClaServiceResponse({signedUsernames: []});

      await run({
        claToken,
        core,
        octokit,
        context: createContext('issue_comment', issueCommentPayload),
      });

      assertClaNotSignedBehaviour();
    });

    function assertClaNotSignedBehaviour() {
      expect(httpGetJsonMock).toHaveBeenCalledTimes(1);
      expect(httpGetJsonMock).toHaveBeenCalledWith(
        authorEndpointUrl(username),
        httpClientHeaders,
      );

      expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
        labels: ['cla-needed'],
        issue_number: 3,
        owner: 'BPScott',
        repo: 'cla-test',
      });

      expect(octokit.rest.issues.removeLabel).not.toHaveBeenCalled();

      expect(core.setFailed).toHaveBeenCalled();
    }
  });

  describe('cla is not signed when user has no associated github account', () => {
    it('pull_request_target.opened', async () => {
      setListCommitsData(createAnonymousUserCommit());

      await run({
        claToken,
        core,
        octokit,
        context: createContext('pull_request', pullRequestPayload),
      });

      assertClaNotAssociatedGitHubAccount();
    });

    it('issue_comment.created', async () => {
      setListCommitsData(createAnonymousUserCommit());

      await run({
        claToken,
        core,
        octokit,
        context: createContext('issue_comment', issueCommentPayload),
      });

      assertClaNotAssociatedGitHubAccount();
    });

    function assertClaNotAssociatedGitHubAccount() {
      expect(httpGetJsonMock).not.toHaveBeenCalled();

      expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
        labels: ['cla-needed'],
        issue_number: 3,
        owner: 'BPScott',
        repo: 'cla-test',
      });

      expect(octokit.rest.issues.removeLabel).not.toHaveBeenCalled();

      expect(core.setFailed).toHaveBeenCalled();
    }
  });
});
