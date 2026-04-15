export interface Inputs {
  token: string;
  tag: string | undefined;
  path: string;
  autoFix: boolean;
  failOnDrift: boolean;
  prComment: boolean;
  fixTrigger: 'label' | 'checkbox';
  fixLabel: string;
  reportStatus: boolean;
  githubToken: string;
}

export interface CompareResult {
  inSync: boolean;
  localContent: string;
  remoteContent: string;
  localLineCount: number;
  localFileExists: boolean;
  unifiedDiff: string;
}

export interface ProjectConfig {
  reporting?: {
    enabled?: boolean;
    allBranches?: boolean;
  };
}
