import {
  getSchema,
  IntegrationEntitySchema,
  validateEntityWithSchema,
} from '@jupiterone/data-model';

import { IntegrationError } from '../errors';
import { Entity, EntityRawData, RawDataTracking } from '../types';
import { getTime } from './converters';
import { validateRawData } from './rawData';
import { assignTags, ResourceTagList, ResourceTagMap } from './tagging';

const SUPPORTED_TYPES = ['string', 'number', 'boolean'];

/**
 * Properties required to build a valid `Entity`.
 *
 * These properties are more strict (than their counterpart definitions on
 * `Entity`) to prevent literal assignments of `undefined`
 * values.
 */
type RequiredEntityProperties = { _class: string | string[]; _type: string };

/**
 * Allows assignment of any additional properties without being forced to use
 * specific types where that isn't helpful.
 *
 * During development, schema validation prevents failures to provide properties
 * required by the entity `_class`. Combined with automatic transfer of many
 * properties from the `ProviderSourceData`, there may be no strong case to be
 * made for referencing specific TypeScript types. In those cases, it should be
 * possible to provide additional literal entity properties.
 */
type AdditionalEntityProperties = { [key: string]: any };

/**
 * Properties to be assigned to a generated entity which are declared in code
 * literals.
 *
 * Many values can be transferred from the `ProviderSourceData` without any
 * additional effort. Other properties must transferred by using code to specify
 * the property value. These properties can be any name/value, but the list
 * certainly includes those of `Entity`, and some properties
 * *must* be provided.
 */
type LiteralAssignments = Partial<Entity> &
  RequiredEntityProperties &
  AdditionalEntityProperties;

/**
 * A type representing entity data from a provider.
 */
type ProviderSourceData = {
  /**
   * Some providers include a collection of `tags` that will be stored on the
   * generated entity as `tag.propertyName`, `propertyName` when the tag is
   * registered in `tagProperties` or is known to be a common tag property name,
   * and the tag values will be collected in the generated entity as `tags` (a
   * `string[]`);
   */
  tags?: ResourceTagList | ResourceTagMap;

  [key: string]: any;
};

/**
 * Data used to generate an `Entity`.
 */
export type IntegrationEntityData = {
  /**
   * Data from a provider API that will be selectively transferred to an
   * `Entity`.
   *
   * The common properties defined by data model schemas, selected by the
   * `assign._class`, will be found and transferred to the generated entity.
   */
  source: ProviderSourceData;

  /**
   * Literal property assignments. These values will override anything
   * transferred from the `source` data.
   */
  assign: LiteralAssignments;

  /**
   * The names of properties that will be assigned directly to the entity from
   * tags with matching names.
   *
   * @see assignTags
   */
  tagProperties?: string[];
};

/**
 * A generated `Entity` that includes additional properties
 * specific to the entity class and some properties are guaranteed.
 */
type GeneratedEntity = Omit<Entity, '_class'> &
  AdditionalEntityProperties &
  RawDataTracking & { _class: string[]; _key: string; _type: string };

export type IntegrationEntityBuilderInput = {
  /**
   * Data used to generate an `Entity`.
   */
  entityData: IntegrationEntityData;

  // The plan is to allow another property that contains metadata to drive the
  // transfer process further, placing transformations that are common to the
  // integration in one place, and allowing transformation reuse across
  // integrations.
};

/**
 * Generates an `Entity` using the provided `entityData`.
 *
 * WARNING: This is a work in progress. Only certain schemas are supported as
 * the API is worked out in the Azure integration.
 */
export function createIntegrationEntity(
  input: IntegrationEntityBuilderInput,
): GeneratedEntity {
  const generatedEntity = generateEntity(input.entityData);

  validateRawData(generatedEntity);

  if (process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION) {
    validateEntityWithSchema(generatedEntity);
  }

  return generatedEntity;
}

function generateEntity({
  source,
  assign,
  tagProperties,
}: IntegrationEntityData): GeneratedEntity {
  const _rawData: EntityRawData[] = [];
  if (Object.entries(source).length > 0) {
    _rawData.push({ name: 'default', rawData: source });
  }
  if (assign._rawData) {
    _rawData.push(...assign._rawData);
  }

  const _key = assign._key || generateEntityKey(source);
  const _class = Array.isArray(assign._class) ? assign._class : [assign._class];

  const entity: GeneratedEntity = {
    ...whitelistedProviderData(source, _class),
    ...assign,
    _key,
    _class,
    _rawData,
  };

  if (entity.createdOn === undefined) {
    entity.createdOn =
      (source.createdAt && getTime(source.createdAt)) ||
      (source.creationDate && getTime(source.creationDate)) ||
      (source.creationTime && getTime(source.creationTime)) ||
      (source.creationTimestamp && getTime(source.creationTimestamp));
  }

  if (entity.active === undefined && source.status) {
    entity.active = source.status === 'Online' || source.status === 'Active';
  }

  // Remove transferred `source.tags` property from the entity. `tags` is in the
  // schema white list, but the structure isn't what we want `tags` to be.
  // `assignTags` will take care of preparing `tags` properly.
  delete entity.tags;

  assignTags(entity, source.tags, tagProperties);

  // `assignTags` may populate `displayName` from the `source.tags`. When there
  // is an `assign.displayName`, use that instead assuming that an assigned
  // value is meant to override an automatic function.
  if (assign.displayName) {
    entity.displayName = assign.displayName;
  }

  // When a `displayName` is not derived from `source.tags` nor explicitly set
  // by `assign.displayName`, use `entity.name`. This is a last attempt to
  // to provide a value automatically.
  if (!entity.displayName && entity.name) {
    entity.displayName = entity.name;
  }

  return entity;
}

function generateEntityKey(data: any): string {
  const id = data.providerId || data.id;
  if (!id) {
    throw new IntegrationError({
      code: 'INVALID_INPUT_TO_GENERATE_ENTITY_KEY',
      message: 'Entity key generation requires one of data.{providerId,id}',
    });
  }
  return id;
}

function whitelistedProviderData(
  source: ProviderSourceData,
  _class: string[],
): Omit<ProviderSourceData, 'tags'> {
  const whitelistedProviderData: ProviderSourceData = {};
  const schemaProperties = schemaWhitelistedPropertyNames(_class);
  for (const [key, value] of Object.entries(source)) {
    if (value != null && schemaProperties.includes(key)) {
      const valueType = Array.isArray(value) ? typeof value[0] : typeof value;
      if (SUPPORTED_TYPES.includes(valueType)) {
        whitelistedProviderData[key] = value;
      }
    }
  }
  return whitelistedProviderData;
}

const schemaWhitelists = new Map<string[], string[]>();

/**
 * Answers all the property names defined by the schemas referenced in the set
 * of classes. Values are cached to avoid rebuilding, since there could be
 * thousands of entities constructed during a single execution.
 */
function schemaWhitelistedPropertyNames(_class: string[]): string[] {
  let properties = schemaWhitelists.get(_class);
  if (!properties) {
    properties = [];
    for (const c of _class) {
      const schema = getSchema(c);
      if (!schema) {
        throw new IntegrationError({
          code: 'NO_SCHEMA_FOR_CLASS',
          message: `Class '${c}' does not yet have a schema supported by the SDK!`,
        });
      }
      properties.push(...schemaPropertyNames(schema));
    }
    schemaWhitelists.set(_class, properties);
  }
  return properties;
}

function schemaPropertyNames(schema: IntegrationEntitySchema): string[] {
  const names: string[] = [];
  if (schema.properties) {
    names.push(...Object.keys(schema.properties));
  }
  if (schema.allOf) {
    for (const s of schema.allOf) {
      names.push(...schemaPropertyNames(s));
    }
  }
  if (schema.$ref) {
    const refSchema = getSchema(schema.$ref.slice(1));
    if (refSchema) {
      names.push(...schemaPropertyNames(refSchema));
    } else {
      throw new IntegrationError({
        code: 'CANNOT_RESOLVE_SCHEMA_REF',
        message: `Schema $ref '${schema.$ref}' cannot be resolved!`,
      });
    }
  }
  return names;
}
