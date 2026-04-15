import { createHash } from 'crypto';
import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context.js';
import { fetchProjectConfig } from './fetch.js';
import type { CompareResult, Inputs } from './types.js';

const REPORT_URL = 'https://editorconfig.build/api/v1/report';

function normalizeForChecksum(content: string): string {
  return content.replace(/\r/g, '').replace(/\s+$/, '');
}

function checksumOf(content: string): string {
  const normalized = normalizeForChecksum(content);
  return 'sha256:' + createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export async function reportStatus(
  inputs: Inputs,
  context: Context,
  compare: CompareResult,
): Promise<void> {
  if (!inputs.reportStatus) return;
  if (context.eventName !== 'push') return;

  let config;
  try {
    config = await fetchProjectConfig(inputs.token);
  } catch (err: unknown) {
    core.warning(`Could not fetch project config for reporting: ${(err as Error).message}`);
    return;
  }

  const reporting = config?.reporting ?? {};
  if (!reporting.enabled) {
    core.debug('Reporting disabled by project config (reporting.enabled is not true)');
    return;
  }

  const defaultBranch = (context.payload.repository as { default_branch?: string } | undefined)?.default_branch;
  const onDefaultBranch = context.ref === `refs/heads/${defaultBranch}`;
  if (!reporting.allBranches && !onDefaultBranch) {
    core.debug(`Skipping report: not on default branch (${defaultBranch}) and allBranches is not enabled`);
    return;
  }

  const [owner, repoName] = (context.payload.repository as { full_name?: string } | undefined)?.full_name?.split('/') ?? ['', ''];
  const repository = `${owner}/${repoName}`;
  const branch = context.ref.replace('refs/heads/', '');
  const inSync = compare.inSync;
  const checksum = compare.localFileExists ? checksumOf(compare.localContent) : undefined;

  const payload: Record<string, string | undefined | boolean> = {
    repository,
    branch,
    inSync,
    tag: inputs.tag,
    checksum,
  };
  // Remove undefined fields
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  try {
    const res = await fetch(REPORT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inputs.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      core.warning('Report endpoint rejected the token (HTTP 401)');
    } else if (!res.ok) {
      core.warning(`Report failed (HTTP ${res.status})`);
    } else {
      core.debug(`Reported status "${inSync ? 'in sync' : 'out of sync'}" for ${repository}@${branch}`);
    }
  } catch (err: unknown) {
    core.warning(`Report request failed: ${(err as Error).message}`);
  }
}
