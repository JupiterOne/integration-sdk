import { RawDataTracking } from '../../types';
import { getRawData, setRawData, validateRawData } from '../rawData';

let entity: RawDataTracking;

beforeEach(() => {
  entity = {};
});

describe('getRawData', () => {
  test('should answer default when not specified', () => {
    entity = { _rawData: [{ name: 'default', rawData: 'default data' }] };
    expect(getRawData(entity)).toEqual('default data');
  });

  test('should answer undefined when not there', () => {
    expect(getRawData(entity, 'notthere')).toBeUndefined();
  });

  test('should not answer value with different name', () => {
    entity = { _rawData: [{ name: 'there', rawData: 'there data' }] };
    expect(getRawData(entity, 'notthere')).toBeUndefined();
  });

  test('should answer value when there', () => {
    entity = { _rawData: [{ name: 'there', rawData: 'there data' }] };
    expect(getRawData(entity, 'there')).toEqual('there data');
  });

  test('should answer first found matching name', () => {
    entity = {
      _rawData: [
        { name: 'there', rawData: 'there 1st' },
        { name: 'there', rawData: 'there 2nd' },
      ],
    };
    expect(getRawData(entity, 'there')).toEqual('there 1st');
  });
});

describe('setRawData', () => {
  test('should store value', () => {
    setRawData(entity, { name: 'default', rawData: 'insert please' });
    expect(entity._rawData).toEqual([
      { name: 'default', rawData: 'insert please' },
    ]);
  });

  test('should not store same name twice', () => {
    setRawData(entity, { name: 'default', rawData: 'insert please' });
    expect(() => {
      setRawData(entity, { name: 'default', rawData: 'insert please' });
    }).toThrowError(/duplicate/i);
  });
});

describe('validateRawData', () => {
  test('unique name is good', () => {
    entity = {
      _rawData: [
        { name: 'default', rawData: 'anything' },
        { name: 'something', rawData: 'other' },
      ],
    };
    expect(() => validateRawData(entity)).not.toThrowError();
  });

  test('duplicate name is bad', () => {
    entity = {
      _rawData: [
        { name: 'default', rawData: 'anything' },
        { name: 'default', rawData: 'other' },
      ],
    };
    expect(() => validateRawData(entity)).toThrowError(/duplicate/i);
  });
});
