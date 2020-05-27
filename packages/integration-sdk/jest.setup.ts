import 'jest-extended';

jest.mock('bunyan', () => {
  const Logger = jest.requireActual('bunyan');

  const LOG_LEVELS = ['trace', 'debug', 'info', 'fatal', 'warn', 'error'];
  for (const logLevel of LOG_LEVELS) {
    jest.spyOn(Logger.prototype, logLevel);
  }

  function MockLogger(options: any) {
    const ringbuffer = new Logger.RingBuffer({ limit: 100 });
    options.streams = [
      {
        level: 'trace',
        type: 'raw',
        stream: ringbuffer,
      },
    ];
    return new Logger(options);
  }

  MockLogger.createLogger = function (options: any) {
    return new (MockLogger as any)(options);
  };

  MockLogger.stdSerializers = Logger.stdSerializers;

  return MockLogger;
});
