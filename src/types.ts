import { Endpoints } from '@octokit/types';

export type Release =
  Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data'][number]

export enum VersionType {
  major = 'major',
  minor = 'minor',
  patch = 'patch',
  prerelease = 'prerelease'
}
