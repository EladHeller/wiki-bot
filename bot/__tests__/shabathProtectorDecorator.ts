import shabathProtectorDecorator, { isAfterShabathOrHolliday } from '../decorators/shabathProtector';

describe('shabathProtectorDecorator', () => {
  jest.useFakeTimers();

  it('should return undefined for Shabath in Israel', async () => {
    const cb = jest.fn().mockReturnValue('result');
    const mockDate = new Date('2023-09-23T12:00:00Z'); // Yom Kippur
    jest.setSystemTime(mockDate);

    const args = [1, 2, 3];
    const result = await shabathProtectorDecorator(cb)(...args);

    expect(result).toBeUndefined();
    expect(cb).not.toHaveBeenCalled();
  });

  it('should return undefined for Yom Tov', async () => {
    const cb = jest.fn().mockReturnValue('result');
    const mockDate = new Date('2023-09-25T12:00:00Z'); // Yom Kippur
    jest.setSystemTime(mockDate);

    const args = [1, 2, 3];
    const result = await shabathProtectorDecorator(cb)(...args);

    expect(result).toBeUndefined();
    expect(cb).not.toHaveBeenCalled();
  });

  it('should call the original function Moz\'ey Yom Tov', async () => {
    const cb = jest.fn().mockReturnValue('result');
    const mockDate = new Date('2023-09-30T20:00:00Z');
    jest.setSystemTime(mockDate);

    const args = [1, 2, 3];
    const result = await shabathProtectorDecorator(cb)(...args);

    expect(result).toBe('result');
    expect(cb).toHaveBeenCalledWith(...args);
  });

  it('should call the original function Yom Tov Shel Galuyot', async () => {
    const cb = jest.fn().mockReturnValue('result');
    const mockDate = new Date('2023-09-31T10:00:00Z');
    jest.setSystemTime(mockDate);

    const args = [1, 2, 3];
    const result = await shabathProtectorDecorator(cb)(...args);

    expect(result).toBe('result');
    expect(cb).toHaveBeenCalledWith(...args);
  });

  it('should call the original function for Yom Tov night', async () => {
    const cb = jest.fn().mockReturnValue('result');
    const mockDate = new Date('2023-09-29T20:00:00Z'); // Sukkot night
    jest.setSystemTime(mockDate);

    const args = [1, 2, 3];
    const result = await shabathProtectorDecorator(cb)(...args);

    expect(result).toBeUndefined();
    expect(cb).not.toHaveBeenCalled();
  });

  it('should call the original function for regular days', async () => {
    const cb = jest.fn().mockReturnValue('result');
    const mockDate = new Date('2023-09-20T12:00:00Z'); // Monday
    jest.setSystemTime(mockDate);

    const args = [1, 2, 3];
    const result = await shabathProtectorDecorator(cb)(...args);
    expect(result).toBe('result');
    expect(cb).toHaveBeenCalledWith(...args);
  });
});

describe('isAfterShabathOrHolliday', () => {
  it('should return false for regular days', () => {
    const mockDate = new Date('2023-10-09T12:00:00Z'); // Monday
    jest.setSystemTime(mockDate);

    const result = isAfterShabathOrHolliday();
    expect(result).toBe(false);
  });

  it('should return false for Yom Tov night', () => {
    const mockDate = new Date('2023-09-29T20:00:00Z'); // Sukkot night
    jest.setSystemTime(mockDate);

    const result = isAfterShabathOrHolliday();
    expect(result).toBe(false);
  });

  it('should return true for Motze\'ey Yom Tov', () => {
    const mockDate = new Date('2023-09-30T20:00:00Z'); // Motze'ey Sukkot
    jest.setSystemTime(mockDate);

    const result = isAfterShabathOrHolliday();
    expect(result).toBe(true);
  });

  it('should return false for Shabath night', async () => {
    const mockDate = new Date('2024-01-19T21:00:00Z');
    jest.setSystemTime(mockDate);

    const result = isAfterShabathOrHolliday();
    expect(result).toBe(false);
  });

  it('should return false for Shabath morning', async () => {
    const mockDate = new Date('2024-01-20T10:00:00Z');
    jest.setSystemTime(mockDate);

    const result = isAfterShabathOrHolliday();
    expect(result).toBe(false);
  });

  it('should return true for Motze\'ey Shabath', async () => {
    const mockDate = new Date('2024-01-20T20:00:00Z');
    jest.setSystemTime(mockDate);

    const result = isAfterShabathOrHolliday();
    expect(result).toBe(true);
  });
});
