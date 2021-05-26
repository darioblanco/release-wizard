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
  publishedTag?: string,
  bumpProtection = false,
): Promise<string> {
  const publishedVersion = publishedTag ? publishedTag.replace(tagPrefix, '') : undefined;

  const matchesTagPrefix = (release: Release) => release.tag_name.startsWith(tagPrefix);
  // Load latest production tag from published releases
  const lastTag = await findReleaseTag(token, matchesTagPrefix);
  core.debug(`Detected "${lastTag || 'undefined'}" as the latest tag`);
  const lastVersion = lastTag ? lastTag.replace(tagPrefix, '') : '0.0.0';
  core.debug(`Calculated "${lastVersion}" as the latest version`);

  let releaseType = nextVersionType;
  let newVersion: string | null = null;
  if (releaseType === VersionType.prerelease) {
    // Bump release candidate as 'prerelease' if detected as next release type
    newVersion = semver.inc(lastVersion, releaseType, 'rc') as string;
    core.debug(`Bump as prerelease, new calculated version: ${newVersion}`);
  } else {
    // 'major', 'minor' or 'patch' needs to be bumped
    // Override to 'patch' if bump protection is triggered
    if (
      bumpProtection &&
      publishedVersion &&
      // MINOR protection (if there was already a previous MINOR bump)
      ((nextVersionType === VersionType.minor &&
        !semver.satisfies(
          lastVersion,
          // ^1.2	is >=1.2.0 <2.0.0
          `^${semver.major(publishedVersion)}.${semver.minor(publishedVersion)}`,
        )) ||
        // MAJOR protection (if there was already a previous MAJOR bump)
        (nextVersionType === VersionType.major &&
          !semver.satisfies(
            lastVersion,
            // ^1	is >=1.0.0 <2.0.0
            `^${semver.major(publishedVersion)}`,
          )))
    ) {
      // Detect if there was a minor or major update between the latest production tag (baseTag)
      // and the latest tag (the one that will be bumped), if bump is not a patch.
      // If a major or minor update already happened, perform a patch instead.
      // Production deployments will never bump a minor or major more than once, while internal
      // tags can be bumped
      core.debug('Bump protection triggered, defining release type as PATCH');
      releaseType = VersionType.patch;
    }
    newVersion = semver.inc(lastVersion, releaseType);
    core.debug(`Bump as published release, new calculated version: ${newVersion || 'undefined'}`);
  }

  if (newVersion === null) {
    throw new Error(`Unable to perform a ${releaseType} bump to version ${lastVersion}`);
  }
  const newTag = `${tagPrefix}${newVersion}`;
  core.debug(`New tag: ${newTag}`);

  core.setOutput('previous_tag', lastTag || '');
  core.setOutput('previous_version', lastVersion);
  core.setOutput('new_tag', newTag);
  core.setOutput('new_version', newVersion);
  core.setOutput('release_type', releaseType);
  return newTag;
}

export async function retrieveLastReleasedVersion(
  token: string,
  tagPrefix: string,
): Promise<string | undefined> {
  const isVersionReleased = (release: Release) => {
    const { prerelease, draft, tag_name: tagName } = release;
    core.debug(`Evaluating if "${release.tag_name}" has been released`);
    return !draft && !prerelease && tagName.startsWith(tagPrefix);
  };
  const lastPublishedTag = await findReleaseTag(token, isVersionReleased);
  core.setOutput('base_tag', lastPublishedTag || '');
  return lastPublishedTag;
}
