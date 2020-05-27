import { convertPropertyValue } from './converters';

/**
 * A key/value tag associated with a resource in the provider. Some providers
 * return tags as a list of objects taking this shape.
 */
type ResourceKeyValueTag = {
  Key?: string;
  Value?: string;
  key?: string;
  value?: string;
};

/**
 * A listing of key/values associated with a resource in the provider. Some
 * providers return tags as a collection of objects with key/value properties.
 */
export type ResourceTagList = ResourceKeyValueTag[];

/**
 * A mapping of key/values associated with a resource in the provider. Some
 * providers return tags as a `Record<string, string>`.
 */
export type ResourceTagMap = Record<string, string>;

/**
 * An entity representing a resource in the provider that has associated tags.
 * Tags are assigned as `tag.${key}` properties and in cases where a lowercased
 * tag name matches certain properties, the tag value will be transferred to
 * that property.
 */
export type TaggedEntity = {
  name?: string;
  displayName?: string;
  [tag: string]: string | string[] | boolean | number | undefined;
};

/**
 * Properties that will have their values set from tags; the value of the tag
 * will be downcased! The expectation is that many providers will implement
 * these entity properties as tags.
 */
const COMMON_TAGGED_PROPERTIES = ['classification', 'owner', 'email'];

const TRUE_BOOLEAN_REGEX = /^true$/i;

/**
 * Assigns tags to properties of the entity.
 *
 * Tags having the key `'Name'` or `'name'` will be assigned to
 * `entity.displayName` and, unless a value is already present, `entity.name`.
 *
 * @param entity any object, it will be treated as a `TaggedEntity`
 * @param tags tags returned by provider APIs; may be undefined/null for
 * convenience (some APIs return those values)
 * @param assignProperties names of additional tags to transfer as direct entity
 * properties when a downcased tag key matches; the value of the tag will be
 * downcased as well!
 *
 * @returns entity for chaining convenience
 */
export function assignTags<T extends object>(
  entity: T,
  tags:
    | ResourceKeyValueTag[]
    | ResourceTagMap
    | string
    | string[]
    | undefined
    | null,
  assignProperties: string[] = [],
): T {
  if (tags) {
    const taggedEntity = entity as TaggedEntity;
    let tagMap: ResourceTagMap = {};
    if (typeof tags === 'string') {
      const tagDelimiter = tags.includes(',') ? ',' : ' ';
      taggedEntity.tags = tags
        .split(tagDelimiter)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    } else if (Array.isArray(tags)) {
      if (typeof tags[0] === 'string') {
        taggedEntity.tags = tags as string[];
      } else {
        tagMap = (tags as ResourceKeyValueTag[]).reduce(
          (m: ResourceTagMap, t) => {
            const k = t.Key || t.key;
            const v = t.Value || t.value;
            if (k && v) {
              m[k] = v;
            }
            return m;
          },
          {},
        );
      }
    } else {
      tagMap = tags;
    }

    assignTagMap(taggedEntity, tagMap, assignProperties);
  }

  return entity;
}

function assignTagMap(
  entity: TaggedEntity,
  tagMap: ResourceTagMap,
  assignProperties: string[],
): void {
  const tags: string[] = [];

  for (const key of Object.keys(tagMap)) {
    const value = tagMap[key];
    if (value) {
      if (TRUE_BOOLEAN_REGEX.test(value)) {
        tags.push(key);
      }

      entity[`tag.${key}`] = convertPropertyValue(value);

      const lowerKey = key.toLowerCase();
      if (lowerKey === 'name' && value) {
        if (!entity.name) {
          entity.name = value;
        }
        entity.displayName = value;
      }

      if (
        COMMON_TAGGED_PROPERTIES.includes(lowerKey) ||
        assignProperties.includes(lowerKey)
      ) {
        entity[lowerKey] = value.toLowerCase();
      }
    }
  }

  if (tags.length > 0) {
    entity.tags = tags;
  }
}
