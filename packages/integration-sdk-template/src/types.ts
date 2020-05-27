import { IntegrationInstanceConfig } from '@jupiterone/integration-sdk';

/**
 * Properties provided by the `IntegrationInstance.config`. This reflects the
 * same properties defined by `instanceConfigFields`.
 */
export interface IntegrationConfig extends IntegrationInstanceConfig {
  /**
   * The provider API client ID used to authenticate requests.
   */
  clientId: string;

  /**
   * The provider API client secret used to authenticate requests.
   */
  clientSecret: string;
}
