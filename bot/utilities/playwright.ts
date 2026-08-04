import { LaunchOptions } from 'playwright';

const chromiumLaunchOptions: LaunchOptions = {
  headless: true,
  timeout: 30 * 1000,
};

export default chromiumLaunchOptions;
