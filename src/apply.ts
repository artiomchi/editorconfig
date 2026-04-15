import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { updateCommentWithFix } from './comment.js';

type OctokitInstance = ReturnType<typeof github.getOctokit>;

export interface ApplyResult {
  shortSha: string;
  commitUrl: string;
}

export async function applyFix(
  localPath: string,
  remoteContent: string,
): Promise<ApplyResult> {
  await writeFile(localPath, remoteContent, 'utf8');
  core.debug(`Written remote content to ${localPath}`);

  execSync('git config user.name "github-actions[bot]"', { stdio: 'inherit' });
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { stdio: 'inherit' });
  execSync(`git add "${localPath}"`, { stdio: 'inherit' });
  execSync('git commit -m "chore: sync .editorconfig from editorconfig.build"', { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });

  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const shortSha = sha.slice(0, 7);

  const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : '';
  const commitUrl = repoUrl ? `${repoUrl}/commit/${sha}` : sha;

  core.info(`Committed fix: ${shortSha}`);
  return { shortSha, commitUrl };
}

export async function applyAndUpdateComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
  localPath: string,
  remoteContent: string,
): Promise<void> {
  const { shortSha, commitUrl } = await applyFix(localPath, remoteContent);
  await updateCommentWithFix(octokit, owner, repo, prNumber, shortSha, commitUrl);
}

export async function checkoutPrHead(headRef: string): Promise<void> {
  core.debug(`Checking out PR head branch: ${headRef}`);
  execSync(`git fetch origin "${headRef}"`, { stdio: 'inherit' });
  execSync(`git checkout "${headRef}"`, { stdio: 'inherit' });
}

export async function removePrLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number,
  label: string,
): Promise<void> {
  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: prNumber,
      name: label,
    });
    core.debug(`Removed label "${label}" from PR #${prNumber}`);
  } catch (err: unknown) {
    // 404 means the label was already removed — ignore
    const status = (err as { status?: number }).status;
    if (status !== 404) throw err;
  }
}
