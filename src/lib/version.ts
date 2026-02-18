import semver from 'semver';
import * as core from '@actions/core';
import * as github from '@actions/github';

import { Release, VersionType } from '../types';

const findHighestReleaseTag = async (
  token: string,
  tagPrefix: string,
  matchFunction: (release: Release) => unknown,
): Promise<string | undefined> => {
  const { owner, repo } = github.context.repo;

  const octokit = github.getOctokit(token);

  const listReleasesOptions = octokit.rest.repos.listReleases.endpoint.merge({
    owner,
    repo,
  });

  let highestTag: string | undefined;
  let highestVersion: semver.SemVer | null = null;

  for await (const response of octokit.paginate.iterator<Release>(
    listReleasesOptions,
  )) {
    for (const release of response.data) {
      if (!matchFunction(release)) continue;
      const version = semver.parse(release.tag_name.replace(tagPrefix, ''));
      if (!version) {
        core.debug(
          `Skipping release "${release.tag_name}": unable to parse semver`,
        );
        continue;
      }
      if (!highestVersion || semver.gt(version, highestVersion)) {
        highestVersion = version;
        highestTag = release.tag_name;
        core.debug(
          `New highest version candidate: "${release.tag_name}" (${version.version})`,
        );
      }
    }
  }

  return highestTag;
};

export async function bumpVersion(
  token: string,
  tagPrefix: string,
  nextVersionType = VersionType.patch,
  lastReleasedTag?: string,
): Promise<string> {
  const fallbackVersion = '0.0.0';
  const lastTag =
    lastReleasedTag ||
    (await retrieveLastReleasedVersion(token, tagPrefix)) ||
    `${tagPrefix}${fallbackVersion}`;
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
    core.debug(
      `Bump as published release, new calculated version: ${newVersion}`,
    );
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
  core.debug(
    'Discover latest published release by highest semver, which serves as base tag for commit comparison',
  );
  return findHighestReleaseTag(token, tagPrefix, isVersionReleased);
}
