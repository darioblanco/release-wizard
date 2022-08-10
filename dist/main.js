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
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const commits_1 = require("./lib/commits");
const release_1 = require("./lib/release");
const version_1 = require("./lib/version");
const types_1 = require("./types");
async function run() {
    try {
        const app = core.getInput('app', { required: false });
        const appTagSeparator = core.getInput('appTagSeparator', { required: false });
        const token = core.getInput('token', { required: true });
        const withV = core.getBooleanInput('withV', { required: false });
        const versionPrefix = withV ? 'v' : '';
        const tagPrefix = app ? `${app}${appTagSeparator}${versionPrefix}` : versionPrefix;
        core.debug(`Global configuration: ${JSON.stringify({
            app,
            appTagSeparator,
            withV,
            versionPrefix,
            tagPrefix,
        })}`);
        const baseTag = core.getInput('baseTag', { required: false }) ||
            (await (0, version_1.retrieveLastReleasedVersion)(token, tagPrefix)) ||
            github.context.ref.split('/').pop();
        core.setOutput('base_tag', baseTag);
        const taskBaseUrl = core.getInput('taskBaseUrl', { required: false });
        const taskPrefix = core.getInput('taskPrefix', { required: false });
        core.debug(`Commit configuration: ${JSON.stringify({
            baseTag,
            taskBaseUrl,
            taskPrefix,
        })}`);
        const pushTag = core.getInput('pushTag', { required: false }) === 'true';
        const templatePath = core.getInput('templatePath', { required: false });
        const draft = core.getInput('draft', { required: false }) === 'true' || false;
        const prerelease = core.getInput('prerelease', { required: false }) === 'true' || false;
        core.debug(`Release configuration: ${JSON.stringify({
            pushTag,
            templatePath,
            draft,
            prerelease,
        })}`);
        core.debug(`Parse commits from ${baseTag} to current sha`);
        const diffInfo = await (0, commits_1.commitParser)(token, baseTag, taskPrefix, taskBaseUrl, app);
        const { changes, tasks, pullRequests } = diffInfo;
        let { nextVersionType } = diffInfo;
        if (prerelease) {
            core.debug('Pre release detected');
            nextVersionType = types_1.VersionType.prerelease;
        }
        const releaseTag = core.getInput('releaseTag', { required: false }) ||
            (await (0, version_1.bumpVersion)(token, tagPrefix, nextVersionType));
        if (pushTag) {
            core.debug('Automatic push of git tag triggered');
            await (0, release_1.createGitTag)(token, releaseTag);
        }
        const releaseVersion = releaseTag.replace(tagPrefix, '');
        const releaseName = core.getInput('releaseName', { required: false }) || releaseTag;
        core.debug(`Generate release body from template ${templatePath}`);
        const body = await (0, release_1.renderReleaseBody)(token, templatePath, app, releaseVersion, changes, tasks, pullRequests);
        core.debug(`Create Github release for ${releaseTag} tag with ${releaseName} title`);
        await (0, release_1.createGithubRelease)(token, releaseTag, releaseName, body, draft, prerelease, tagPrefix);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
exports.run = run;
