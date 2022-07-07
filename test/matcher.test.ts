import {matchEvents, supportedEvents} from '../src/matcher';

import {createContext} from './mocks';

describe('matches specific events', () => {
  it('responds with error if the event type is not supported', () => {
    expect(matchEvents(createContext('something unsupported'))).toMatchObject({
      matched: false,
      error: true,
    });
  });

  it('does not match comments without pull request', () => {
    expect(
      matchEvents(
        createContext('issue_comment', {action: 'created', issue: {}}),
      ),
    ).toMatchObject({
      matched: false,
      error: false,
    });
  });

  it('does not match comments that does not acknowledge they have signed the CLA', () => {
    expect(
      matchEvents(
        createContext('issue_comment', {
          action: 'created',
          issue: {
            pull_request: {},
          },
          comment: {body: 'please merge this pr :('},
        }),
      ),
    ).toMatchObject({
      matched: false,
    });
  });

  it('matches correct comment events', () => {
    const testComments = [
      'I have signed CLA',
      "I swear I've signed the cla",
      'I asdjkahdjakjdajkhsd signed asd7yas8das7dy cLa',
    ];

    testComments.forEach((body) => {
      expect(
        matchEvents(
          createContext('issue_comment', {
            action: 'created',
            issue: {
              pull_request: {},
            },
            comment: {body},
          }),
        ),
      ).toMatchObject({
        matched: true,
      });
    });
  });
});
