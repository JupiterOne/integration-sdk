export type PersistedObject = PersistedObjectRequiredProperties &
  PersistedObjectOptionalProperties;

interface PersistedObjectRequiredProperties {
  /**
   * This is the natural Id that each integration assigns. For example:
   * `AWS:IAM:UserPolicy:abc123:def`
   */
  _key: string;

  /**
   * The `_type` property describes
   * the type of entity/relationship as identified by the integration.
   * The `_class` property is similar to `_type` but `_class` refers to a
   * classification that has been standardized and it is not unique to
   * a single integration.
   */
  _type: string;

  /**
   * Integrations can supply a *class*
   * which can be used to indicate if a particular entity/relationship conforms
   * to one or more standard classifications. This property is similar to
   * `_type` except that `_class` refers to a type that has
   * been standardized while `_type` is an *entity type* that only
   * has to be unique in the scope of the integration. It is possible
   * that an entity/relationship has a `_type` value but no `_class` value
   * in cases where there is no standard classification for a given
   * entity/relationship.
   *
   * NOTE: an Entity can have more than on _class, this is reflected in
   * it's type
   */
  _class: string;
}

export interface PersistedObjectOptionalProperties {
  /**
   * The name that will be displayed for the persisted object
   *
   * The value of this field will be used to label vertices/edges
   * in the UI.
   */
  displayName?: string;

  /**
   * The hyperlink URL to the entity source
   *
   * The value of this field will be used by the UI to link to the source entity
   * in a new browser tab.
   */
  webLink?: string;
}
