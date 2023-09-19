import shabathProtectorDecorator from '../decorators/shabathProtector';

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
