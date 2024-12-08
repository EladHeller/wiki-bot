// eslint-disable-next-line import/first
import {
  describe, expect, it, jest,
} from '@jest/globals';
import injectionDecorator, { CallbackArgs } from '../decorators/injectionDecorator';

describe('injectionDecorator', () => {
  it('should inject wikiApi', async () => {
    const implemtationDictionary = {};
    const implementationFunction = jest.fn<any>().mockReturnValue('test');
    const injection = injectionDecorator(({ wikiApi }: CallbackArgs) => wikiApi, {
      wikiApi: implementationFunction,
    }, implemtationDictionary);
    const result = await injection();

    expect(implementationFunction).toHaveBeenCalledTimes(1);
    expect(result).toBe('test');
  });

  it('should memoized results', async () => {
    const implemtationDictionary = {};

    const implementationFunction = jest.fn<any>().mockReturnValue('test');
    const injection = injectionDecorator(({ wikiApi }: CallbackArgs) => wikiApi, {
      wikiApi: implementationFunction,
    }, implemtationDictionary);
    const secondInjection = injectionDecorator(({ wikiApi }: CallbackArgs) => wikiApi, {
      wikiApi: implementationFunction,
    }, implemtationDictionary);
    const result = await injection();
    const secondResult = await secondInjection();

    expect(implementationFunction).toHaveBeenCalledTimes(1);
    expect(result).toBe('test');
    expect(secondResult).toBe('test');
  });

  it('should failed without overrideInjection', async () => {
    const injection = injectionDecorator(({ wikiApi }: CallbackArgs) => wikiApi);

    await expect(injection()).rejects.toThrow('Missing username or password');
  });

  it('should not inject if there are no args', async () => {
    const implementationFunction = jest.fn().mockReturnValue('test');
    // eslint-disable-next-line prefer-rest-params
    const injection = injectionDecorator(function foo() { return arguments[0]; });
    const result = await injection();

    expect(implementationFunction).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should not inject if there are no destructure', async () => {
    const implementationFunction = jest.fn().mockReturnValue('test');
    // eslint-disable-next-line prefer-rest-params
    const injection = injectionDecorator((arg) => arg);
    const result = await injection();

    expect(implementationFunction).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should not inject if there are args that not implemented', async () => {
    const implementationFunction = jest.fn().mockReturnValue('test');
    global.injetionDictionary = {
      wikiApi: implementationFunction,
    };
    // @ts-ignore
    const injection = injectionDecorator(({ test }) => test);
    const result = await injection();

    expect(implementationFunction).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
