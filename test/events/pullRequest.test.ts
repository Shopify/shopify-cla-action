import * as coreImport from '@actions/core';

import {pullRequest} from '../../src/events/pullRequest';
import pullRequestPayload from '../fixtures/pull_request.opened.json';
import {createContext} from '../mocks';

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

describe('pull_request_target event:', () => {
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
});
