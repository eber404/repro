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
  const globalConfigPath = Bun.file(join(homedir(), '.repro', 'config.json'));
  const localConfigPath = Bun.file(join(process.cwd(), 'repro.config.json'));

  let config = { ...DEFAULT_CONFIG };

  if (globalConfigPath.exists) {
    const globalConfig = JSON.parse(globalConfigPath.text());
    config = { ...config, ...globalConfig };
  }

  if (localConfigPath.exists) {
    const localConfig = JSON.parse(localConfigPath.text());
    config = { ...config, ...localConfig };
  }

  if (cliOverrides) {
    config = { ...config, ...cliOverrides };
  }

  return config;
}