type MockFunction<T extends (...args: any) => any> = jest.Mock<ReturnType<T>, Parameters<T>>;

export type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any) => any ? MockFunction<T[P]> : T[P];
};
