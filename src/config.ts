import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Config {
  appPath: string;
  platform: 'android' | 'ios';
  maestroSdk: boolean;
  maxRetries: number;
  flowDir: string;
  resetStrategy: 'clear-app-data' | 'deep-link';
}

const DEFAULT_CONFIG: Config = {
  appPath: '',
  platform: 'android',
  maestroSdk: true,
  maxRetries: 5,
  flowDir: './flows',
  resetStrategy: 'clear-app-data'
};

export function loadConfig(cliOverrides?: Partial<Config>): Config {
  const globalConfigPath = join(homedir(), '.repro', 'config.json');
  const localConfigPath = join(process.cwd(), 'repro.config.json');

  let config = { ...DEFAULT_CONFIG };

  if (existsSync(globalConfigPath)) {
    const globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
    config = { ...config, ...globalConfig };
  }

  if (existsSync(localConfigPath)) {
    const localConfig = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
    config = { ...config, ...localConfig };
  }

  if (cliOverrides) {
    config = { ...config, ...cliOverrides };
  }

  return config;
}