import * as core from '@actions/core';
import type { Inputs } from './types.js';

function getBool(name: string, defaultValue: boolean): boolean {
  const val = core.getInput(name);
  if (val === '') return defaultValue;
  return val.toLowerCase() === 'true';
}

export function parseInputs(): Inputs {
  const token = core.getInput('token', { required: true });

  const tagRaw = core.getInput('tag');
  const tag = tagRaw === '' ? undefined : tagRaw;

  const path = core.getInput('path') || '.editorconfig';

  const autoFix = getBool('auto-fix', false);
  const failOnDrift = getBool('fail-on-drift', true);
  const prComment = getBool('pr-comment', true);
  const reportStatus = getBool('report-status', true);

  const fixTriggerRaw = core.getInput('fix-trigger') || 'label';
  if (fixTriggerRaw !== 'label' && fixTriggerRaw !== 'checkbox') {
    throw new Error(`Invalid fix-trigger value: "${fixTriggerRaw}". Must be "label" or "checkbox".`);
  }
  const fixTrigger = fixTriggerRaw as 'label' | 'checkbox';

  const fixLabel = core.getInput('fix-label') || 'fix-editorconfig';

  const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';

  return { token, tag, path, autoFix, failOnDrift, prComment, fixTrigger, fixLabel, reportStatus, githubToken };
}
