import { jest } from '@jest/globals';

type MockFunction<T extends (...args: any) => any> = jest.Mock<(...args: Parameters<T>) => any>;

export type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any) => any ? MockFunction<T[P]> : T[P];
};
