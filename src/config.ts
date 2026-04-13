import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

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

function readJsonFile(path: string): Partial<Config> {
  if (!existsSync(path)) return {};
  const file = Bun.file(path);
  const text = file.text();
  if (!text) return {};
  return JSON.parse(text);
}

export function loadConfig(cliOverrides?: Partial<Config>): Config {
  const globalConfigPath = join(homedir(), '.repro', 'config.json');
  const localConfigPath = join(process.cwd(), 'repro.config.json');

  let config = { ...DEFAULT_CONFIG };

  const globalConfig = readJsonFile(globalConfigPath);
  config = { ...config, ...globalConfig };

  const localConfig = readJsonFile(localConfigPath);
  config = { ...config, ...localConfig };

  if (cliOverrides) {
    config = { ...config, ...cliOverrides };
  }

  return config;
}