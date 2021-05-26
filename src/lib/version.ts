import semver from 'semver';
import * as core from '@actions/core';
import * as github from '@actions/github';

import { Release, VersionType } from '../types';

// See semver.ReleaseType

const findReleaseTag = async (token: string, matchFunction: (release: Release) => unknown) => {
  const { owner, repo } = github.context.repo;

  const octokit = github.getOctokit(token);

  // Using pagination: https://octokitRest.octokitRest.io/rest.js/v17#pagination
  const listReleasesOptions = octokit.rest.repos.listReleases.endpoint.merge({
    owner,
    repo,
  });

  // Look for the earliest release that matches the given condition
  /* eslint-disable no-restricted-syntax */
  for await (const response of octokit.paginate.iterator<Release>(listReleasesOptions)) {
    for (const release of response.data) {
      if (matchFunction(release)) return release.tag_name;
    }
  }
  /* eslint-enable no-restricted-syntax */
  return undefined;
};

export async function bumpVersion(
  token: string,
  tagPrefix: string,
  nextVersionType = VersionType.patch,
): Promise<string> {
  // Load latest production tag from published releases
  const fallbackVersion = '0.0.0';
  const lastTag =
    (await retrieveLastReleasedVersion(token, tagPrefix)) || `${tagPrefix}${fallbackVersion}`;
  core.debug(`Detected "${lastTag}" as the latest tag`);
  const lastVersion = lastTag.replace(tagPrefix, '');
  core.debug(`Calculated "${lastVersion}" as the latest version`);

  let newVersion: string;
  if (nextVersionType === VersionType.prerelease) {
    // Bump release candidate as 'prerelease' if detected as next release type
    newVersion = semver.inc(lastVersion, nextVersionType, 'rc') as string;
    core.debug(`Bump as prerelease, new calculated version: ${newVersion}`);
  } else {
    // 'major', 'minor' or 'patch' needs to be bumped
    newVersion = semver.inc(lastVersion, nextVersionType) as string;
    core.debug(`Bump as published release, new calculated version: ${newVersion}`);
  }

  const newTag = `${tagPrefix}${newVersion}`;
  core.debug(`New tag: ${newTag}`);

  core.setOutput('previous_tag', lastTag);
  core.setOutput('previous_version', lastVersion);
  core.setOutput('new_tag', newTag);
  core.setOutput('new_version', newVersion);
  core.setOutput('release_type', nextVersionType);
  return newTag;
}

export async function retrieveLastReleasedVersion(
  token: string,
  tagPrefix: string,
): Promise<string | undefined> {
  const isVersionReleased = (release: Release) => {
    const { prerelease, draft, tag_name: tagName } = release;
    core.debug(
      `Evaluating if "${release.tag_name}" has been released: ${JSON.stringify({
        prerelease,
        draft,
      })}`,
    );
    return !draft && !prerelease && tagName.startsWith(tagPrefix);
  };
  core.debug('Discover latest published release, which serves as base tag for commit comparison');
  return findReleaseTag(token, isVersionReleased);
}
