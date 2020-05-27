import { BucketMap } from '../BucketMap';

describe('add', () => {
  test('sets key with values if entry does not exist', () => {
    const bucketMap = new BucketMap();
    bucketMap.add('test', [1, 2, 3]);

    expect(bucketMap.get('test')).toEqual([1, 2, 3]);
  });

  test('appends values to existing key', () => {
    const bucketMap = new BucketMap();
    bucketMap.set('test', [1, 2, 3]);

    bucketMap.add('test', [4, 5, 6]);
    expect(bucketMap.get('test')).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('updates total item count as objects are added', () => {
    const bucketMap = new BucketMap();
    bucketMap.set('samekey', [1, 2, 3]);
    expect(bucketMap.totalItemCount).toEqual(3);

    bucketMap.add('samekey', [4, 5, 6]);
    expect(bucketMap.totalItemCount).toEqual(6);

    bucketMap.add('differentkey', [4, 5, 6]);
    expect(bucketMap.totalItemCount).toEqual(9);
  });
});

describe('set', () => {
  test('updates count of total count items for new keys', () => {
    const bucketMap = new BucketMap();
    bucketMap.set('test', [1, 2, 3]);
    expect(bucketMap.totalItemCount).toEqual(3);

    bucketMap.set('test2', [1, 2, 3]);
    expect(bucketMap.totalItemCount).toEqual(6);
  });

  test('maintains accurate count when keys are replaced', () => {
    const bucketMap = new BucketMap();
    bucketMap.set('samekey', [1, 2, 3]);
    expect(bucketMap.totalItemCount).toEqual(3);

    bucketMap.set('samekey', [4, 5, 6]);
    expect(bucketMap.totalItemCount).toEqual(3);

    bucketMap.set('samekey', [1]);
    expect(bucketMap.totalItemCount).toEqual(1);

    bucketMap.set('samekey', [4, 3]);
    expect(bucketMap.totalItemCount).toEqual(2);
  });
});

describe('delete', () => {
  test('decreases count of items stored in key from total count', () => {
    const bucketMap = new BucketMap();
    bucketMap.set('test', [1, 2, 3]);
    expect(bucketMap.totalItemCount).toEqual(3);

    bucketMap.delete('test');
    expect(bucketMap.totalItemCount).toEqual(0);
  });
});
