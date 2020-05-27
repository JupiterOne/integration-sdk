import { ExecutionContext, IntegrationExecutionContext } from './context';
import { IntegrationInstanceConfig } from './instance';

export type InvocationValidationFunction<T extends ExecutionContext> = (
  context: T,
) => Promise<void> | void;

export type IntegrationInvocationValidationFunction<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = InvocationValidationFunction<IntegrationExecutionContext<TConfig>>;
