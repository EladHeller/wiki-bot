import { describe, expect, it } from '@jest/globals';
import getChromiumLaunchOptions from '../utilities/playwright';

describe('getChromiumLaunchOptions', () => {
  it('should use Playwright defaults outside Lambda', () => {
    expect(getChromiumLaunchOptions({})).toStrictEqual({
      headless: true,
      timeout: 30 * 1000,
    });
  });

  it.each([
    ['function name', { AWS_LAMBDA_FUNCTION_NAME: 'iron-swords' }],
    ['execution environment', { AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs24.x' }],
  ])('should use serverless browser settings with a Lambda %s', (_label, environment) => {
    expect(getChromiumLaunchOptions(environment)).toStrictEqual({
      headless: true,
      timeout: 30 * 1000,
      args: [
        '--single-process',
        '--no-zygote',
        '--in-process-gpu',
        '--disable-site-isolation-trials',
        '--font-render-hinting=none',
      ],
      env: {
        ...environment,
        HOME: '/tmp',
        XDG_CACHE_HOME: '/tmp/.cache',
      },
    });
  });
});
