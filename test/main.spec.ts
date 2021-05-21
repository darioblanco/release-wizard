import { getInput, setFailed } from '@actions/core';

import { commitParser } from '@darioblanco/release-wizard/lib/commits';
import {
  createGitTag,
  createGithubRelease,
  renderReleaseBody,
  renderReleaseName,
} from '@darioblanco/release-wizard/lib/release';
import { bumpVersion, retrieveLastReleasedVersion } from '@darioblanco/release-wizard/lib/version';
import { run } from '@darioblanco/release-wizard/main';
import { VersionType } from '@darioblanco/release-wizard/types';

jest.mock('@actions/core');
jest.mock('@darioblanco/release-wizard/lib/commits');
jest.mock('@darioblanco/release-wizard/lib/release');
jest.mock('@darioblanco/release-wizard/lib/version');

describe('run', () => {
  // Required input values
  const templatePath = 'RELEASE_DRAFT/default.md';
  const token = 'faketoken';
  // Default input values
  const taskPrefix = 'JIRA-';
  const draft = true;
  const prerelease = false;
  // Template stubs
  const changes = '';
  const nextVersionType = VersionType.patch;
  const tasks = '';
  const pullRequests = '';
  const body = 'releaseBody';

  beforeEach(() => {
    (commitParser as jest.Mock).mockImplementation(() => ({
      changes,
      nextVersionType,
      tasks,
      pullRequests,
    }));
    (renderReleaseBody as jest.Mock).mockImplementation().mockResolvedValue(body);
  });

  test('with required params', async () => {
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'bumpProtection':
          return 'false';
        case 'draft':
          return draft.toString();
        case 'prerelease':
          return prerelease.toString();
        case 'pushTag':
          return 'false';
        case 'taskPrefix':
          return taskPrefix;
        case 'templatePath':
          return templatePath;
        case 'token':
          return token;
        default:
          return undefined;
      }
    });
    const tagPrefix = '';

    const baseTag = 'v1.0.0';
    (retrieveLastReleasedVersion as jest.Mock).mockImplementation(() => baseTag);

    const releaseName = `draft prerelease`;
    (renderReleaseName as jest.Mock).mockImplementation(() => releaseName);
    const releaseVersion = '1.0.5';
    const releaseTag = `${tagPrefix}${releaseVersion}`;
    (bumpVersion as jest.Mock).mockImplementation(() => releaseTag);

    await run();

    expect(retrieveLastReleasedVersion).toBeCalledWith(token, tagPrefix);
    expect(commitParser).toBeCalledWith(token, baseTag, taskPrefix, undefined, undefined);
    expect(renderReleaseName).toBeCalledWith(releaseVersion, undefined);
    expect(renderReleaseBody).toBeCalledWith(
      token,
      templatePath,
      undefined,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
    );
    expect(bumpVersion).toBeCalledWith(token, tagPrefix, VersionType.patch, baseTag);
    expect(createGitTag).not.toBeCalled();
    expect(createGithubRelease).toBeCalledWith(
      token,
      releaseTag,
      releaseName,
      body,
      draft,
      prerelease,
      tagPrefix,
    );
    expect(setFailed).not.toBeCalled();
  });

  test('with specific production release and new release tag', async () => {
    const app = 'fake-app';
    const appTagSeparator = '@';
    const baseTag = 'v1.0.4';
    const givenDraft = false;
    const givenPrerelease = true;
    const releaseName = 'fake-app';
    const releaseTag = `mycustomprefix-1.0.6`;
    const taskBaseUrl = 'https://myfaketask.url';
    const withV = true;
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'app':
          return app;
        case 'appTagSeparator':
          return appTagSeparator;
        case 'baseTag':
          return baseTag;
        case 'bumpProtection':
          return 'true';
        case 'draft':
          return givenDraft.toString();
        case 'monorepo':
          return 'true';
        case 'prerelease':
          return givenPrerelease.toString();
        case 'pushTag':
          return 'true';
        case 'releaseName':
          return releaseName;
        case 'releaseTag':
          return releaseTag;
        case 'taskBaseUrl':
          return taskBaseUrl;
        case 'taskPrefix':
          return taskPrefix;
        case 'templatePath':
          return templatePath;
        case 'token':
          return token;
        case 'withV':
          return withV;
        default:
          return undefined;
      }
    });

    await run();

    expect(retrieveLastReleasedVersion).not.toBeCalled();
    expect(commitParser).toBeCalledWith(token, baseTag, taskPrefix, taskBaseUrl, app);
    expect(renderReleaseBody).toBeCalledWith(
      token,
      templatePath,
      app,
      releaseTag,
      changes,
      tasks,
      pullRequests,
    );
    expect(bumpVersion).not.toBeCalled();
    expect(createGitTag).toBeCalledWith(token, releaseTag);
    expect(createGithubRelease).toBeCalledWith(
      token,
      releaseTag,
      releaseName,
      body,
      givenDraft,
      givenPrerelease,
      `${app}${appTagSeparator}v`,
    );
    expect(setFailed).not.toBeCalled();
  });

  test('unexpected error', async () => {
    const errorMsg = 'fake';
    (getInput as jest.Mock).mockImplementation(() => {
      throw new Error(errorMsg);
    });

    await run();
    expect(setFailed).toBeCalledWith(errorMsg);
  });
});
