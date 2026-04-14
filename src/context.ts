export interface ReproContext {
  bug: string;
  enhancedBugDescription?: string;
  appId: string;
  deviceId: string | null;
  platform: 'android' | 'ios';
  maxRetries: number;
  flowDir: string;
  resetStrategy: 'clear-app-data' | 'deep-link';
  resetDeepLink?: string;
  maestroPath: string;
  uiTree: object | null;
  visibleScreenshotPath?: string;
  screenAnalysis?: string | Record<string, unknown>;
  loginBootstrapYaml?: string;
  plan: Plan | null;
  flowFile: string | null;
  executionResult: ExecutionResult | null;
  executionReport: ExecutionReport | null;
  reproduced: boolean | null;
  refinement: Plan | null;
  error: string | null;
  attempt: number;
  credentials?: {
    email?: string;
    password?: string;
  };
}

export interface Device {
  id: string;
  name: string;
  status?: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  screenshots: string[];
}

export interface ExecutionReport {
  timestamp: string;
  logFile: string;
  logExcerpt: string;
  anomalies: string[];
  screenshots: string[];
  flowFile: string;
}

export interface Plan {
  steps: PlanStep[];
  hypothesis?: string;
  network?: {
    latencyMs?: number;
    forceHttpStatus?: number;
  };
}

export interface PlanStep {
  action: string;
  element?: string;
  text?: string;
  direction?: string;
  key?: string;
  target?: string;
  value?: string;
}

export interface UIElement {
  id?: string;
  text?: string;
  contentDescription?: string;
  resourceId?: string;
  className?: string;
  enabled?: boolean;
  focused?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}
