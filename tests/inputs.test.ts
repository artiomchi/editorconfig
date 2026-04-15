import * as core from '@actions/core';
import { parseInputs } from '../src/inputs.js';

jest.mock('@actions/core');

const mockGetInput = jest.mocked(core.getInput);

function setupInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    token: 'test-token',
    tag: '',
    path: '',
    'auto-fix': '',
    'fail-on-drift': '',
    'pr-comment': '',
    'fix-trigger': '',
    'fix-label': '',
    'report-status': '',
    'github-token': '',
  };
  const merged = { ...defaults, ...overrides };
  mockGetInput.mockImplementation((name: string) => merged[name] ?? '');
}

describe('parseInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns defaults when only token is provided', () => {
    setupInputs({ token: 'abc123' });
    const inputs = parseInputs();
    expect(inputs.token).toBe('abc123');
    expect(inputs.tag).toBeUndefined();
    expect(inputs.path).toBe('.editorconfig');
    expect(inputs.autoFix).toBe(false);
    expect(inputs.failOnDrift).toBe(true);
    expect(inputs.prComment).toBe(true);
    expect(inputs.fixTrigger).toBe('label');
    expect(inputs.fixLabel).toBe('fix-editorconfig');
    expect(inputs.reportStatus).toBe(true);
  });

  it('parses tag when provided', () => {
    setupInputs({ token: 'abc', tag: 'v2' });
    expect(parseInputs().tag).toBe('v2');
  });

  it('returns undefined tag when empty', () => {
    setupInputs({ token: 'abc', tag: '' });
    expect(parseInputs().tag).toBeUndefined();
  });

  it('parses auto-fix true', () => {
    setupInputs({ token: 'abc', 'auto-fix': 'true' });
    expect(parseInputs().autoFix).toBe(true);
  });

  it('parses fail-on-drift false', () => {
    setupInputs({ token: 'abc', 'fail-on-drift': 'false' });
    expect(parseInputs().failOnDrift).toBe(false);
  });

  it('parses pr-comment false', () => {
    setupInputs({ token: 'abc', 'pr-comment': 'false' });
    expect(parseInputs().prComment).toBe(false);
  });

  it('parses fix-trigger checkbox', () => {
    setupInputs({ token: 'abc', 'fix-trigger': 'checkbox' });
    expect(parseInputs().fixTrigger).toBe('checkbox');
  });

  it('throws on invalid fix-trigger', () => {
    setupInputs({ token: 'abc', 'fix-trigger': 'banana' });
    expect(() => parseInputs()).toThrow(/Invalid fix-trigger/);
  });

  it('parses custom fix-label', () => {
    setupInputs({ token: 'abc', 'fix-label': 'my-label' });
    expect(parseInputs().fixLabel).toBe('my-label');
  });

  it('parses report-status false', () => {
    setupInputs({ token: 'abc', 'report-status': 'false' });
    expect(parseInputs().reportStatus).toBe(false);
  });
});
