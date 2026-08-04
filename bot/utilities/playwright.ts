import { LaunchOptions } from 'playwright';

const lambdaArgs = [
  '--single-process',
  '--no-zygote',
  '--in-process-gpu',
  '--disable-site-isolation-trials',
  '--font-render-hinting=none',
];

export default function getChromiumLaunchOptions(
  environment: Record<string, string | undefined> = process.env,
): LaunchOptions {
  const isLambda = [environment.AWS_LAMBDA_FUNCTION_NAME, environment.AWS_EXECUTION_ENV].some(Boolean);

  return {
    headless: true,
    timeout: 30 * 1000,
    ...(isLambda ? {
      args: lambdaArgs,
      env: {
        ...environment,
        HOME: '/tmp',
        XDG_CACHE_HOME: '/tmp/.cache',
      },
    } : {}),
  };
}
