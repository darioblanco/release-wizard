"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitParser = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const types_1 = require("../types");
async function commitParser(token, baseRef, taskPrefix = 'JIR-', taskBaseUrl, commitScope) {
    const commitGroups = {
        feat: {
            title: '## **:zap: Features**',
            commits: [],
        },
        fix: {
            title: '## **:wrench: Fixes**',
            commits: [],
        },
        perf: {
            title: '## **:runner: Performance**',
            commits: [],
        },
        docs: {
            title: '## **:books: Documentation**',
            commits: [],
        },
        style: {
            title: '## **:nail_care: Style**',
            commits: [],
        },
        refactor: {
            title: '## **:mountain: Refactors**',
            commits: [],
        },
        test: {
            title: '## **:traffic_light: Tests**',
            commits: [],
        },
        chore: {
            title: '## **:construction: Maintenance**',
            commits: [],
        },
        build: {
            title: '## **:construction_worker: Build**',
            commits: [],
        },
        ci: {
            title: '## **:traffic_light: CI**',
            commits: [],
        },
    };
    const uncategorizedCommits = [];
    const changes = [];
    const tasks = new Set();
    const pullRequests = [];
    let nextVersionType = types_1.VersionType.patch;
    const { owner, repo } = github.context.repo;
    const octokit = github.getOctokit(token);
    core.debug(`Retrieving commit diff between ${baseRef} and ${github.context.sha}`);
    const compareCommitsResponse = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: baseRef,
        head: github.context.sha,
    });
    const { data: { commits }, } = compareCommitsResponse;
    const categorizeCommit = (commit) => {
        const { message } = commit;
        if (commitScope && !message.includes(`(${commitScope}):`)) {
            core.debug(`Commit has no scope when it is required -> "${message}"`);
            return;
        }
        let categoryMatch = false;
        Object.keys(commitGroups).some((category) => {
            if (message.startsWith(`${category}:`) || message.startsWith(`${category}(`)) {
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
        const { html_url: commitUrl, commit: { message }, sha, } = githubCommit;
        let username = '';
        let userUrl = '';
        if (githubCommit.author) {
            ({ login: username, html_url: userUrl } = githubCommit.author);
        }
        const commit = { username, userUrl, commitUrl, message, sha };
        if (/\* .*\n/.test(message)) {
            core.debug('Commit is a Github squash, analyzing content...');
            const messageLines = message.split('* ');
            messageLines.forEach((messageLine) => categorizeCommit({
                username,
                userUrl,
                commitUrl,
                sha,
                message: messageLine.trim(),
            }));
        }
        else {
            categorizeCommit(commit);
        }
    });
    let changesMd = '';
    const formatCommit = (commit) => {
        const { username, userUrl, sha, commitUrl } = commit;
        let { message } = commit;
        const prMatch = prRegExp.exec(message);
        if (prMatch) {
            core.debug(`Found PRs: ${prMatch.toString()}`);
            prMatch.slice(1).forEach((pr) => pullRequests.push(pr.replace(/(\(|\)|#)/g, '')));
        }
        const majorMatch = majorRegExp.exec(message);
        if (majorMatch) {
            core.debug('MAJOR bump detected');
            nextVersionType = types_1.VersionType.major;
        }
        [message] = message.split('\n');
        if (/(\w+\([a-zA-Z_-]+\)|\w+|\([a-zA-Z_-]+\)):/.test(message)) {
            message = message.split(':')[1].trim();
        }
        message = `${message[0].toUpperCase()}${message.slice(1)}`;
        const taskMatch = message.match(taskRegExp);
        if (taskMatch) {
            const rawTask = taskMatch[0];
            const task = rawTask.replace('[', '').replace(']', '');
            core.debug(`Found task: ${rawTask}`);
            tasks.add(task);
            message = message.replace(rawTask, `[${task}](${taskBaseUrl || `https://${owner}.atlassian.net/browse`}/${task})`);
        }
        changesMd = `${changesMd}- ${message} - [${sha.substring(0, 8)}](${commitUrl})([@${username}](${userUrl}))\n`;
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
    const taskList = [...tasks];
    core.setOutput('changes', JSON.stringify(changes));
    core.setOutput('tasks', JSON.stringify(taskList));
    core.setOutput('pull_requests', JSON.stringify(pullRequests));
    if (nextVersionType === types_1.VersionType.patch && commitGroups.feat.commits.length > 0) {
        nextVersionType = types_1.VersionType.minor;
    }
    core.setOutput('change_type', nextVersionType);
    return {
        nextVersionType,
        changes: changesMd.trim(),
        tasks: taskList
            .map((task) => `[${task}](${taskBaseUrl || `https://${owner}.atlassian.net/browse`}/${task})`)
            .join(', '),
        pullRequests: pullRequests
            .map((pr) => `[#${pr}](https://github.com/${owner}/${repo}/pull/${pr})`)
            .join(', '),
    };
}
exports.commitParser = commitParser;
