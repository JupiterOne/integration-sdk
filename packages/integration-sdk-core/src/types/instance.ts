export type IntegrationInstanceConfig = object;

/**
 * A stored user configuration for executing the integration defined by
 * the associated `integrationDefinitionId`.
 *
 * @param TConfig the integration specific type of the `config` property
 */
export interface IntegrationInstance<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> {
  /**
   * Unique identifier for the activated integration instance.
   */
  id: string;

  /**
   * `accountId` identifies the tenant/account holder that activated the
   * integration.
   */
  accountId: string;

  /**
   * A short friendly name for the integration instance that is provided by
   * end-user.
   */
  name: string;

  /**
   * Optional description of the integration instance.
   */
  description?: string;

  /**
   * The `integrationDefinitionId` identifies the integration definition
   * that the instance relates to.
   */
  integrationDefinitionId: string;

  /**
   * Each integration specifies the properties it requires a user provide when
   * configuring an instance of the integration. It is up to the UI to validate
   * input at configuration time, and the integration should also validate the
   * configuration upon invocation and provide useful configuration error
   * messages.
   */
  config: TConfig;
}
