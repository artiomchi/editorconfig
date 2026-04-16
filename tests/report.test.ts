import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as core from '@actions/core';

vi.mock('@actions/core');
vi.mock('../src/fetch.js');

import { fetchProjectConfig } from '../src/fetch.js';
import { reportStatus } from '../src/report.js';
import type { Inputs, CompareResult } from '../src/types.js';
import * as github from '@actions/github';

const mockFetchProjectConfig = vi.mocked(fetchProjectConfig);
const mockWarning = vi.mocked(core.warning);
const mockDebug = vi.mocked(core.debug);

const mockFetch = vi.fn();
beforeAll(() => { global.fetch = mockFetch as unknown as typeof fetch; });

function makeInputs(overrides: Partial<Inputs> = {}): Inputs {
  return {
    token: 'tok',
    tag: undefined,
    path: '.editorconfig',
    autoFix: false,
    failOnDrift: true,
    prComment: true,
    fixTrigger: 'label',
    fixLabel: 'fix-editorconfig',
    reportStatus: true,
    githubToken: 'ghtoken',
    ...overrides,
  };
}

function makeCompare(inSync = true): CompareResult {
  return {
    inSync,
    localContent: 'root = true\n',
    remoteContent: 'root = true\n',
    localLineCount: 2,
    localFileExists: true,
    unifiedDiff: '',
  };
}

function makeContext(eventName: string, ref: string, defaultBranch: string) {
  return {
    eventName,
    ref,
    payload: {
      repository: { default_branch: defaultBranch, full_name: 'owner/repo' },
    },
  } as unknown as typeof github.context;
}

describe('reportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when reportStatus is false', async () => {
    await reportStatus(makeInputs({ reportStatus: false }), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockFetchProjectConfig).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns early when event is not push', async () => {
    await reportStatus(makeInputs(), makeContext('pull_request', 'refs/heads/main', 'main'), makeCompare());
    expect(mockFetchProjectConfig).not.toHaveBeenCalled();
  });

  it('warns and returns when fetchProjectConfig throws', async () => {
    mockFetchProjectConfig.mockRejectedValueOnce(new Error('network error'));
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('network error'));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns early when config is null (no config.json)', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce(null);
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('No project config'));
  });

  it('returns early when reporting.enabled is false', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: false } });
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalled();
  });

  it('returns early when not on default branch and allBranches is false', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true, allBranches: false } });
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/feature', 'main'), makeCompare());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends report when on default branch', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true, allBranches: false } });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare(true));
    expect(mockFetch).toHaveBeenCalledWith(
      'https://editorconfig.build/api/v1/report',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.inSync).toBe(true);
    expect(body.repository).toBe('owner/repo');
    expect(body.path).toBe('.editorconfig');
    expect(body.checksum).toMatch(/^sha256:/);
    expect(body.isDefaultBranch).toBe(true);
  });

  it('sends report when allBranches is true (non-default branch)', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true, allBranches: true } });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/feature', 'main'), makeCompare(false));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.inSync).toBe(false);
    expect(body.isDefaultBranch).toBe(false);
  });

  it('warns on 401', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true } });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('401'));
  });

  it('warns on other non-2xx', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true } });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('warns on network error during POST', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true } });
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('omits checksum when file does not exist', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true } });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const compare = makeCompare(false);
    compare.localFileExists = false;
    compare.localContent = '';
    await reportStatus(makeInputs(), makeContext('push', 'refs/heads/main', 'main'), compare);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.checksum).toBeUndefined();
  });

  it('includes custom path in payload', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true } });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await reportStatus(makeInputs({ path: 'configs/.editorconfig' }), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.path).toBe('configs/.editorconfig');
  });

  it('includes tag in payload when provided', async () => {
    mockFetchProjectConfig.mockResolvedValueOnce({ reporting: { enabled: true } });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await reportStatus(makeInputs({ tag: 'v2' }), makeContext('push', 'refs/heads/main', 'main'), makeCompare());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tag).toBe('v2');
  });
});
