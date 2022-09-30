import * as core from '@actions/core';
import * as github from '@actions/github';

import { VersionType } from '../types';

// Octokit's commit type subset
interface Commit {
  username: string;
  userUrl: string;
  commitUrl: string;
  message: string;
  sha: string;
}

/**
 * Generate a Markdown string based on commit information.
 * @param commits - The JSON array with Github commit info.
 */
export async function commitParser(
  token: string,
  baseRef: string,
  taskPrefix = 'JIR-',
  taskBaseUrl?: string,
  commitScope?: string
): Promise<{
  nextVersionType: VersionType;
  changes: string;
  contributors: string;
  tasks: string;
  pullRequests: string;
}> {
  const commitGroups: {
    [index: string]: { title: string; commits: Commit[] };
  } = {
    // A new feature
    feat: {
      title: '### **:zap: Features**',
      commits: [],
    },
    // A bug fix
    fix: {
      title: '### **:wrench: Fixes**',
      commits: [],
    },
    // A code change that improves performance
    perf: {
      title: '### **:runner: Performance**',
      commits: [],
    },
    // Documentation only changes
    docs: {
      title: '### **:books: Documentation**',
      commits: [],
    },
    // Changes that do not affect the meaning of the code (lint changes)
    style: {
      title: '### **:nail_care: Style**',
      commits: [],
    },
    // A code change that neither fixes a bug nor adds a feature
    refactor: {
      title: '### **:mountain: Refactors**',
      commits: [],
    },
    // Adding missing tests or correcting existing tests
    test: {
      title: '### **:traffic_light: Tests**',
      commits: [],
    },
    // Changes that affect the build system or external development dependencies
    chore: {
      title: '### **:construction: Maintenance**',
      commits: [],
    },
    // As an alternative to 'chore', but with very similar meaning
    build: {
      title: '### **:construction_worker: Build**',
      commits: [],
    },
    // Changes for CI configuration files and scripts (e.g. Github CI, helm values...)
    ci: {
      title: '### **:traffic_light: CI**',
      commits: [],
    },
  };
  const uncategorizedCommits: Commit[] = [];

  const changes: string[] = [];
  const contributors: Set<string> = new Set();
  const tasks: Set<string> = new Set();
  const pullRequests: string[] = [];
  let nextVersionType = VersionType.patch;

  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(token);

  core.debug(
    `Retrieving commit diff between ${baseRef} and ${github.context.sha}`
  );
  const compareCommitsResponse = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: baseRef,
    head: github.context.sha,
  });
  const {
    data: { commits },
  } = compareCommitsResponse;

  const categorizeCommit = (commit: Commit) => {
    const { message } = commit;
    // Skip if message is empty
    if (!message) {
      core.debug(`Commit has no message`);
      return;
    }
    // Skip if scope check is required and commit does not have it
    if (commitScope && !message.includes(`(${commitScope}):`)) {
      core.debug(`Commit has no scope when it is required -> "${message}"`);
      return;
    }
    // Check if commit message matches to any of the defined categories
    let categoryMatch = false;
    Object.keys(commitGroups).some((category) => {
      // Match with or without scope
      if (
        message.startsWith(`${category}:`) ||
        message.startsWith(`${category}(`)
      ) {
        commitGroups[category].commits.push(commit);
        categoryMatch = true;
        core.debug(`Commit matches category ${category} -> "${message}"`);
        return true;
      }
      return false;
    });
    if (!categoryMatch) {
      core.debug(`Commit has no category -> "${message}"`);
      uncategorizedCommits.push(commit);
    }
  };

  const prRegExp = new RegExp('(\\(#\\d+\\))', 'gmi');
  const taskRegExp = new RegExp(`\\[${taskPrefix}\\d+\\]`, 'gmi');
  const majorRegExp = new RegExp(`(#MAJOR$)`, 'gmi');
  commits.forEach((githubCommit) => {
    const {
      html_url: commitUrl,
      commit: { message },
      sha,
    } = githubCommit;
    let username = '';
    let userUrl = '';
    if (githubCommit.author) {
      ({ login: username, html_url: userUrl } = githubCommit.author);
      contributors.add(`@${username}`);
    }
    const commit: Commit = { username, userUrl, commitUrl, message, sha };

    // Detect if commit is a Github squash. In that case, convert body
    // in multiple single line commits and parse
    if (/\* .*\n/.test(message)) {
      core.debug('Commit is a Github squash, analyzing content...');
      const messageLines = message.split('* ');
      // Categorize all commits except first one
      messageLines.forEach((messageLine) =>
        categorizeCommit({
          username,
          userUrl,
          commitUrl,
          sha,
          message: messageLine.trim(),
        })
      );
    } else {
      categorizeCommit(commit);
    }
  });

  let changesMd = '';

  const formatCommit = (commit: Commit) => {
    const { username, userUrl, sha, commitUrl } = commit;
    let { message } = commit;

    // Retrieve PR link information
    const prMatch = prRegExp.exec(message);
    if (prMatch) {
      core.debug(`Found PRs: ${prMatch.toString()}`);
      prMatch
        .slice(1)
        .forEach((pr) => pullRequests.push(pr.replace(/(\(|\)|#)/g, '')));
    }

    // Retrieve specific bump key words
    const majorMatch = majorRegExp.exec(message);
    if (majorMatch) {
      core.debug('MAJOR bump detected');
      nextVersionType = VersionType.major;
    }

    // Only take into account the commit title
    [message] = message.split('\n');

    // Detect if commit message has Angular format
    if (/(\w+\([a-zA-Z_-]+\)|\w+|\([a-zA-Z_-]+\)):/.test(message)) {
      // Remove group information for changelog (e.g. messages with categories)
      message = message.split(':')[1].trim();
    }

    // Always capitalize commit messages
    message = `${message[0].toUpperCase()}${message.slice(1)}`;

    // Retrieve task information
    // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
    const taskMatch = message.match(taskRegExp);
    if (taskMatch) {
      const rawTask = taskMatch[0];
      const task = rawTask.replace('[', '').replace(']', '');
      core.debug(`Found task: ${rawTask}`);
      tasks.add(task);
      message = message.replace(
        rawTask,
        `[${task}](${
          taskBaseUrl || `https://${owner}.atlassian.net/browse`
        }/${task})`
      );
    }

    // Add to global change markdown
    changesMd = `${changesMd}- ${message} - [${sha.substring(
      0,
      8
    )}](${commitUrl}) ([@${username}](${userUrl}))\n`;
    // Add to global commit sha list
    changes.push(sha);
  };

  uncategorizedCommits.forEach(formatCommit);

  Object.keys(commitGroups).forEach((category) => {
    const { title, commits: groupCommits } = commitGroups[category];
    if (groupCommits.length !== 0) {
      changesMd = `${changesMd}\n${title}\n`;
      groupCommits.forEach(formatCommit);
    }
  });

  const contributorList = [...contributors];
  const taskList = [...tasks];
  core.setOutput('changes', JSON.stringify(changes));
  core.setOutput('contributors', JSON.stringify(contributorList));
  core.setOutput('tasks', JSON.stringify(taskList));
  core.setOutput('pull_requests', JSON.stringify(pullRequests));

  // Set bump type to minor if there is at least one 'feat' commit
  if (
    nextVersionType === VersionType.patch &&
    commitGroups.feat.commits.length > 0
  ) {
    nextVersionType = VersionType.minor;
  }
  core.setOutput('change_type', nextVersionType);

  return {
    nextVersionType,
    changes: changesMd.trim(),
    contributors: contributorList.join(', '),
    tasks: taskList
      .map(
        (task) =>
          `[${task}](${
            taskBaseUrl || `https://${owner}.atlassian.net/browse`
          }/${task})`
      )
      .join(', '),
    pullRequests: pullRequests
      .map((pr) => `[#${pr}](https://github.com/${owner}/${repo}/pull/${pr})`)
      .join(', '),
  };
}
