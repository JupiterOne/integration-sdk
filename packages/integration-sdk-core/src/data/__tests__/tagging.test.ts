import { assignTags, TaggedEntity } from '../tagging';

describe('assignTags', () => {
  let entity: TaggedEntity;

  beforeEach(() => (entity = {}));

  test('undefined', () => {
    assignTags(entity, undefined);
    expect(entity).toEqual({});
  });

  test('csv string', () => {
    assignTags(entity, 'abc, xyz, 123');
    expect(entity).toEqual({ tags: ['abc', 'xyz', '123'] });
  });

  test('long string', () => {
    assignTags(entity, ' abc xyz 123 ');
    expect(entity).toEqual({ tags: ['abc', 'xyz', '123'] });
  });

  test('string array', () => {
    assignTags(entity, ['abc', 'xyz', '123']);
    expect(entity).toEqual({ tags: ['abc', 'xyz', '123'] });
  });

  test('empty tag list', () => {
    assignTags(entity, []);
    expect(entity).toEqual({});
  });

  test('empty tag map', () => {
    assignTags(entity, {});
    expect(entity).toEqual({});
  });

  test('tag list with undefined Key, key', () => {
    assignTags(entity, [{}]);
    expect(entity).toEqual({});
  });

  test('tag list with undefined Value, value', () => {
    assignTags(entity, [{ Key: 'a' }]);
    expect(entity).toEqual({});
  });

  test('tag map with undefined value', () => {
    assignTags(entity, { a: undefined } as any);
    expect(entity).toEqual({});
  });

  test('tag map', () => {
    assignTags(entity, { a: 'b' });
    expect(entity).toEqual({ 'tag.a': 'b' });
  });

  test('tag list with Key, Value', () => {
    assignTags(entity, [{ Key: 'a', Value: 'b' }]);
    expect(entity).toEqual({ 'tag.a': 'b' });
  });

  test('tag list with key, value', () => {
    assignTags(entity, [{ key: 'a', value: 'b' }]);
    expect(entity).toEqual({ 'tag.a': 'b' });
  });

  test('tags with "true" value have property name added to .tags', () => {
    assignTags(entity, [{ key: 'Production', value: 'true' }]);
    expect(entity).toMatchObject({
      'tag.Production': true,
      tags: ['Production'],
    });
  });

  test('tags with "true" value are assigned as boolean', () => {
    assignTags(entity, [
      { key: 'Production', value: 'true' },
      { key: 'SpecialNeeds', value: 'TRuE' },
    ]);
    expect(entity).toMatchObject({
      'tag.Production': true,
      'tag.SpecialNeeds': true,
      tags: ['Production', 'SpecialNeeds'],
    });
  });

  test('tags with "false" value are assigned as boolean', () => {
    assignTags(entity, [
      { key: 'Production', value: 'false' },
      { key: 'Human', value: 'FAlse' },
    ]);
    expect(entity).toMatchObject({
      'tag.Production': false,
      'tag.Human': false,
    });
  });

  test('tags with numeric values provided as a string are assigned as numbers', () => {
    assignTags(entity, [{ key: 'Production', value: '123' }]);
    expect(entity).toMatchObject({
      'tag.Production': 123,
    });
  });

  test('tag with common property name stored as unmodified tag', () => {
    assignTags(entity, [{ key: 'Classification', value: 'CRITICAL' }]);
    expect(entity).toMatchObject({
      'tag.Classification': 'CRITICAL',
    });
  });

  test('tag with common property name stored as lowercased key and value', () => {
    assignTags(entity, [{ key: 'Classification', value: 'CRITICAL' }]);
    expect(entity).toMatchObject({
      classification: 'critical',
    });
  });

  test('tag with name in properties option stored as unmodified tag', () => {
    assignTags(
      entity,
      [{ key: 'TransferMe', value: 'PLEASE' }],
      ['transferme'],
    );
    expect(entity).toMatchObject({
      'tag.TransferMe': 'PLEASE',
    });
  });

  test('tag with name in properties option stored as lowercased key and value', () => {
    assignTags(
      entity,
      [{ key: 'TransferMe', value: 'PLEASE' }],
      ['transferme'],
    );
    expect(entity).toMatchObject({
      transferme: 'please',
    });
  });

  test('tag with name "name" is transferred to "name" when no existing value', () => {
    assignTags(entity, [{ key: 'name', value: 'The Special' }]);
    expect(entity).toMatchObject({
      name: 'The Special',
    });
  });

  test('tag with name "name" is not transferred to "name" when existing value', () => {
    entity = assignTags({ ...entity, name: 'Untouchable' }, [
      { key: 'name', value: 'The Special' },
    ]);
    expect(entity).toMatchObject({
      name: 'Untouchable',
    });
  });

  test('tag with name "name" is transferred to "displayName" when no existing value', () => {
    assignTags(entity, [{ key: 'name', value: 'The Special' }]);
    expect(entity).toMatchObject({
      displayName: 'The Special',
    });
  });

  test('tag with name "name" is transferred to "displayName" when existing value', () => {
    entity = assignTags({ ...entity, displayName: 'Some Resource' }, [
      { key: 'name', value: 'The Special' },
    ]);
    expect(entity).toMatchObject({
      displayName: 'The Special',
    });
  });

  test('tag with name "Name" is transferred to "name" when no existing value', () => {
    assignTags(entity, [{ key: 'Name', value: 'The Special' }]);
    expect(entity).toMatchObject({
      name: 'The Special',
    });
  });

  test('tag with name "Name" is not transferred to "name" when existing value', () => {
    entity = assignTags({ ...entity, name: 'Untouchable' }, [
      { key: 'Name', value: 'The Special' },
    ]);
    expect(entity).toMatchObject({
      name: 'Untouchable',
    });
  });

  test('tag with name "Name" is transferred to "displayName" when no existing value', () => {
    assignTags(entity, [{ key: 'Name', value: 'The Special' }]);
    expect(entity).toMatchObject({
      displayName: 'The Special',
    });
  });

  test('tag with name "Name" is transferred to "displayName" when existing value', () => {
    entity = assignTags({ ...entity, displayName: 'Some Resource' }, [
      { key: 'Name', value: 'The Special' },
    ]);
    expect(entity).toMatchObject({
      displayName: 'The Special',
    });
  });
});
