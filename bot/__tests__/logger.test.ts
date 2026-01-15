import { describe, expect, it } from '@jest/globals';
import { stringify } from '../utilities/logger';

describe('stringify', () => {
  it('should stringify object', () => {
    expect(stringify({ a: 1, b: 2 })).toBe(`{
  "a": 1,
  "b": 2
}`);
  });

  it('should strigify error without stack', () => {
    const error = new Error('test');
    delete error.stack;

    expect(stringify(error)).toBe('Error: test');
  });
});
