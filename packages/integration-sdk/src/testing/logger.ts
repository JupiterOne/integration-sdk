import { IntegrationLogger } from '../framework';
import noop from 'lodash/noop';
export const noopAsync = () => Promise.resolve();

export function createMockIntegrationLogger(): IntegrationLogger {
  const logger: IntegrationLogger = {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    registerSynchronizationJobContext() {
      return this;
    },
    isHandledError: () => false,
    stepStart: noop,
    stepSuccess: noop,
    stepFailure: noop,
    synchronizationUploadStart: noop,
    synchronizationUploadEnd: noop,
    validationFailure: noop,
    flush: noopAsync,
    publishEvent: noop,
    publishErrorEvent: noop,
    child() {
      return this;
    },
  };

  return logger;
}
