import * as core from '@actions/core';

import { commitParser } from './lib/commits';
import { createGitTag, createGithubRelease, renderReleaseBody } from './lib/release';
import { bumpVersion, retrieveLastReleasedVersion } from './lib/version';
import { VersionType } from './types';

export async function run(): Promise<void> {
  try {
    // Global config
    const app = core.getInput('app', { required: false });
    const appTagSeparator = core.getInput('appTagSeparator', { required: false });
    const token = core.getInput('token', { required: true });
    const withV = core.getInput('withV', { required: false });
    const versionPrefix = withV ? 'v' : '';
    const tagPrefix = app ? `${app}${appTagSeparator}${versionPrefix}` : versionPrefix;

    // Commit loading config
    const baseTag =
      core.getInput('baseTag', { required: false }) ||
      (await retrieveLastReleasedVersion(token, tagPrefix));
    const taskBaseUrl = core.getInput('taskBaseUrl', { required: false });
    const taskPrefix = core.getInput('taskPrefix', { required: false });

    // Release config
    const pushTag = core.getInput('pushTag', { required: false }) === 'true';
    const templatePath = core.getInput('templatePath', { required: false });
    const draft = core.getInput('draft', { required: false }) === 'true' || false;
    const prerelease = core.getInput('prerelease', { required: false }) === 'true' || false;

    const diffInfo = await commitParser(token, baseTag, taskPrefix, taskBaseUrl, app);
    const { changes, tasks, pullRequests } = diffInfo;
    let { nextVersionType } = diffInfo;
    // Force next version as release candidate if prerelease draft is created
    if (prerelease) nextVersionType = VersionType.prerelease;

    const releaseTag =
      core.getInput('releaseTag', { required: false }) ||
      (await bumpVersion(token, tagPrefix, nextVersionType, baseTag));
    if (pushTag) await createGitTag(token, releaseTag);
    // Won't replace it if release tag is given manually
    const releaseVersion = releaseTag.replace(tagPrefix, '');
    const releaseName = core.getInput('releaseName', { required: false }) || releaseTag;
    const body = await renderReleaseBody(
      token,
      templatePath,
      app,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
    );
    await createGithubRelease(token, releaseTag, releaseName, body, draft, prerelease, tagPrefix);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
