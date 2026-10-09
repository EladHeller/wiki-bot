import {
  afterEach, describe, expect, it, jest,
} from '@jest/globals';
import { readFileSync } from 'node:fs';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

const api = WikiApiMock();
const run = jest.fn<() => Promise<void>>();
const model = jest.fn<(...args: any[]) => any>(() => ({ run }));
const decorate = jest.fn<(...args: any[]) => any>((callback: unknown) => callback);
jest.unstable_mockModule('../wiki/WikiApi', () => ({ default: () => api }));
jest.unstable_mockModule('../maintenance/importanceDiscussions/model', () => ({ default: model }));
jest.unstable_mockModule('../decorators/botLoggerDecorator', () => ({ default: decorate }));
const { default: execute, main } = await import('../maintenance/importanceDiscussions/index');
const initialDryRun = process.env.IMPORTANCE_DISCUSSIONS_DRY_RUN;
const initialBotName = process.env.BOT_NAME;

function setDryRun(setting: string | undefined) {
  if (setting === undefined) delete process.env.IMPORTANCE_DISCUSSIONS_DRY_RUN;
  else process.env.IMPORTANCE_DISCUSSIONS_DRY_RUN = setting;
}

describe('importance discussion entry point', () => {
  afterEach(() => {
    if (initialDryRun === undefined) delete process.env.IMPORTANCE_DISCUSSIONS_DRY_RUN;
    else process.env.IMPORTANCE_DISCUSSIONS_DRY_RUN = initialDryRun;
    if (initialBotName === undefined) delete process.env.BOT_NAME;
    else process.env.BOT_NAME = initialBotName;
  });

  it.each([undefined, 'true', 'false'])('handles dry-run configuration %s', async (setting) => {
    setDryRun(setting);
    process.env.BOT_NAME = 'Sapper-bot';
    await execute();

    expect(api.login).toHaveBeenCalledWith();
    expect(model).toHaveBeenLastCalledWith(api, {
      stateTitle: 'משתמש:Sapper-bot/בוט חשיבות/מצב', dryRun: setting !== 'false',
    });
    expect(run).toHaveBeenCalledWith();
  });

  it('uses the standard logging and Sabbath wrapper', () => {
    expect(main).toBe(execute);
    expect(decorate).toHaveBeenCalledWith(execute, { botName: 'בוט דיוני חשיבות' });
  });

  it('schedules one daily execution with a single writer and report-only rollout', () => {
    const template = readFileSync('build/t01.cf.yaml', 'utf8');
    const resource = template.split('  ImportanceDiscussionsFunction:')[1].split('  NewCategoriesFunction:')[0];

    expect(resource).toContain('Schedule: cron(0 10 ? * * *)');
    expect(resource).toContain('ReservedConcurrentExecutions: 1');
    expect(resource).toContain("IMPORTANCE_DISCUSSIONS_DRY_RUN: 'true'");
    expect(resource).toContain('Handler: dist/maintenance/importanceDiscussions/index.main');
  });
});
