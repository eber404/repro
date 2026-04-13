const { existsSync, readFileSync } = require('fs');
const { homedir } = require('os');

export interface Config {
  appPath: string;
  platform: 'android' | 'ios';
  maestroSdk: boolean;
  maxRetries: number;
  flowDir: string;
  resetStrategy: 'clear-app-data' | 'deep-link';
  credentials?: {
    email?: string;
    password?: string;
  };
}

const DEFAULT_CONFIG: Config = {
  appPath: '',
  platform: 'android',
  maestroSdk: true,
  maxRetries: 5,
  flowDir: './flows',
  resetStrategy: 'clear-app-data',
  credentials: {}
};

async function readJsonFile(path: string): Promise<Partial<Config>> {
  try {
    if (!existsSync(path)) return {};
    const text = readFileSync(path, 'utf-8');
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function loadEnvCredentials(): Promise<{ email?: string; password?: string }> {
  const envPath = `${process.cwd()}/.env`;

  try {
    if (!existsSync(envPath)) return {};
    const text = readFileSync(envPath, 'utf-8');
    if (!text) return {};

    const env: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      env[key] = value;
    }

    return {
      email: env.REPRO_APP_EMAIL,
      password: env.REPRO_APP_PASSWORD
    };
  } catch {
    return {};
  }
}

export async function loadConfig(cliOverrides?: Partial<Config>): Promise<Config> {
  const globalConfigPath = `${homedir()}/.repro/config.json`;
  const localConfigPath = `${process.cwd()}/repro.config.json`;

  let config = { ...DEFAULT_CONFIG };

  const globalConfig = await readJsonFile(globalConfigPath);
  config = { ...config, ...globalConfig };

  const localConfig = await readJsonFile(localConfigPath);
  config = { ...config, ...localConfig };

  const envCredentials = await loadEnvCredentials();
  if (envCredentials.email || envCredentials.password) {
    config.credentials = { ...config.credentials, ...envCredentials };
  }

  if (cliOverrides) {
    config = { ...config, ...cliOverrides };
  }

  return config;
}
