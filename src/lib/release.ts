import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';

import { Release } from '../types';

export function renderReleaseName(releaseVersion: string, app?: string): string {
  return `${app ? `${app}@` : ''}${releaseVersion}`.trim();
}

export function renderReleaseBody(
  templatePath: string,
  app: string,
  releaseVersion: string,
  changes = '',
  tasks = '',
  pullRequests = '',
): string {
  const { repo } = github.context.repo;
  let body = fs
    .readFileSync(path.resolve('/home/runner/work', repo, repo, '.github', templatePath), 'utf8')
    .replace(/\$APP/g, app)
    .replace(/\$VERSION/g, releaseVersion);
  body = body.replace(/\$CHANGES/g, changes);
  body = body.replace(/\$TASKS/g, tasks);
  body = body.replace(/\$PULL_REQUESTS/g, pullRequests);
  return body;
}

export async function createGitTag(token: string, tag: string): Promise<void> {
  const { owner, repo } = github.context.repo;
  const { sha } = github.context;
  const octokit = github.getOctokit(token);

  await octokit.rest.git.createRef({
    owner,
    repo,
    sha,
    ref: `refs/tags/${tag}`,
  });
}

export async function createGithubRelease(
  token: string,
  tag: string,
  name: string,
  body: string,
  draft: boolean,
  prerelease: boolean,
  tagPrefix: string,
): Promise<void> {
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(token);

  if (draft) {
    // Detect if there was a previous release draft that must be removed,
    // looking for all previous release drafts that matches the given tag prefix
    const listReleasesOptions = octokit.rest.repos.listReleases.endpoint.merge({
      owner,
      repo,
    });
    for await (const response of octokit.paginate.iterator<Release>(listReleasesOptions)) {
      for (const release of response.data) {
        if (release.draft && release.tag_name.startsWith(tagPrefix)) {
          await octokit.rest.repos.deleteRelease({
            owner,
            repo,
            release_id: release.id,
          });
        }
      }
    }
  }

  // Create a release
  // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
  // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
  const createReleaseResponse = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tag,
    name,
    body,
    draft,
    prerelease,
  });

  // Get the ID, html_url, and upload URL for the created Release from the response
  const {
    data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl },
  } = createReleaseResponse;

  core.setOutput('release_id', releaseId.toString());
  core.setOutput('html_url', htmlUrl);
  core.setOutput('upload_url', uploadUrl);
}
