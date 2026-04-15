import * as core from '@actions/core';
import * as github from '@actions/github';
import type { CompareResult, Inputs } from './types.js';

type OctokitInstance = ReturnType<typeof github.getOctokit>;

const MARKER = '<!-- editorconfig-build-bot -->';
const CTA_START = '<!-- cta:start -->';
const CTA_END = '<!-- cta:end -->';

function buildDriftBody(inputs: Inputs, compare: CompareResult, isFork: boolean): string {
  const { path, autoFix, prComment: _prComment, fixTrigger, fixLabel } = inputs;

  let ctaSection = '';
  if (!isFork) {
    if (autoFix) {
      ctaSection = `${CTA_START}\n> The file has been automatically fixed.\n${CTA_END}`;
    } else if (fixTrigger === 'label') {
      ctaSection = `${CTA_START}\nAdd the \`${fixLabel}\` label to this PR to have the action fix it for you.\n${CTA_END}`;
    } else {
      ctaSection = `${CTA_START}\n- [ ] Apply on next run\n${CTA_END}`;
    }
  } else {
    ctaSection = `${CTA_START}\n> This PR is from a fork. The file cannot be updated automatically — please update \`${path}\` manually.\n${CTA_END}`;
  }

  const diffBlock = compare.unifiedDiff
    ? `\n<details>\n<summary>Diff</summary>\n\n\`\`\`diff\n${compare.unifiedDiff}\`\`\`\n\n</details>`
    : '';

  return `${MARKER}
## \`${path}\` is out of sync with editorconfig.build

The \`${path}\` in this PR differs from the project's current config on [editorconfig.build](https://editorconfig.build).${diffBlock}

${ctaSection}`;
}

function buildInSyncBody(path: string): string {
  return `${MARKER}
## \`${path}\` is up to date

No drift detected — your \`${path}\` matches the current [editorconfig.build](https://editorconfig.build) config.`;
}

function buildFixedBody(existingBody: string, shortSha: string, commitUrl: string): string {
  const replacement = `${CTA_START}\n✅ Fixed in [${shortSha}](${commitUrl})\n${CTA_END}`;
  const start = existingBody.indexOf(CTA_START);
  const end = existingBody.indexOf(CTA_END);
  if (start === -1 || end === -1) {
    return existingBody + `\n\n${replacement}`;
  }
  return existingBody.slice(0, start) + replacement + existingBody.slice(end + CTA_END.length);
}

async function findExistingComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<{ id: number; body: string } | undefined> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });
  const found = comments.find((c: { body?: string | null }) => (c.body ?? '').includes(MARKER));
  if (!found) return undefined;
  return { id: found.id, body: found.body ?? '' };
}

export async function upsertComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  const existing = await findExistingComment(octokit, owner, repo, prNumber);
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.debug(`Updated existing bot comment #${existing.id}`);
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    core.debug('Created new bot comment');
  }
}

export async function updateCommentWithFix(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
  shortSha: string,
  commitUrl: string,
): Promise<void> {
  const existing = await findExistingComment(octokit, owner, repo, prNumber);
  if (!existing) {
    core.debug('No existing bot comment found to update with fix result');
    return;
  }
  const newBody = buildFixedBody(existing.body, shortSha, commitUrl);
  await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: existing.id,
    body: newBody,
  });
}

export async function postDriftComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
  inputs: Inputs,
  compare: CompareResult,
  isFork: boolean,
): Promise<void> {
  const body = buildDriftBody(inputs, compare, isFork);
  await upsertComment(octokit, owner, repo, prNumber, body);
}

export async function postInSyncComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
  path: string,
): Promise<void> {
  const existing = await findExistingComment(octokit, owner, repo, prNumber);
  if (!existing) {
    core.debug('No existing bot comment found — skipping in-sync comment');
    return;
  }
  if (!existing.body.includes(CTA_START)) {
    core.debug('Existing bot comment has no CTA — skipping in-sync update');
    return;
  }
  const body = buildInSyncBody(path);
  await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: existing.id,
    body,
  });
  core.debug(`Updated existing bot comment #${existing.id} to in-sync`);
}

export async function hasCheckboxTicked(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<boolean> {
  const existing = await findExistingComment(octokit, owner, repo, prNumber);
  if (!existing) return false;
  return existing.body.includes('- [x]');
}

export { MARKER, CTA_START, CTA_END, buildDriftBody, buildInSyncBody, buildFixedBody };
