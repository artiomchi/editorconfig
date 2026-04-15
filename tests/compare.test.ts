import { vi, describe, it, expect } from 'vitest';
import { compareConfigs } from '../src/compare.js';

vi.mock('fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('fs/promises') as unknown as { readFile: ReturnType<typeof vi.fn> };

describe('compareConfigs', () => {
  it('reports in-sync when content matches (normalized)', async () => {
    readFile.mockResolvedValueOnce('root = true\n');
    const result = await compareConfigs('.editorconfig', 'root = true\n');
    expect(result.inSync).toBe(true);
    expect(result.unifiedDiff).toBe('');
    expect(result.localFileExists).toBe(true);
  });

  it('reports in-sync when only trailing newline differs', async () => {
    readFile.mockResolvedValueOnce('root = true\n\n');
    const result = await compareConfigs('.editorconfig', 'root = true');
    expect(result.inSync).toBe(true);
  });

  it('reports in-sync when CRLF vs LF only difference', async () => {
    readFile.mockResolvedValueOnce('root = true\r\n');
    const result = await compareConfigs('.editorconfig', 'root = true\n');
    expect(result.inSync).toBe(true);
  });

  it('reports drift when content differs', async () => {
    readFile.mockResolvedValueOnce('root = false\n');
    const result = await compareConfigs('.editorconfig', 'root = true\n');
    expect(result.inSync).toBe(false);
    expect(result.unifiedDiff).toContain('-root = false');
    expect(result.unifiedDiff).toContain('+root = true');
  });

  it('reports not exists when file missing (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    readFile.mockRejectedValueOnce(err);
    const result = await compareConfigs('.editorconfig', 'root = true\n');
    expect(result.localFileExists).toBe(false);
    expect(result.inSync).toBe(false);
    expect(result.localContent).toBe('');
  });

  it('rethrows non-ENOENT errors', async () => {
    const err = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    readFile.mockRejectedValueOnce(err);
    await expect(compareConfigs('.editorconfig', 'x')).rejects.toThrow('Permission denied');
  });

  it('returns correct localLineCount', async () => {
    readFile.mockResolvedValueOnce('a\nb\nc\n');
    const result = await compareConfigs('.editorconfig', 'a\nb\nc\n');
    expect(result.localLineCount).toBe(4);
  });
});
