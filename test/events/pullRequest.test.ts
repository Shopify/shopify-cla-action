import * as coreImport from '@actions/core';

import {pullRequest} from '../../src/events/pullRequest';
import pullRequestPayload from '../fixtures/pull_request.opened.json';
import {createContext} from '../mocks';

const httpGetJsonMock = jest.fn();

const core = {
  ...coreImport,
  info: jest.fn(),
  error: jest.fn(),
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

function setClaServiceResponse(data: any, error = false) {
  httpGetJsonMock.mockImplementation(() => {
    return Promise[error ? 'reject' : 'resolve']({
      result: data,
    });
  });
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
        listComments: jest.fn().mockReturnValue(Promise.resolve({data: []})),
      },
      pulls: {
        listCommits: jest.fn(),
      },
      reactions: {
        listForIssueComment: jest
          .fn()
          .mockReturnValue(Promise.resolve({data: []})),
        createForIssueComment: jest.fn(),
      },
    },
  };
}

describe('pull_request_target event:', () => {
  let octokit: any;
  const fixedNow = new Date('2018-07-01T13:00:00Z');

  function setListCommitsData(commitData: any) {
    octokit.rest.pulls.listCommits.mockReturnValue(
      Promise.resolve({headers: {link: ''}, data: commitData}),
    );
  }

  function setCommentsData(commentData: any) {
    octokit.rest.issues.listComments.mockReturnValue(
      Promise.resolve({
        data: commentData,
      }),
    );
  }

  function setReactionsData(reactionsData: any) {
    octokit.rest.reactions.listForIssueComment.mockReturnValue(
      Promise.resolve({
        data: reactionsData,
      }),
    );
  }

  beforeEach(() => {
    Date.now = jest.fn().mockReturnValue(fixedNow);
    octokit = createOctokitMock();
  });

  it('removes cla-signed labels if cla signed for all authors', async () => {
    const username = 'signed-user';
    setListCommitsData(createGitHubUserCommit(username));
    setClaServiceResponse({signedUsernames: [username]});

    await pullRequest({
      claToken,
      core,
      octokit,
      context: createContext('pull_request_target', pullRequestPayload),
    });

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
  });

  it('adds cla-signed label if cla is not signed for authors', async () => {
    const username = 'unsigned-user';
    setListCommitsData(createGitHubUserCommit(username));
    setClaServiceResponse({signedUsernames: []});

    await pullRequest({
      claToken,
      core,
      octokit,
      context: createContext('pull_request_target', pullRequestPayload),
    });

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
  });

  it('ignores event if users have no associated github account', async () => {
    setListCommitsData(createAnonymousUserCommit());

    await pullRequest({
      claToken,
      core,
      octokit,
      context: createContext('pull_request_target', pullRequestPayload),
    });

    expect(httpGetJsonMock).not.toHaveBeenCalled();

    expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
      labels: ['cla-needed'],
      issue_number: 3,
      owner: 'BPScott',
      repo: 'cla-test',
    });

    expect(octokit.rest.issues.removeLabel).not.toHaveBeenCalled();

    expect(core.setFailed).toHaveBeenCalled();
  });

  it('does not add reaction when there are no comments requesting CLA check', async () => {
    const username = 'signed-user';
    setListCommitsData(createGitHubUserCommit(username));
    setClaServiceResponse({signedUsernames: [username]});

    setCommentsData([
      {
        id: 'fake id',
        body: 'fake body',
      },
    ]);

    await pullRequest({
      claToken,
      core,
      octokit,
      context: createContext('pull_request_target', pullRequestPayload),
    });

    expect(octokit.rest.issues.listComments).toHaveBeenCalled();
    expect(octokit.rest.reactions.listForIssueComment).not.toHaveBeenCalled();
  });

  it('adds reactions for comments requesting CLA check', async () => {
    const username = 'signed-user';
    setListCommitsData(createGitHubUserCommit(username));
    setClaServiceResponse({signedUsernames: [username]});

    setCommentsData([
      {
        id: 'fake id',
        body: 'I signed CLA',
      },
    ]);

    setReactionsData([
      {
        content: 'eyes',
      },
    ]);

    await pullRequest({
      claToken,
      core,
      octokit,
      context: createContext('pull_request_target', pullRequestPayload),
    });

    expect(octokit.rest.issues.listComments).toHaveBeenCalled();
    expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
      comment_id: 'fake id',
      content: '+1',
      owner: 'BPScott',
      repo: 'cla-test',
    });
  });

  it('shows human-readable message when cla.shopify.com is down', async () => {
    const username = 'signed-user';
    setListCommitsData(createGitHubUserCommit(username));
    setClaServiceResponse(undefined, true);

    await pullRequest({
      claToken,
      core,
      octokit,
      context: createContext('pull_request_target', pullRequestPayload),
    });

    expect(httpGetJsonMock).toHaveBeenCalledTimes(3);
    expect(httpGetJsonMock).toHaveBeenCalledWith(
      authorEndpointUrl(username),
      httpClientHeaders,
    );

    expect(core.error).toHaveBeenCalledWith(
      'CLA: Failed to get a response from cla.shopify.com, please try again later.',
    );

    expect(octokit.rest.issues.removeLabel).not.toHaveBeenCalled();
    expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
  });
});
