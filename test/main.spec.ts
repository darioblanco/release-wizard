import { getBooleanInput, getInput, setFailed } from '@actions/core';

import { commitParser } from '@/lib/commits';
import {
  createGitTag,
  createGithubRelease,
  renderReleaseBody,
} from '@/lib/release';
import { bumpVersion, retrieveLastReleasedVersion } from '@/lib/version';
import { run } from '@/main';
import { VersionType } from '@/types';

jest.mock('@actions/core');
jest.mock('@actions/github', () => ({
  context: {
    ref: 'refs/heads/main',
    repo: {
      owner: 'theowner',
      repo: 'therepo',
    },
  },
  getOctokit: jest.fn(),
}));
jest.mock('@/lib/commits');
jest.mock('@/lib/release');
jest.mock('@/lib/version');

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
  const contributors = '';
  const body = 'releaseBody';

  beforeEach(() => {
    (commitParser as jest.Mock).mockImplementation(() => ({
      changes,
      contributors,
      nextVersionType,
      tasks,
      pullRequests,
    }));
    (renderReleaseBody as jest.Mock)
      .mockImplementation()
      .mockResolvedValue(body);
  });

  test('with required params', async () => {
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
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

    const baseTag = 'main';
    (retrieveLastReleasedVersion as jest.Mock)
      .mockImplementation()
      .mockResolvedValue(undefined);

    const releaseVersion = '1.0.5';
    const releaseTag = `${tagPrefix}${releaseVersion}`;
    (bumpVersion as jest.Mock).mockImplementation(() => releaseTag);

    await run();

    expect(retrieveLastReleasedVersion).toBeCalledWith(token, tagPrefix);
    expect(commitParser).toBeCalledWith(
      token,
      baseTag,
      taskPrefix,
      undefined,
      undefined
    );
    expect(renderReleaseBody).toBeCalledWith(
      token,
      templatePath,
      undefined,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
      contributors
    );
    expect(bumpVersion).toBeCalledWith(token, tagPrefix, VersionType.patch);
    expect(createGitTag).not.toBeCalled();
    expect(createGithubRelease).toBeCalledWith(
      token,
      releaseTag,
      releaseTag,
      body,
      draft,
      prerelease,
      tagPrefix
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
        default:
          return undefined;
      }
    });
    (getBooleanInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'withV':
          return withV;
        default:
          return undefined;
      }
    });

    await run();

    expect(retrieveLastReleasedVersion).not.toBeCalled();
    expect(commitParser).toBeCalledWith(
      token,
      baseTag,
      taskPrefix,
      taskBaseUrl,
      app
    );
    expect(renderReleaseBody).toBeCalledWith(
      token,
      templatePath,
      app,
      releaseTag,
      changes,
      tasks,
      pullRequests,
      contributors
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
      `${app}${appTagSeparator}v`
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
