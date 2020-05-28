import { IntegrationInstanceConfig } from './instance';
import { GetStepStartStatesFunction, Step } from './step';
import { InvocationValidationFunction } from './validation';
import {
  ExecutionContext,
  IntegrationExecutionContext,
  StepExecutionContext,
  IntegrationStepExecutionContext,
} from './context';

export interface InvocationConfig<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
> {
  validateInvocation?: InvocationValidationFunction<TExecutionContext>;
  getStepStartStates?: GetStepStartStatesFunction<TExecutionContext>;
  integrationSteps: Step<TStepExecutionContext>[];
}

export interface IntegrationInvocationConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>
  extends InvocationConfig<
    IntegrationExecutionContext<TConfig>,
    IntegrationStepExecutionContext<TConfig>
  > {
  instanceConfigFields?: IntegrationInstanceConfigFieldMap;
}

export interface IntegrationInstanceConfigField {
  type?: 'string' | 'boolean';
  mask?: boolean;
}

export type IntegrationInstanceConfigFieldMap = Record<
  string,
  IntegrationInstanceConfigField
>;
