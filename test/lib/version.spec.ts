import { setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';

import { bumpVersion, retrieveLastReleasedVersion } from '@/lib/version';
import { VersionType } from '@/types';

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
        { prerelease: false, draft: true, tag_name: `${tagPrefix}0.0.4` }, // Latest version draft
        { prerelease: false, draft: false, tag_name: 'fake-prefix-0.0.3' },
        { prerelease: false, draft: false, tag_name: 'another-app@0.0.3' },
      ],
    },
    {
      data: [
        { prerelease: true, draft: false, tag_name: `${tagPrefix}0.0.3` },
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
      rest: {
        repos: { listReleases: { endpoint: { merge: listReleasesMock } } },
      },
    });
  };

  beforeEach(jest.restoreAllMocks);

  describe('bump version', () => {
    [
      [undefined, '0.0.1'], // Patch by default
      [VersionType.minor, '0.1.0'],
      [VersionType.major, '1.0.0'],
      [VersionType.prerelease, '0.0.1-rc.0'],
    ].forEach(([versionType, expectedVersion]) => {
      test(`bump ${
        versionType || 'patch'
      } when there is no last and published tags`, async () => {
        const expectedTag = `${tagPrefix}${expectedVersion as string}`;
        mockGithub([{ data: [] }]);
        expect(
          await bumpVersion(token, tagPrefix, versionType as VersionType)
        ).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', `${tagPrefix}0.0.0`);
        expect(setOutput).toBeCalledWith('previous_version', '0.0.0');
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith(
          'release_type',
          versionType ? versionType : VersionType.patch
        );
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
              {
                prerelease: false,
                draft: false,
                tag_name: 'fake-prefix@0.0.3',
              },
              { prerelease: false, draft: true, tag_name: '${tagPrefix}0.1.4' }, // Draft
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.3' },
            ],
          },
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.2' },
              { prerelease: false, draft: false, tag_name: previousTag }, // Latest version
              {
                prerelease: false,
                draft: false,
                tag_name: `${tagPrefix}0.1.3`,
              },
              {
                prerelease: false,
                draft: false,
                tag_name: `${tagPrefix}0.1.2`,
              },
              {
                prerelease: false,
                draft: false,
                tag_name: `${tagPrefix}0.1.1`,
              },
            ],
          },
        ]);
        expect(
          await bumpVersion(token, tagPrefix, versionType as VersionType)
        ).toBe(expectedTag);
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
              {
                prerelease: false,
                draft: false,
                tag_name: 'fake-prefix@0.0.3',
              },
              { prerelease: false, draft: false, tag_name: '0.0.3' },
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.3' },
            ],
          },
          {
            data: [
              { prerelease: false, draft: false, tag_name: 'other-app@0.0.2' },
              { prerelease: false, draft: false, tag_name: previousTag }, // Latest version
              {
                prerelease: true,
                draft: false,
                tag_name: `${tagPrefix}0.1.3-rc.1`,
              },
              {
                prerelease: true,
                draft: false,
                tag_name: `${tagPrefix}0.1.3-rc.2`,
              },
            ],
          },
        ]);
        expect(
          await bumpVersion(token, tagPrefix, versionType as VersionType)
        ).toBe(expectedTag);
        expect(setOutput).toBeCalledWith('previous_tag', previousTag);
        expect(setOutput).toBeCalledWith('previous_version', previousVersion);
        expect(setOutput).toBeCalledWith('new_tag', expectedTag);
        expect(setOutput).toBeCalledWith('new_version', expectedVersion);
        expect(setOutput).toBeCalledWith('release_type', versionType);
      });
    });
  });

  test('retrieve last published release', async () => {
    const expectedTag = `${tagPrefix}0.0.1`;
    mockGithub(releaseResponseFixture);

    expect(await retrieveLastReleasedVersion(token, tagPrefix)).toBe(
      expectedTag
    );
  });

  test('retrieve no release', async () => {
    const releaseFixtureOverride = [
      {
        data: [
          { prerelease: true, draft: true, tag_name: `${tagPrefix}0.0.4` },
        ],
      },
      {
        data: [
          { prerelease: true, draft: false, tag_name: `${tagPrefix}0.0.2` },
          { prerelease: false, draft: true, tag_name: `${tagPrefix}0.0.1` },
        ],
      },
    ];

    mockGithub(releaseFixtureOverride);

    expect(await retrieveLastReleasedVersion(token, tagPrefix)).toBe(undefined);
  });
});
