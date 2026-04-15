import { readFile } from 'fs/promises';
import { createTwoFilesPatch } from 'diff';
import type { CompareResult } from './types.js';

function normalize(content: string): string {
  return content.replace(/\r/g, '').trimEnd();
}

export async function compareConfigs(localPath: string, remoteContent: string): Promise<CompareResult> {
  let localContent = '';
  let localFileExists = false;

  try {
    localContent = await readFile(localPath, 'utf8');
    localFileExists = true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const localNorm = normalize(localContent);
  const remoteNorm = normalize(remoteContent);
  const inSync = localNorm === remoteNorm;

  const localLineCount = localContent ? localContent.split('\n').length : 0;

  const unifiedDiff = inSync
    ? ''
    : createTwoFilesPatch(
        `current ${localPath}`,
        'editorconfig.build',
        localContent,
        remoteContent,
      );

  return { inSync, localContent, remoteContent, localLineCount, localFileExists, unifiedDiff };
}
