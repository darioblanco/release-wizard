# Release Wizard

Creates a Github release with parsed commits into a given Markdown template. This project is
inspired by [Release Drafter](https://github.com/marketplace/actions/release-drafter),
and a continuation of [MOU Release](https://github.com/minddocdev/mou-release-action).

![Screenshot 2021-05-21 at 18 59 53](https://user-images.githubusercontent.com/1042520/119172981-dea94d80-ba66-11eb-83a7-b4278b15d5ec.png)

Release Drafter is awesome, but it lacks support for monorepos or the JavaScript ecosystem, which
usually stores different `package.json` in a single repository and development teams might want
to release such packages independently. In addition, if you want to generate Changelogs for
different areas of your repository, you will need to use a PR autolabeler.

Release Wizard tries to cover a few problems for monorepos or repositories with more than one
application (like it is usual to see in JavaScript with backend and frontend code):

- Allow the generation of changelogs for individual applications in the repository based on
  [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This feature is inspired
  in repositories like [Angular](https://github.com/angular/angular/commits/master) or
  [Yarn](https://github.com/yarnpkg/berry) where they use a `feat(mypackage): mycommit` format to
  separate such changelogs. This feature can be disabled if you want to go with the classic
  structure of one app = one repo.
- Calculate versions independently for each application in the repository. In Release Drafter, the
  version calculation is shared.
- No need to define PR labelers, the version calculation is done solely by conventional commits.
  Developers have full control about which commits will go to the release changelog in a monorepo
  scenario.
- Improve version calculation based on commit diffs, with an optional bump protection in case
  several MAJOR tags are found in the difference.

In addition, this action allows you to create a push a tag before the draft is created (which is
usually not handled by similar draft release actions).

## Usage

Simplest usage, (single application per repository), and the action will check for
the latest published release that matches the `v` prefix, it will use the template created in
release-wizard.md`, and generate a changelog for all the commits in that diff and suggest a version bump.

```yaml
name: 'myrelease'
on:
  push:
    branches:
      - master
jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - name: Create Release
        uses: darioblanco/release-wizard@main
        with:
          token: ${{ github.token }}
```

For given tags, where automatic tag suggestion is disabled and the commit parsing is controlled
by `baseTag` and `releaseTag`:

```yaml
name: 'myrelease'
on:
  push:
    branches:
      - main
jobs:
  bump:
    runs-on: ubuntu-latest
    env:
      APP: myapp
    steps:
      - name: Checkout git repository
        uses: actions/checkout@master
      - name: Bump version and push tag
        uses: darioblanco/release-wizard@main
        id: bump_version
        with:
          prefix: ${{ env.APP }}@
          token: ${{ github.token }}
      - name: Create Release
        uses: darioblanco/release-wizard@main
        with:
          app: ${{ env.APP }}
          baseTag: my-production-deployed-tag
          releaseName: ${{ env.APP }} ${{ steps.bump_version.outputs.version }}
          releaseTag: ${{ steps.bump_version.outputs.tag }}
          templatePath: RELEASE_DRAFT/default.md
          token: ${{ github.token }}
```

More complex example, where the action will check for the latest published release that matches
`myapp/` prefix, create a changelog for all the commits that has the `(myapp)` scope,
and bump the version to `minor`, `major` or `patch` depending on the commit messages and if there
was a previous `minor` or `major` bump in the diff with the latest published tag.
As the `prerelease` parameter is `true`, the draft will have the `prerelease` checkbox marked and
the proposed tag will have the `-rc.X` suffix.
This setting is ideal for monorepos, where multiple release scopes live.

```yaml
name: 'myrelease'
on:
  push:
    branches:
      - main
jobs:
  bump:
    runs-on: ubuntu-latest
    env:
      APP: myapp
    steps:
      - name: Checkout git repository
        uses: actions/checkout@master
      - name: Create Release
        uses: darioblanco/release-wizard@main
        with:
          app: ${{ env.APP }}
          prerelease: true
          templatePath: RELEASE_DRAFT/default.md
          token: ${{ github.token }}
```

## Options

### Inputs

| Name            | Required | Default                                         | Description                                                                                                                                                                                                                                                                           |
| --------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| app             | no       | `null`                                          | The name of the app involved in the release. Creates tag and render commits for a specific scope, based on the given app name. Scopes from commits are analyzed for commits that follow the Angular commit style, e.g. `<type>(<app>): my commit title` or `(<app>): my commit title` |
| appTagSeparator | no       | `/`                                             | The separator for the tags if `app` is given. For example, if `@` is provided, the version calculated for such app will be based on `myapp@myversion`. Defaults to `/`, as it is common to see the `myapp/myversion` format.                                                          |
| baseTag         | no       | `null`                                          | The tag that will be used as base for git commit comparison, instead of the automatic detection of latest published release. The commits will be formatted into a Markdown list and replaced into the `$CHANGES` variable for the given `templatePath` template file.                 |
| draft           | no       | `true`                                          | Publish release draft.                                                                                                                                                                                                                                                                |
| prerelease      | no       | `false`                                         | Mark release as prerelease when creating. This will ignore `major`, `minor` and `patch` bump suggestions and propose a [prerelease](https://github.com/npm/node-semver#prerelease-tags).                                                                                              |
| pushTag         | no       | `false`                                         | Creates and pushes the automatic calculated tag before creating the release. Useful if you want the action to handle tags for you when publishing drafts. By default, a release draft won't create the tag, which only happens when it is published.                                  |
| releaseName     | no       | `<app?> <$version>`                             | The title of the release                                                                                                                                                                                                                                                              |
| releaseTag      | no       | `<app?><$appTagSeparator?><withV?v:><$version>` | The git tag that belongs to the release.                                                                                                                                                                                                                                              |
| taskBaseUrl     | no       | `https://<mygithuborg>.atlassian.net/browse`    | The base url to append for a detected task (do not set a trailing `/`). By default, it will create a url based on your Github organization.                                                                                                                                           |
| taskPrefix      | no       | `JIRA-`                                         | The prefix that identifies task ids in the commits.                                                                                                                                                                                                                                   |
| templatePath    | no       | `release-wizard.md`                             | The path for the Markdown template that will be used to create the release body, relative to `.github/`.                                                                                                                                                                              |
| token           | yes      |                                                 | The token to access Github's API.                                                                                                                                                                                                                                                     |
| withV           | no       | `false`                                         | Prefix the calculated version with `v`                                                                                                                                                                                                                                                |

### Outputs

| Name             | Description                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| changes          | A JSON array with the list of commit sha that are involved in the release.      |
| new_tag          | The newly created tag that will reference the release.                          |
| new_version      | The newly created version that belongs to the tag.                              |
| html_url         | The browser url linking to Github's release.                                    |
| tasks            | A JSON array with the list of project management tasks involved in the release. |
| previous_tag     | The previously detected tag that was bumped by the action.                      |
| previous_version | The previously detected version that was bumped by the action.                  |
| pull_requests    | A JSON array with the list of Github pull requests involved in the release.     |
| release_id       | The release id given by Github's API.                                           |
| upload_url       | The url used for uploading release artifacts.                                   |

## Template

Create a Markdown template that will be used for the release body. Reference it with the
`templatePath` input. For example:

```md
# $APP $VERSION release

## Changelog

$CHANGES

## JIRA Tasks

$TASKS

## Pull Requests

$PULL_REQUESTS

## Checklist

- [ ] Check 1

  - [ ] Check 1.2

- [ ] Check 2

## Stakeholders

- [ ] Stakeholder 1
- [ ] Stakeholder 2
```

### Template variables

The action will replace the following variables:

- `$APP`: the `app` input.
- `$VERSION`: the updated version without `tagPrefix`.
- `$CHANGES`: the rendered list of commit messages. See [commit format](#commit-format).
  Commits will be detected if a `baseRef` is given or if another previous (and matching) tag was
  pushed to the repository and its release was published (automatic detection).
- `$TASKS`: the bullet list of detected tasks. See [task format](#task-format).
- `$PULL_REQUESTS`: the list of Github PRs. See [PR format](#pr-format).

#### Commit format

If your commits follow the expected [commit style](#commit-types)
the action will automatically categorize them in `$CHANGES` like in the following example:

![Screenshot 2021-05-21 at 19 19 34](https://user-images.githubusercontent.com/1042520/119175133-c0911c80-ba69-11eb-8b59-47a623ce792a.png)

In this case, all commits that will be added to the production release are displayed here. The ones
that did not follow any commit style where at the top of the changelog without a category.

If the `app` input is given, commits that only have the `(<app>)` scope will be shown.
Being `<app>` the input given to the action.

Of course, in case you do not want to follow a specific commit style at all,
all changes will rendered without any fancy categorization:

![Screenshot 2021-05-21 at 19 19 46](https://user-images.githubusercontent.com/1042520/119175166-c7b82a80-ba69-11eb-8540-986c763d19b9.png)

#### Task format

Tasks are detected with the given `taskPrefix` and the hyperlink is created with `taskBaseUrl`.
If none of these parameters are given, a default `JIRA-` prefix and
`https://<REPO_ORG>.atlassian.net/browse` values are used.

The output is a bullet list:

![Screenshot 2021-05-21 at 19 19 56](https://user-images.githubusercontent.com/1042520/119175185-cd157500-ba69-11eb-9ac2-a3da83591058.png)

#### PR format

In addition, you can render project management tasks and PRs. The PR rendering follows Github's
format (where squash and rebase commits output `(#<PR_ID>)`).

![Screenshot 2021-05-21 at 19 20 05](https://user-images.githubusercontent.com/1042520/119175206-d272bf80-ba69-11eb-8f78-2892e7f31b4c.png)

## Commit style

In case you want to take full power of changelog categories, the action offers a way to classify
them in the release body.

### Commit Message Conventions

The commit style follows [Conventional Commits](https://www.conventionalcommits.org/),
and is able to group changes in the changelog if some specific types are given.

#### Type

The following commit _types_ are detected (using `<type>:` or `<type>(<scope>):` at
the beginning of the commit message or in the Github squash line):

- `feat`: a new feature
- `fix`: a bug fix
- `perf`: a code change that improves performance
- `docs`: documentation only changes
- `style`: changes that do not affect the meaning of the code (lint changes)
- `refactor`: a code change that neither fixes a bug nor adds a feature
- `test`: adding missing tests or correcting existing tests
- `chore`: changes that affect the system or external development dependencies
- `build`: as an alternative to `chore`, but with very similar m eaning
  (updated in `Angular` commit style)
- `ci`: changes for CI configuration files and scripts

#### Scope

The _scope_ is required when an `app` is given, in order to only generate a changelog
for those commits that belong to the specific app. Therefore, all relevant commit messages
should have the `<type>(<scope>):` or `(<scope>):` format
(though the latter is not considered a conventional commit).
Scope should be equal to the given `app` input.

### Automatic semantic version type detection

By default, all release versions will be bumped using `PATCH`. Therefore, this action defines
different logic to bump using `MINOR` and `MAJOR`.

#### `MINOR` bumps

If there is a `feat` in the commit diff between the latest published release and the current one,
the action will suggest a `MINOR` release bump. This release type should only be used when new
features are deployed to production.

As an alternative, it will also do a `MINOR` bump if there is a `#MINOR` string found
in any commit message from the diff.

#### `MAJOR` bumps

If there is a `#MAJOR` string found in any commit message from the diff, the action will suggest
a `MAJOR` release bump. As this release type involves backwards incompatible changes, the behavior
should be fully controlled by the user.

## Development

Install dependencies

```bash
yarn
```

Compile typescript

```bash
yarn build
```

Lint code

```bash
yarn lint
```

Run the tests

```bash
yarn test
```
