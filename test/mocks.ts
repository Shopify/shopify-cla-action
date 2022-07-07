import {Context} from '@actions/github/lib/context';

export function createContext(eventName: string, payload: any = {}): Context {
  return {
    action: '',
    actor: '',
    apiUrl: '',
    graphqlUrl: '',
    job: '',
    ref: '',
    runId: 0,
    runNumber: 0,
    serverUrl: '',
    sha: '',
    workflow: '',
    get issue(): {owner: string; repo: string; number: number} {
      return {number: 0, owner: '', repo: ''};
    },
    get repo(): {owner: string; repo: string} {
      return {owner: 'BPScott', repo: 'cla-test'};
    },
    eventName,
    payload,
  };
}
