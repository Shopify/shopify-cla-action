import {Context} from '@actions/github/lib/context';
import {IssueCommentEvent} from '@octokit/webhooks-definitions/schema';

export const CLA_REGEX = /I.*signed.*CLA/i;

interface EventMatch {
  matched: boolean;
  error?: boolean;
  message?: string;
}

export const supportedEvents = [
  'pull_request_target.opened',
  'pull_request_target.reopened',
  'pull_request_target.synchronize',
  'issue_comment.created',
];

export function matchEvents(context: Context): EventMatch {
  const qualifiedEventName = `${context.eventName}.${context.payload.action}`;

  if (!supportedEvents.includes(qualifiedEventName)) {
    return {
      matched: false,
      error: true,
      message: `Hooked with invalid event type: ${qualifiedEventName}`,
    };
  }

  if (context.eventName === 'issue_comment') {
    const commentPayload = context.payload as IssueCommentEvent;

    if (!commentPayload.issue.pull_request) {
      // ignore comments not on PR
      return {
        matched: false,
        error: false,
        message: 'Issue is not a pull request',
      };
    }

    if (!CLA_REGEX.test(commentPayload.comment.body)) {
      return {
        matched: false,
        error: false,
        message: 'Comment does not match CLA pattern',
      };
    }
  }

  return {matched: true};
}
