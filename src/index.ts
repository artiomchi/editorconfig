import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseInputs } from './inputs.js';
import { fetchRemoteConfig } from './fetch.js';
import { compareConfigs } from './compare.js';
import { reportStatus } from './report.js';
import {
  postDriftComment,
  postInSyncComment,
  hasCheckboxTicked,
} from './comment.js';
import {
  applyFix,
  applyAndUpdateComment,
  checkoutPrHead,
  removePrLabel,
} from './apply.js';

async function run(): Promise<void> {
  const inputs = parseInputs();
  const octokit = github.getOctokit(inputs.githubToken);
  const context = github.context;
  const { owner, repo } = context.repo;

  // ── Resolve PR number ────────────────────────────────────────────────────
  let prNumber: number | undefined = context.payload.pull_request?.number as number | undefined;
  if (!prNumber && context.eventName === 'issue_comment') {
    prNumber = (context.payload.issue as { number?: number } | undefined)?.number;
  }
  if (!prNumber && (context.eventName === 'push' || context.eventName === 'workflow_dispatch')) {
    // No PR in push context — that's expected
  }

  // Determine if this event is a label trigger
  const isLabelTrigger =
    context.eventName === 'pull_request' &&
    context.payload.action === 'labeled' &&
    (context.payload.label as { name?: string } | undefined)?.name === inputs.fixLabel;

  // Determine if this event is a checkbox trigger
  const isCheckboxTrigger = context.eventName === 'issue_comment' && context.payload.action === 'edited';

  // ── Label trigger: apply fix and update comment ──────────────────────────
  if (isLabelTrigger && prNumber) {
    core.info(`Label "${inputs.fixLabel}" applied — applying fix`);
    const headRef = context.payload.pull_request?.head?.ref as string | undefined;
    if (headRef) await checkoutPrHead(headRef);

    const remoteContent = await fetchRemoteConfig(inputs.token, inputs.tag);
    await applyAndUpdateComment(octokit, owner, repo, prNumber, inputs.path, remoteContent);
    await removePrLabel(octokit, owner, repo, prNumber, inputs.fixLabel);
    return;
  }

  // ── Checkbox trigger: check if ticked and apply fix ──────────────────────
  if (isCheckboxTrigger && prNumber && inputs.fixTrigger === 'checkbox') {
    const ticked = await hasCheckboxTicked(octokit, owner, repo, prNumber);
    if (!ticked) return;

    core.info('Checkbox ticked — applying fix');
    // For issue_comment events the checkout is on the base branch; fetch the PR's head
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    await checkoutPrHead(pr.head.ref);

    const remoteContent = await fetchRemoteConfig(inputs.token, inputs.tag);
    await applyAndUpdateComment(octokit, owner, repo, prNumber, inputs.path, remoteContent);
    return;
  }

  // ── Main drift detection flow ────────────────────────────────────────────
  const remoteContent = await fetchRemoteConfig(inputs.token, inputs.tag);
  const compare = await compareConfigs(inputs.path, remoteContent);

  core.setOutput('in-sync', String(compare.inSync));
  core.setOutput('diff', compare.unifiedDiff);

  if (compare.inSync) {
    core.info('.editorconfig is in sync with editorconfig.build');
    if (inputs.prComment && prNumber) {
      await postInSyncComment(octokit, owner, repo, prNumber, inputs.path);
    }
    // Report even when in sync (so the server knows about healthy repos)
    await reportStatus(inputs, context, compare);
    return;
  }

  core.info('.editorconfig is out of sync with editorconfig.build');

  // Report before potentially failing
  await reportStatus(inputs, context, compare);

  const isFork = (context.payload.pull_request?.head?.repo as { fork?: boolean } | undefined)?.fork === true;

  if (inputs.autoFix && !isFork) {
    // Auto-fix: write + commit, then optionally post a comment confirming it
    core.info('auto-fix enabled — applying fix');
    if (prNumber && inputs.prComment) {
      await applyAndUpdateComment(octokit, owner, repo, prNumber, inputs.path, remoteContent);
    } else {
      const { shortSha } = await applyFix(inputs.path, remoteContent);
      core.info(`Applied fix in ${shortSha}`);
    }
  } else if (inputs.prComment && prNumber) {
    // Post drift comment (with label/checkbox CTA or fork-only read-only message)
    await postDriftComment(octokit, owner, repo, prNumber, inputs, compare, isFork);
  }

  if (inputs.failOnDrift) {
    core.setFailed(`.editorconfig is out of sync with editorconfig.build — see PR comment for details`);
  } else {
    core.warning(`.editorconfig is out of sync with editorconfig.build`);
  }
}

run().catch(err => core.setFailed((err as Error).message));
