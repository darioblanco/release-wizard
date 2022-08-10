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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveLastReleasedVersion = exports.bumpVersion = void 0;
const semver_1 = __importDefault(require("semver"));
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const types_1 = require("../types");
const findReleaseTag = async (token, matchFunction) => {
    var e_1, _a;
    const { owner, repo } = github.context.repo;
    const octokit = github.getOctokit(token);
    const listReleasesOptions = octokit.rest.repos.listReleases.endpoint.merge({
        owner,
        repo,
    });
    try {
        for (var _b = __asyncValues(octokit.paginate.iterator(listReleasesOptions)), _c; _c = await _b.next(), !_c.done;) {
            const response = _c.value;
            for (const release of response.data) {
                if (matchFunction(release))
                    return release.tag_name;
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
    return undefined;
};
async function bumpVersion(token, tagPrefix, nextVersionType = types_1.VersionType.patch) {
    const fallbackVersion = '0.0.0';
    const lastTag = (await retrieveLastReleasedVersion(token, tagPrefix)) || `${tagPrefix}${fallbackVersion}`;
    core.debug(`Detected "${lastTag}" as the latest tag`);
    const lastVersion = lastTag.replace(tagPrefix, '');
    core.debug(`Calculated "${lastVersion}" as the latest version`);
    let newVersion;
    if (nextVersionType === types_1.VersionType.prerelease) {
        newVersion = semver_1.default.inc(lastVersion, nextVersionType, 'rc');
        core.debug(`Bump as prerelease, new calculated version: ${newVersion}`);
    }
    else {
        newVersion = semver_1.default.inc(lastVersion, nextVersionType);
        core.debug(`Bump as published release, new calculated version: ${newVersion}`);
    }
    const newTag = `${tagPrefix}${newVersion}`;
    core.debug(`New tag: ${newTag}`);
    core.setOutput('previous_tag', lastTag);
    core.setOutput('previous_version', lastVersion);
    core.setOutput('new_tag', newTag);
    core.setOutput('new_version', newVersion);
    core.setOutput('release_type', nextVersionType);
    return newTag;
}
exports.bumpVersion = bumpVersion;
async function retrieveLastReleasedVersion(token, tagPrefix) {
    const isVersionReleased = (release) => {
        const { prerelease, draft, tag_name: tagName } = release;
        core.debug(`Evaluating if "${release.tag_name}" has been released: ${JSON.stringify({
            prerelease,
            draft,
        })}`);
        return !draft && !prerelease && tagName.startsWith(tagPrefix);
    };
    core.debug('Discover latest published release, which serves as base tag for commit comparison');
    return findReleaseTag(token, isVersionReleased);
}
exports.retrieveLastReleasedVersion = retrieveLastReleasedVersion;
