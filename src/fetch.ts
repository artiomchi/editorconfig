import type { ProjectConfig } from './types.js';

const CDN_BASE = 'https://cdn.editorconfig.build/v1/projects';

export function buildRemoteUrl(token: string, tag: string | undefined): string {
  if (tag) {
    return `${CDN_BASE}/${token}/${tag}/.editorconfig`;
  }
  return `${CDN_BASE}/${token}/.editorconfig`;
}

export function buildConfigUrl(token: string): string {
  return `${CDN_BASE}/${token}/config.json`;
}

export async function fetchRemoteConfig(token: string, tag: string | undefined): Promise<string> {
  const url = buildRemoteUrl(token, tag);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch remote .editorconfig (HTTP ${res.status}): ${url}`);
  }
  return res.text();
}

export async function fetchProjectConfig(token: string): Promise<ProjectConfig | null> {
  const url = buildConfigUrl(token);
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch project config (HTTP ${res.status}): ${url}`);
  }
  return res.json() as Promise<ProjectConfig>;
}
