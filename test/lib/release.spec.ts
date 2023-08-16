import * as fs from 'fs';
import { setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';

import {
  createGitTag,
  createGithubRelease,
  renderReleaseBody,
} from '@/lib/release';

jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'myorg',
      repo: 'myrepo',
    },
    sha: 'mysha',
    ref: 'myref',
  },
  getOctokit: jest.fn(),
}));
jest.mock('@actions/core');

const createReleaseResponse = {
  data: {
    id: 'releaseId',
    html_url: 'htmlUrl',
    upload_url: 'uploadUrl',
  },
};

describe('release', () => {
  const token = 'secret';

  describe('render release template', () => {
    const app = 'myapp';
    const releaseVersion = '1.0.0';
    const templatePath = 'myTemplatePath.md';

    const mockTemplate = (path?: string) => {
      let getContent: jest.Mock;
      if (path) {
        const content = fs.readFileSync(path, 'base64');
        getContent = jest.fn().mockResolvedValue({ data: { content } });
      } else {
        getContent = jest.fn().mockResolvedValue({ data: {} });
      }
      (getOctokit as jest.Mock).mockReturnValueOnce({
        rest: { repos: { getContent } },
      });
      return getContent;
    };

    test('render release template', async () => {
      const getContent = mockTemplate(`${__dirname}/fixtures/basic.md`);
      expect(
        await renderReleaseBody(
          token,
          'myTemplatePath.md',
          app,
          releaseVersion,
        ),
      ).toMatchSnapshot();
      expect(getContent).toHaveBeenCalledWith({
        owner: 'myorg',
        path: `.github/${templatePath}`,
        ref: 'myref',
        repo: 'myrepo',
      });
    });

    test('render release template with changes, tasks and pull requests', async () => {
      const templatePath = 'with-changelog.md';
      const getContent = mockTemplate(`${__dirname}/fixtures/${templatePath}`);
      const changes =
        '' +
        '- [#1](https://commiturl) First commit message ' +
        '([@darioblanco](https://github.com/darioblanco))\n' +
        '- [#2](https://commiturl) Second commit message ' +
        '([@darioblanco](https://github.com/darioblanco))';
      const tasks =
        '' +
        '- [JIRA-123](https://myorg.atlassian.net/browse/JIRA-123)\n' +
        '- [JIRA-456](https://myorg.atlassian.net/browse/JIRA-456)';
      const pullRequests =
        '' +
        '- [#1716](https://github.com/myorg/myrepo/pull/1716)\n' +
        '- [#1717](https://github.com/myorg/myrepo/pull/1717)';
      expect(
        await renderReleaseBody(
          token,
          templatePath,
          app,
          releaseVersion,
          changes,
          tasks,
          pullRequests,
        ),
      ).toMatchSnapshot();
      expect(getContent).toHaveBeenCalledWith({
        owner: 'myorg',
        path: `.github/${templatePath}`,
        ref: 'myref',
        repo: 'myrepo',
      });
    });

    test('throw error when template is not found', async () => {
      const templatePath = 'not-found.md';
      mockTemplate();
      await expect(
        renderReleaseBody(token, templatePath, app, releaseVersion),
      ).rejects.toThrow(
        new Error(`Unable to find template in ${templatePath}`),
      );
    });
  });

  test('create git tag', async () => {
    const tag = 'v1.1.0';
    const createRef = jest.fn(() => ({ status: 201 }));
    (getOctokit as jest.Mock).mockReturnValue({ rest: { git: { createRef } } });

    await createGitTag(token, tag);

    expect(createRef).toHaveBeenCalledWith({
      owner: 'myorg',
      repo: 'myrepo',
      sha: 'mysha',
      ref: `refs/tags/${tag}`,
    });
  });

  describe('create github release', () => {
    const tag = 'myapp/1.1.0';
    const tagPrefix = 'myapp/';
    const name = 'release title';
    const body = 'my release body';
    const prerelease = true;

    const createRelease = jest.fn(() => createReleaseResponse);
    const deleteRelease = jest.fn().mockResolvedValue({});

    test('draft', async () => {
      const listReleasesMock = jest.fn(() => 'iterator-options');
      const listReleasesIteratorMock = jest.fn(() => [
        {
          data: [
            { id: 1, draft: false, tag_name: 'app1/0.0.3' },
            { id: 2, draft: false, tag_name: 'myapp/0.0.1' },
            { id: 3, draft: false, tag_name: 'app2/0.0.1' },
          ],
        },
        {
          data: [
            { id: 4, draft: true, tag_name: 'myapp/0.0.2' },
            { id: 5, draft: true, tag_name: `app1/0.1.0` },
            { id: 6, draft: true, tag_name: `app2/0.1.2` },
          ],
        },
      ]);
      (getOctokit as jest.Mock).mockReturnValue({
        paginate: { iterator: listReleasesIteratorMock },
        rest: {
          repos: {
            createRelease,
            deleteRelease,
            listReleases: { endpoint: { merge: listReleasesMock } },
          },
        },
      });
      const draft = true;
      await createGithubRelease(
        token,
        tag,
        name,
        body,
        draft,
        prerelease,
        tagPrefix,
      );

      expect(createRelease).toHaveBeenCalledTimes(1);
      expect(createRelease).toHaveBeenCalledWith({
        body,
        draft,
        name,
        prerelease,
        owner: 'myorg',
        repo: 'myrepo',
        tag_name: tag,
      });
      expect(deleteRelease).toHaveBeenCalledTimes(1);
      expect(deleteRelease).toHaveBeenCalledWith({
        owner: 'myorg',
        repo: 'myrepo',
        release_id: 4,
      });
      expect(setOutput).toHaveBeenCalledTimes(3);
      expect(setOutput).toHaveBeenCalledWith('release_id', 'releaseId');
      expect(setOutput).toHaveBeenCalledWith('html_url', 'htmlUrl');
      expect(setOutput).toHaveBeenCalledWith('upload_url', 'uploadUrl');
    });

    test('published', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        rest: {
          repos: {
            createRelease,
            deleteRelease,
          },
        },
      });
      const draft = false;
      await createGithubRelease(
        token,
        tag,
        name,
        body,
        draft,
        prerelease,
        tagPrefix,
      );

      expect(createRelease).toHaveBeenCalledTimes(1);
      expect(createRelease).toHaveBeenCalledWith({
        body,
        draft,
        name,
        prerelease,
        owner: 'myorg',
        repo: 'myrepo',
        tag_name: tag,
      });
      expect(deleteRelease).not.toHaveBeenCalled();
      expect(setOutput).toHaveBeenCalledTimes(3);
      expect(setOutput).toHaveBeenCalledWith('release_id', 'releaseId');
      expect(setOutput).toHaveBeenCalledWith('html_url', 'htmlUrl');
      expect(setOutput).toHaveBeenCalledWith('upload_url', 'uploadUrl');
    });
  });
});
