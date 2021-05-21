import { setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';

import { commitParser } from '@darioblanco/release-wizard/lib/commits';
import { VersionType } from '@darioblanco/release-wizard/types';

jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'theowner',
      repo: 'therepo',
    },
  },
  getOctokit: jest.fn(),
}));
jest.mock('@actions/core');

const author = {
  login: 'darioblanco',
  html_url: 'https://authorurl',
};

const html_url = 'https://commiturl';
const sha = '62ec8ea713fdf14e4abaef3d7d5138194dec49ce';

describe('commit', () => {
  const token = 'secret';
  const compareCommitsResponse = {
    data: {
      commits: [
        {
          author,
          html_url,
          sha,
          commit: { message: 'feat:super feature' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'fix: My fix' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'perf: set additional performance steps' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'docs(my-app): document everything' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'style: awesome style' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'refactor(my-app): one does not simply refactor' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'test: Tests are good' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'chore: somebody has to keep things going' },
        },
        {
          html_url,
          sha,
          commit: { message: 'build: like chore but fancier and without author' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'ci: ok this is a CI change' },
        },
        {
          author,
          html_url,
          sha,
          commit: { message: 'uncategorized commit' },
        },
      ],
    },
  };
  const compareCommits = jest.fn(() => compareCommitsResponse);

  beforeEach(() => compareCommits.mockClear());

  test('render commits diff for each category', async () => {
    (getOctokit as jest.Mock).mockReturnValue({ rest: { repos: { compareCommits } } });
    const { changes, nextVersionType, tasks, pullRequests } = await commitParser(token);
    expect(setOutput).toBeCalledWith(
      'changes',
      JSON.stringify(compareCommitsResponse.data.commits.map((commit) => commit.sha)), // 8 commits
    );
    expect(setOutput).toBeCalledWith('tasks', '[]');
    expect(setOutput).toBeCalledWith('pull_requests', '[]');
    expect(changes).toMatchSnapshot();
    expect(nextVersionType).toBe(VersionType.minor);
    expect(tasks).toBe('');
    expect(pullRequests).toBe('');
  });

  test('render commits diff when scope is required', async () => {
    (getOctokit as jest.Mock).mockReturnValue({ rest: { repos: { compareCommits } } });
    const { changes, nextVersionType, tasks, pullRequests } = await commitParser(
      token,
      'v1.0.0',
      'JIRA-',
      undefined,
      'my-app',
    );
    expect(setOutput).toBeCalledWith(
      'changes',
      '["62ec8ea713fdf14e4abaef3d7d5138194dec49ce","62ec8ea713fdf14e4abaef3d7d5138194dec49ce"]',
    );
    expect(setOutput).toBeCalledWith('tasks', '[]');
    expect(setOutput).toBeCalledWith('pull_requests', '[]');
    expect(changes).toMatchSnapshot();
    expect(nextVersionType).toBe(VersionType.patch);
    expect(tasks).toBe('');
    expect(pullRequests).toBe('');
  });

  [undefined, 'http://my-task-url'].forEach((taskBaseUrl) =>
    test(`render gh squashed commits with scope, PRs and tasks for ${
      taskBaseUrl || 'undefined'
    }`, async () => {
      const commitMessage =
        'feat(auth): main commit of my PR (#1716)\n\n' +
        '* feat(auth): set login endpoint controller\n\n' +
        '* test(auth): add integration test for login endpoint #MAJOR\n\n' +
        '* fix(auth): set secure and http only options\n\n' +
        '* perf(auth): add additional fake performance\n\n' +
        'This is the body of the previous commit\n\n' +
        'And this is the footer\n\n' +
        '* (auth): Set values for staging and production\n\n' +
        '* Address comment from PR\n\n' +
        'This is the body of the previous commit\n\n' +
        '* feat(auth): set expiration of the cookie to the amount of time of the token\n\n' +
        '* fix(auth): remove joi validation since it does not accept localhost\n\n' +
        'Closes: JIRA-2772,JIRA-2773';
      const compareSquashedCommitsResponse = {
        data: {
          commits: [
            {
              author,
              html_url,
              sha,
              commit: {
                message: commitMessage,
              },
            },
          ],
        },
      };
      (getOctokit as jest.Mock).mockReturnValue({
        rest: { repos: { compareCommits: jest.fn(() => compareSquashedCommitsResponse) } },
      });
      const { changes, nextVersionType, tasks, pullRequests } = await commitParser(
        token,
        'v1.0.0',
        'JIRA-',
        taskBaseUrl,
        'auth',
      );
      expect(setOutput).toBeCalledWith(
        'changes',
        JSON.stringify(
          commitMessage
            .split('* ')
            .slice(1)
            .map(() => sha),
        ), // 6 commits
      );
      expect(setOutput).toBeCalledWith('tasks', '["JIRA-2772","JIRA-2773"]');
      expect(setOutput).toBeCalledWith('pull_requests', '["1716"]');
      expect(changes).toMatchSnapshot();
      expect(nextVersionType).toBe(VersionType.major);
      const jiraBaseUrl = taskBaseUrl || 'https://theowner.atlassian.net/browse';
      expect(tasks).toBe(
        `[JIRA-2772](${jiraBaseUrl}/JIRA-2772), [JIRA-2773](${jiraBaseUrl}/JIRA-2773)`,
      );
      expect(pullRequests).toBe('[#1716](https://github.com/theowner/therepo/pull/1716)');
    }),
  );

  test('render github squashed commits without scope, PRs and tasks', async () => {
    const commitMessage =
      'Title of my PR\n\n' +
      '* set login endpoint controller\n\n' +
      '* add integration test for login endpoint\n\n';
    const compareSquashedCommitsResponse = {
      data: {
        commits: [
          {
            author,
            html_url,
            sha,
            commit: {
              message: commitMessage,
            },
          },
        ],
      },
    };
    (getOctokit as jest.Mock).mockReturnValue({
      rest: { repos: { compareCommits: jest.fn(() => compareSquashedCommitsResponse) } },
    });
    const { changes, nextVersionType, tasks, pullRequests } = await commitParser(
      token,
      'v1.0.0',
      'JIRA-',
    );
    expect(setOutput).toBeCalledWith(
      'changes',
      '["62ec8ea713fdf14e4abaef3d7d5138194dec49ce",' +
        '"62ec8ea713fdf14e4abaef3d7d5138194dec49ce",' +
        '"62ec8ea713fdf14e4abaef3d7d5138194dec49ce"]',
    );
    expect(setOutput).toBeCalledWith('tasks', '[]');
    expect(setOutput).toBeCalledWith('pull_requests', '[]');
    expect(changes).toMatchSnapshot();
    expect(nextVersionType).toBe(VersionType.patch);
    expect(tasks).toBe('');
    expect(pullRequests).toBe('');
  });
});
