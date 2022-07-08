import {Context} from '@actions/github/lib/context';
import {Octokit} from '@octokit/core';
import {Api} from '@octokit/plugin-rest-endpoint-methods/dist-types/types';
import {PaginateInterface} from '@octokit/plugin-paginate-rest';
import * as core from '@actions/core';

export interface EventInputs {
  claToken: string;
  core: typeof core;
  context: Context;
  octokit: Octokit & Api & {paginate: PaginateInterface};
}
