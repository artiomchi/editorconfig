import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({ writeFile: vi.fn() }));
vi.mock('child_process', () => ({ execSync: vi.fn() }));

const { writeFile: mockWriteFile } = await import('fs/promises') as unknown as { writeFile: ReturnType<typeof vi.fn> };
const { execSync: mockExecSync } = await import('child_process') as unknown as { execSync: ReturnType<typeof vi.fn> };

describe('applyFix', () => {
  beforeEach(() => {
    mockWriteFile.mockResolvedValue(undefined);
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('rev-parse HEAD')) return 'abcdef1234567890\n';
      return '';
    });
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
  });

  it('writes the file, commits, and returns short sha', async () => {
    const { applyFix } = await import('../src/apply.js');
    const result = await applyFix('.editorconfig', 'root = true\n');
    expect(mockWriteFile).toHaveBeenCalledWith('.editorconfig', 'root = true\n', 'utf8');
    expect(result.shortSha).toBe('abcdef1');
    expect(result.commitUrl).toContain('abcdef1234567890');
  });
});

describe('removePrLabel', () => {
  it('calls removeLabel API', async () => {
    const mockRemoveLabel = vi.fn().mockResolvedValue({});
    const octokit = { rest: { issues: { removeLabel: mockRemoveLabel } } } as unknown as Parameters<typeof import('../src/apply.js').removePrLabel>[0];
    const { removePrLabel } = await import('../src/apply.js');
    await removePrLabel(octokit, 'owner', 'repo', 1, 'fix-editorconfig');
    expect(mockRemoveLabel).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', issue_number: 1, name: 'fix-editorconfig' });
  });

  it('ignores 404 when label already removed', async () => {
    const err = Object.assign(new Error('Not found'), { status: 404 });
    const mockRemoveLabel = vi.fn().mockRejectedValue(err);
    const octokit = { rest: { issues: { removeLabel: mockRemoveLabel } } } as unknown as Parameters<typeof import('../src/apply.js').removePrLabel>[0];
    const { removePrLabel } = await import('../src/apply.js');
    await expect(removePrLabel(octokit, 'owner', 'repo', 1, 'fix-editorconfig')).resolves.not.toThrow();
  });
});
