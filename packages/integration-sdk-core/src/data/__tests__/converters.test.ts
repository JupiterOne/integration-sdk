import { convertProperties, convertNameValuePairs } from '../converters';

describe('convertProperties', () => {
  const original: any = {
    string: 'a',
    array: ['a', 'b', 'c'],
    number: 123,
    // eslint-disable-next-line
    snake_case: 'snake',
    TitleCase: 'title',
    object: {
      name: 'me',
    },
  };

  const flattened: any = {
    string: 'a',
    array: ['a', 'b', 'c'],
    number: 123,
    snakeCase: 'snake',
    titleCase: 'title',
  };

  test('flatten object without options', () => {
    expect(convertProperties(original, {})).toEqual(flattened);
  });

  test('flatten object stringify object', () => {
    expect(convertProperties(original, { stringifyObject: true })).toEqual({
      ...flattened,
      object: JSON.stringify(original.object),
    });
  });

  test('flatten object stringify array', () => {
    expect(convertProperties(original, { stringifyArray: true })).toEqual({
      ...flattened,
      array: JSON.stringify(original.array),
    });
  });
});

describe('convertNameValuePairs', () => {
  const nameValuePairs = [
    {
      name: 'one',
      value: '1',
    },
    {
      name: 'two',
      value: '2',
    },
  ];

  test('without any option', () => {
    expect(convertNameValuePairs(nameValuePairs)).toEqual({
      one: '1',
      two: '2',
    });
  });

  test('with parseString', () => {
    expect(
      convertNameValuePairs(nameValuePairs, {
        parseString: true,
      }),
    ).toEqual({
      one: 1,
      two: 2,
    });
  });

  test('with prefix', () => {
    expect(
      convertNameValuePairs(nameValuePairs, {
        prefix: 'n',
      }),
    ).toEqual({
      'n.one': '1',
      'n.two': '2',
    });
  });
});
