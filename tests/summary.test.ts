import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildDriftSummary,
  buildFixedSummary,
  buildInSyncSummary,
  writeSummary,
} from '../src/summary.js';
import type { Inputs, CompareResult } from '../src/types.js';

function makeInputs(overrides: Partial<Inputs> = {}): Inputs {
  return {
    token: 'tok',
    tag: undefined,
    path: '.editorconfig',
    autoFix: false,
    failOnDrift: true,
    prComment: true,
    jobSummary: true,
    fixTrigger: 'label',
    fixLabel: 'fix-editorconfig',
    reportStatus: true,
    githubToken: 'ghtoken',
    ...overrides,
  };
}

function makeCompare(overrides: Partial<CompareResult> = {}): CompareResult {
  return {
    inSync: false,
    localContent: '',
    remoteContent: 'root = true\n',
    localLineCount: 0,
    localFileExists: false,
    unifiedDiff: '--- a\n+++ b\n@@ -0,0 +1 @@\n+root = true\n',
    ...overrides,
  };
}

describe('buildInSyncSummary', () => {
  it('includes the path and an up-to-date message', () => {
    const body = buildInSyncSummary('.editorconfig');
    expect(body).toContain('.editorconfig');
    expect(body).toContain('in sync');
  });
});

describe('buildFixedSummary', () => {
  it('includes the path, short sha, and commit link', () => {
    const body = buildFixedSummary('.editorconfig', 'abc1234', 'https://github.com/x/y/commit/abc1234');
    expect(body).toContain('.editorconfig');
    expect(body).toContain('abc1234');
    expect(body).toContain('https://github.com/x/y/commit/abc1234');
  });
});

describe('buildDriftSummary', () => {
  it('includes the diff block when drift present', () => {
    const body = buildDriftSummary(makeInputs(), makeCompare(), false, 1);
    expect(body).toContain('<details>');
    expect(body).toContain('```diff');
  });

  it('omits the diff block when no diff', () => {
    const body = buildDriftSummary(makeInputs(), makeCompare({ unifiedDiff: '' }), false, 1);
    expect(body).not.toContain('<details>');
  });

  it('mentions the fix label when fix-trigger is label and a PR is open', () => {
    const body = buildDriftSummary(makeInputs(), makeCompare(), false, 1);
    expect(body).toContain('fix-editorconfig');
  });

  it('mentions the checkbox when fix-trigger is checkbox and a PR is open', () => {
    const body = buildDriftSummary(makeInputs({ fixTrigger: 'checkbox' }), makeCompare(), false, 1);
    expect(body).toContain('checkbox');
  });

  it('mentions auto-fix when autoFix is true', () => {
    const body = buildDriftSummary(makeInputs({ autoFix: true }), makeCompare(), false, 1);
    expect(body).toContain('automatically fixed');
  });

  it('mentions the fork when isFork is true', () => {
    const body = buildDriftSummary(makeInputs(), makeCompare(), true, 1);
    expect(body).toContain('fork');
  });

  it('prompts a manual update when there is no open PR', () => {
    const body = buildDriftSummary(makeInputs(), makeCompare(), false, undefined);
    expect(body).toContain('manually');
    expect(body).not.toContain('fix-editorconfig');
  });
});

describe('writeSummary', () => {
  let dir: string | undefined;
  const originalEnv = process.env.GITHUB_STEP_SUMMARY;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
    if (originalEnv === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = originalEnv;
  });

  // Runs first: @actions/core's `summary` export is a module-level singleton that
  // caches its resolved file path after the first successful write, so this must
  // run before any test gives it a path to cache.
  it('does not throw when $GITHUB_STEP_SUMMARY is not set', async () => {
    delete process.env.GITHUB_STEP_SUMMARY;
    await expect(writeSummary('## hello')).resolves.not.toThrow();
  });

  it('appends the body to the file at $GITHUB_STEP_SUMMARY', async () => {
    dir = await mkdtemp(join(tmpdir(), 'editorconfig-summary-'));
    const summaryPath = join(dir, 'summary.md');
    await writeFile(summaryPath, '', 'utf8');
    process.env.GITHUB_STEP_SUMMARY = summaryPath;

    await writeSummary('## hello\n\nworld');

    const content = await readFile(summaryPath, 'utf8');
    expect(content).toContain('## hello');
    expect(content).toContain('world');
  });
});
