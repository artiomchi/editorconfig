import * as core from '@actions/core';
import type { CompareResult, Inputs } from './types.js';

export function buildInSyncSummary(path: string): string {
  return `## ✅ \`${path}\` is in sync

No drift detected — your \`${path}\` matches the current [editorconfig.build](https://editorconfig.build) config.`;
}

export function buildFixedSummary(path: string, shortSha: string, commitUrl: string): string {
  return `## ✅ \`${path}\` fixed

Automatically synced \`${path}\` with editorconfig.build in commit [\`${shortSha}\`](${commitUrl}).`;
}

export function buildDriftSummary(
  inputs: Inputs,
  compare: CompareResult,
  isFork: boolean,
  prNumber: number | undefined,
): string {
  const { path, autoFix, fixTrigger, fixLabel } = inputs;

  let actionSection: string;
  if (isFork) {
    actionSection = `This PR is from a fork — the file cannot be updated automatically. Please update \`${path}\` manually.`;
  } else if (autoFix) {
    actionSection = 'The file will be automatically fixed.';
  } else if (prNumber) {
    actionSection = fixTrigger === 'label'
      ? `Add the \`${fixLabel}\` label to the PR to have the action fix it for you.`
      : 'Tick the checkbox in the PR comment to have the action fix it for you.';
  } else {
    actionSection = `Update \`${path}\` manually to match editorconfig.build, or enable \`auto-fix\`.`;
  }

  const diffBlock = compare.unifiedDiff
    ? `\n\n<details>\n<summary>Diff</summary>\n\n\`\`\`diff\n${compare.unifiedDiff}\`\`\`\n\n</details>`
    : '';

  return `## ⚠️ \`${path}\` is out of sync

The \`${path}\` in this run differs from the project's current config on [editorconfig.build](https://editorconfig.build).${diffBlock}

${actionSection}`;
}

export async function writeSummary(body: string): Promise<void> {
  try {
    await core.summary.addRaw(body, true).write();
  } catch (err: unknown) {
    core.debug(`Could not write job summary: ${(err as Error).message}`);
  }
}
