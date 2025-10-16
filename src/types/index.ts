export interface FileContext {
  path: string;
  created: {
    date: Date;
    author: string;
    commit: string;
    message: string;
  };
  lastModified: {
    date: Date;
    author: string;
    commit: string;
    message: string;
  };
  github?: {
    prs: PullRequest[];
    issues: Issue[];
  };
  dependencies: {
    imports: string[];
    importedBy: string[];
  };
  errors?: ErrorContext;
  linesOfCode: number;
}

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  author: string;
  mergedAt: Date;
}

export interface Issue {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
}

export interface ErrorContext {
  defined: TypedErrorInfo[];
  thrown: TypedErrorInfo[];
  caught: TypedErrorInfo[];
}

export interface TypedErrorInfo {
  name: string;
  type: string;
  location: {
    file: string;
    line: number;
  };
}

export interface ErrorFlow {
  error: string;
  definedIn: string;
  thrownIn: string[];
  caughtIn: string[];
  uncaughtIn: string[];
}

export interface CoverageReport {
  totalErrors: number;
  coveredErrors: number;
  uncoveredErrors: number;
  percentage: number;
  details: {
    error: string;
    coverage: number;
    riskyFiles: string[];
  }[];
}

export interface AnalyzerConfig {
  gitRoot: string;
  includeGithub?: boolean;
  githubToken?: string;
  excludePatterns?: string[];
}
