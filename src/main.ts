import * as core from '@actions/core';
import * as github from '@actions/github';

import { commitParser } from './lib/commits';
import {
  createGitTag,
  createGithubRelease,
  renderReleaseBody,
} from './lib/release';
import { bumpVersion, retrieveLastReleasedVersion } from './lib/version';
import { VersionType } from './types';

export async function run(): Promise<void> {
  try {
    // Global config
    const app = core.getInput('app', { required: false });
    const appTagSeparator = core.getInput('appTagSeparator', {
      required: false,
    });
    const token = core.getInput('token', { required: true });
    const withV = core.getBooleanInput('withV', { required: false });
    const versionPrefix = withV ? 'v' : '';
    const tagPrefix = app
      ? `${app}${appTagSeparator}${versionPrefix}`
      : versionPrefix;
    core.debug(
      `Global configuration: ${JSON.stringify({
        app,
        appTagSeparator,
        withV,
        versionPrefix,
        tagPrefix,
      })}`
    );

    // Commit loading config
    const baseTag =
      core.getInput('baseTag', { required: false }) ||
      (await retrieveLastReleasedVersion(token, tagPrefix)) ||
      (github.context.ref.split('/').pop() as string);
    core.setOutput('base_tag', baseTag);
    const taskBaseUrl = core.getInput('taskBaseUrl', { required: false });
    const taskPrefix = core.getInput('taskPrefix', { required: false });
    core.debug(
      `Commit configuration: ${JSON.stringify({
        baseTag,
        taskBaseUrl,
        taskPrefix,
      })}`
    );

    // Release config
    const pushTag = core.getInput('pushTag', { required: false }) === 'true';
    const templatePath = core.getInput('templatePath', { required: false });
    const draft =
      core.getInput('draft', { required: false }) === 'true' || false;
    const prerelease =
      core.getInput('prerelease', { required: false }) === 'true' || false;
    core.debug(
      `Release configuration: ${JSON.stringify({
        pushTag,
        templatePath,
        draft,
        prerelease,
      })}`
    );

    core.debug(`Parse commits from ${baseTag} to current sha`);
    const diffInfo = await commitParser(
      token,
      baseTag,
      taskPrefix,
      taskBaseUrl,
      app
    );
    const { changes, contributors, tasks, pullRequests } = diffInfo;

    let { nextVersionType } = diffInfo;
    // Force next version as release candidate if prerelease draft is created
    if (prerelease) {
      core.debug('Pre release detected');
      nextVersionType = VersionType.prerelease;
    }

    const releaseTag =
      core.getInput('releaseTag', { required: false }) ||
      (await bumpVersion(token, tagPrefix, nextVersionType));
    if (pushTag) {
      core.debug('Automatic push of git tag triggered');
      await createGitTag(token, releaseTag);
    }

    // Won't replace it if release tag is given manually
    const releaseVersion = releaseTag.replace(tagPrefix, '');
    const releaseTemplate = core.getInput('releaseTemplate', {
      required: false,
    });
    const releaseName =
      core.getInput('releaseName', { required: false }) ||
      releaseTemplate.replace(/\$TAG/g, releaseTag);
    core.debug(`Generate release body from template ${templatePath}`);
    const body = await renderReleaseBody(
      token,
      templatePath,
      app,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
      contributors
    );
    core.debug(
      `Create Github release for ${releaseTag} tag with ${releaseName} title`
    );
    await createGithubRelease(
      token,
      releaseTag,
      releaseName,
      body,
      draft,
      prerelease,
      tagPrefix
    );
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
