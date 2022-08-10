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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGithubRelease = exports.createGitTag = exports.renderReleaseBody = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const path_1 = require("path");
async function renderReleaseBody(token, templatePath, app, releaseVersion, changes = '', tasks = '', pullRequests = '') {
    const { owner, repo } = github.context.repo;
    const { ref } = github.context;
    const octokit = github.getOctokit(token);
    const path = (0, path_1.join)('.github', templatePath);
    core.debug(`Retrieving content from repo ${repo} (${ref}) in expected path ${path}`);
    const contentResponse = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
    });
    let template;
    if ('content' in contentResponse.data) {
        template = Buffer.from(contentResponse.data.content, 'base64').toString('utf8');
    }
    else {
        throw new Error(`Unable to find template in ${templatePath}`);
    }
    core.debug(`Retrieved template data: ${template}`);
    let body = template.replace(/\$APP/g, app).replace(/\$VERSION/g, releaseVersion);
    body = body.replace(/\$CHANGES/g, changes);
    body = body.replace(/\$TASKS/g, tasks);
    body = body.replace(/\$PULL_REQUESTS/g, pullRequests);
    core.setOutput('body', body);
    return body;
}
exports.renderReleaseBody = renderReleaseBody;
async function createGitTag(token, tag) {
    const { owner, repo } = github.context.repo;
    const { sha } = github.context;
    const octokit = github.getOctokit(token);
    core.debug(`Push git tag ${tag}`);
    await octokit.rest.git.createRef({
        owner,
        repo,
        sha,
        ref: `refs/tags/${tag}`,
    });
}
exports.createGitTag = createGitTag;
async function createGithubRelease(token, tag, name, body, draft, prerelease, tagPrefix) {
    var e_1, _a;
    const { owner, repo } = github.context.repo;
    const octokit = github.getOctokit(token);
    if (draft) {
        const listReleasesOptions = octokit.rest.repos.listReleases.endpoint.merge({
            owner,
            repo,
        });
        try {
            for (var _b = __asyncValues(octokit.paginate.iterator(listReleasesOptions)), _c; _c = await _b.next(), !_c.done;) {
                const response = _c.value;
                for (const release of response.data) {
                    if (release.draft && release.tag_name.startsWith(tagPrefix)) {
                        await octokit.rest.repos.deleteRelease({
                            owner,
                            repo,
                            release_id: release.id,
                        });
                        core.debug(`Deleted previous draft release "${release.name || 'undefined'}"`);
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    const createReleaseResponse = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tag,
        name,
        body,
        draft,
        prerelease,
    });
    core.debug(`Created release "${name}"`);
    const { data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl }, } = createReleaseResponse;
    core.setOutput('release_id', releaseId.toString());
    core.setOutput('html_url', htmlUrl);
    core.setOutput('upload_url', uploadUrl);
}
exports.createGithubRelease = createGithubRelease;
