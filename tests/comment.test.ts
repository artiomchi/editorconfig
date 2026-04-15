import { describe, it, expect } from 'vitest';
import {
  MARKER,
  CTA_START,
  CTA_END,
  buildDriftBody,
  buildInSyncBody,
  buildFixedBody,
} from '../src/comment.js';
import type { Inputs, CompareResult } from '../src/types.js';

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

describe('buildDriftBody', () => {
  it('includes the bot marker', () => {
    const body = buildDriftBody(makeInputs(), makeCompare(), false);
    expect(body).toContain(MARKER);
  });

  it('includes label CTA by default', () => {
    const body = buildDriftBody(makeInputs(), makeCompare(), false);
    expect(body).toContain('fix-editorconfig');
    expect(body).toContain(CTA_START);
    expect(body).toContain(CTA_END);
  });

  it('includes checkbox CTA when fix-trigger is checkbox', () => {
    const body = buildDriftBody(makeInputs({ fixTrigger: 'checkbox' }), makeCompare(), false);
    expect(body).toContain('- [ ]');
  });

  it('includes auto-fix CTA when autoFix is true', () => {
    const body = buildDriftBody(makeInputs({ autoFix: true }), makeCompare(), false);
    expect(body).toContain('automatically fixed');
  });

  it('shows fork message and no CTA on fork', () => {
    const body = buildDriftBody(makeInputs(), makeCompare(), true);
    expect(body).toContain('fork');
    expect(body).not.toContain('- [ ]');
    expect(body).not.toContain('label');
  });

  it('includes diff block when drift present', () => {
    const body = buildDriftBody(makeInputs(), makeCompare(), false);
    expect(body).toContain('<details>');
    expect(body).toContain('```diff');
  });

  it('omits diff block when no diff', () => {
    const body = buildDriftBody(makeInputs(), makeCompare({ unifiedDiff: '' }), false);
    expect(body).not.toContain('<details>');
  });
});

describe('buildInSyncBody', () => {
  it('includes marker and up-to-date message', () => {
    const body = buildInSyncBody('.editorconfig');
    expect(body).toContain(MARKER);
    expect(body).toContain('up to date');
    expect(body).toContain('.editorconfig');
  });
});

describe('buildFixedBody', () => {
  it('replaces CTA section with fix message', () => {
    const original = `${MARKER}\nSome heading\n\n${CTA_START}\nAdd the label\n${CTA_END}\n`;
    const fixed = buildFixedBody(original, 'abc1234', 'https://github.com/x/y/commit/abc1234');
    expect(fixed).toContain('abc1234');
    expect(fixed).not.toContain('Add the label');
    expect(fixed).toContain('Some heading');
  });

  it('appends fix message when CTA markers not found', () => {
    const original = `${MARKER}\nSome heading\n`;
    const fixed = buildFixedBody(original, 'abc1234', 'https://example.com/commit');
    expect(fixed).toContain('abc1234');
    expect(fixed).toContain('Some heading');
  });
});
