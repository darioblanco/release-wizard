import { setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';

import { bumpVersion, retrieveLastReleasedVersion } from '@darioblanco/release-wizard/lib/version';
import { VersionType } from '@darioblanco/release-wizard/types';

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
jest.mock('@actions/core');

interface ReleaseFixture {
  data: { prerelease: boolean; draft: boolean; tag_name: string }[];
}

describe('version', () => {
  const token = 'fake';
  const tagPrefix = 'myprefix@';
  const releaseResponseFixture = [
    {
      data: [
        { prerelease: true, draft: true, tag_name: `${tagPrefix}0.0.4` }, // Latest version
        { prerelease: false, draft: false, tag_name: 'fake-prefix-0.0.3' },
        { prerelease: false, draft: false, tag_name: '0.0.3' },
      ],
    },
    {
      data: [
        { prerelease: true, draft: true, tag_name: `${tagPrefix}0.0.3` },
        { prerelease: true, draft: false, tag_name: `${tagPrefix}0.0.2` },
        { prerelease: false, draft: false, tag_name: `${tagPrefix}0.0.1` }, // Production release
      ],
    },
  ];

  const mockGithub = (fixture: ReleaseFixture[]): void => {
    const listReleasesMock = jest.fn(() => 'iterator-options');
    const listReleasesIteratorMock = jest.fn(() => fixture);
    (getOctokit as jest.Mock).mockReturnValue({
      paginate: { iterator: listReleasesIteratorMock },
      rest: { repos: { listReleases: { endpoint: { merge: listReleasesMock } } } },
    });
  };

  beforeEach(jest.restoreAllMocks);

  describe('bump version', () => {
    [
      [VersionType.patch, '0.0.1'],
      [VersionType.minor, '0.1.0'],
      [VersionType.major, '1.0.0'],
      [VersionType.prerelease, '0.0.1-rc.0'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`bump ${versionType} when there is no last and published tags`, async () => {
        const expectedTag = `${tagPrefix}${expectedVersion}`;
        mockGithub([{ data: [] }]);
        expect(await bumpVersion(token, tagPrefix, versionType as VersionType)).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', '');
        expect(setOutput).toBeCalledWith('previous_version', '0.0.0');
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith('release_type', versionType);
      });
    });

    [
      [VersionType.patch, '0.1.5'],
      [VersionType.minor, '0.2.0'],
      [VersionType.major, '1.0.0'],
      [VersionType.prerelease, '0.1.5-rc.0'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`bump ${versionType} when there is a last tag but no published tags`, async () => {
        const expectedTag = `${tagPrefix}${expectedVersion}`;
        const previousVersion = `0.1.4`;
        const previousTag = `${tagPrefix}${previousVersion}`;
        mockGithub([
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'fake-prefix@0.0.3' },
              { prerelease: false, draft: false, tag_name: '0.0.3' },
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.3' },
            ],
          },
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.2' },
              { prerelease: true, draft: true, tag_name: previousTag }, // Latest version
              { prerelease: true, draft: true, tag_name: `${tagPrefix}0.1.3` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.2` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.1` },
            ],
          },
        ]);
        expect(await bumpVersion(token, tagPrefix, versionType as VersionType)).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', previousTag);
        expect(setOutput).toBeCalledWith('previous_version', previousVersion);
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith('release_type', versionType);
      });
    });

    [
      [VersionType.patch, '0.1.5'],
      [VersionType.minor, '0.2.0'],
      [VersionType.major, '1.0.0'],
      [VersionType.prerelease, '0.1.5-rc.0'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`bump ${versionType} when there is a last and published tags`, async () => {
        const publishedTag = `${tagPrefix}0.1.1`;
        const expectedTag = `${tagPrefix}${expectedVersion}`;
        const previousVersion = `0.1.4`;
        const previousTag = `${tagPrefix}${previousVersion}`;
        mockGithub([
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'fake-prefix@0.0.3' },
              { prerelease: false, draft: false, tag_name: '0.0.3' },
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.3' },
            ],
          },
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.2' },
              { prerelease: true, draft: true, tag_name: previousTag }, // Latest version
              { prerelease: true, draft: true, tag_name: `${tagPrefix}0.1.3` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.2` },
            ],
          },
        ]);
        expect(await bumpVersion(token, tagPrefix, versionType as VersionType, publishedTag)).toBe(
          expectedTag,
        );
        expect(setOutput).toBeCalledWith('previous_tag', previousTag);
        expect(setOutput).toBeCalledWith('previous_version', previousVersion);
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith('release_type', versionType);
      });
    });

    [
      [VersionType.patch, '0.1.3'],
      [VersionType.minor, '0.2.0'],
      [VersionType.major, '1.0.0'],
      [VersionType.prerelease, '0.1.3-rc.4'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`bump ${versionType} when there is a last prerelease tag`, async () => {
        const expectedTag = `${tagPrefix}${expectedVersion}`;
        const previousVersion = `0.1.3-rc.3`;
        const previousTag = `${tagPrefix}${previousVersion}`;
        mockGithub([
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'fake-prefix@0.0.3' },
              { prerelease: false, draft: false, tag_name: '0.0.3' },
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.3' },
            ],
          },
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.2' },
              { prerelease: true, draft: true, tag_name: previousTag }, // Latest version
              { prerelease: true, draft: true, tag_name: `${tagPrefix}0.1.3-rc.1` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.3-rc.2` },
            ],
          },
        ]);
        expect(await bumpVersion(token, tagPrefix, versionType as VersionType)).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', previousTag);
        expect(setOutput).toBeCalledWith('previous_version', previousVersion);
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith('release_type', versionType);
      });
    });

    [
      [VersionType.minor, '0.2.5'],
      [VersionType.major, '1.0.0'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`force bump to patch for minor when there are minor between prod diffs`, async () => {
        const publishedTag = `${tagPrefix}0.1.1`;
        const expectedTag = `${tagPrefix}${expectedVersion}`;
        const previousVersion = `0.2.4`;
        const previousTag = `${tagPrefix}${previousVersion}`;
        mockGithub([
          {
            data: [
              { prerelease: true, draft: true, tag_name: previousTag }, // Latest version
              { prerelease: true, draft: true, tag_name: `${tagPrefix}0.2.3` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.2.2` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.2.1` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.2.0` },
            ],
          },
          {
            data: [
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.4` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.3` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.2` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.1` }, // Prod
            ],
          },
        ]);
        expect(
          await bumpVersion(token, tagPrefix, versionType as VersionType, publishedTag, true),
        ).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', previousTag);
        expect(setOutput).toBeCalledWith('previous_version', previousVersion);
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith(
          'release_type',
          versionType === VersionType.minor ? VersionType.patch : versionType,
        );
      });
    });

    [
      [VersionType.minor, '1.0.7'],
      [VersionType.major, '1.0.7'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`force bump to patch for major when there are major between prod diffs`, async () => {
        const publishedTag = `${tagPrefix}0.1.1`;
        const expectedTag = `${tagPrefix}${expectedVersion}`;
        const previousVersion = `1.0.6`;
        const previousTag = `${tagPrefix}${previousVersion}`;
        mockGithub([
          {
            data: [
              { prerelease: true, draft: true, tag_name: previousTag }, // Latest version
              { prerelease: true, draft: true, tag_name: `${tagPrefix}1.0.5` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}1.0.4` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}1.0.3` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}1.0.2` },
            ],
          },
          {
            data: [
              { prerelease: true, draft: false, tag_name: `${tagPrefix}1.0.1` },
              { prerelease: true, draft: false, tag_name: `${tagPrefix}1.0.0` }, // MAJOR
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.2.0` }, // MINOR
              { prerelease: true, draft: false, tag_name: `${tagPrefix}0.1.1` }, // Prod
            ],
          },
        ]);
        expect(
          await bumpVersion(token, tagPrefix, versionType as VersionType, publishedTag, true),
        ).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', previousTag);
        expect(setOutput).toBeCalledWith('previous_version', previousVersion);
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith('release_type', VersionType.patch);
      });
    });

    test('throw error when version cannot be bumped', async () => {
      mockGithub([
        {
          data: [{ prerelease: true, draft: true, tag_name: `${tagPrefix}1.fake.2` }],
        },
      ]);
      await expect(bumpVersion(token, tagPrefix)).rejects.toThrowError(
        new Error('Unable to perform a patch bump to version 1.fake.2'),
      );
      expect(setOutput).not.toBeCalled();
    });
  });

  test('retrieve last published release', async () => {
    const expectedTag = `${tagPrefix}0.0.1`;
    mockGithub(releaseResponseFixture);

    expect(await retrieveLastReleasedVersion(token, tagPrefix)).toBe(expectedTag);
    expect(setOutput).toBeCalledWith('base_tag', expectedTag);
  });

  test('retrieve no release gives current ref', async () => {
    const releaseFixtureOverride = [
      {
        data: [{ prerelease: true, draft: true, tag_name: `${tagPrefix}0.0.4` }],
      },
      {
        data: [
          { prerelease: true, draft: false, tag_name: `${tagPrefix}0.0.2` },
          { prerelease: false, draft: true, tag_name: `${tagPrefix}0.0.1` },
        ],
      },
    ];

    mockGithub(releaseFixtureOverride);

    expect(await retrieveLastReleasedVersion(token, tagPrefix)).toBe('main');
    expect(setOutput).toBeCalledWith('base_tag', 'main');
  });
});
