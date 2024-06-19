import { describe, it } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'node:path';
import { merge } from '../src/merge.js';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
console.log(__dirname);

describe('merge()', async () => {

  await it('merges an object with an external reference', async () => {
    assert.deepEqual(
      await merge(join(__dirname, 'fixtures', 'object-with-external-ref.json')),
      { foo: 'bar2', bar2: 'foo', bar: 'foo', a: 'b', b: 'c', foobar: 'foobar' }
    );
  });

  await it('merges an array of objects with an internal reference', async () => {
    assert.deepEqual(
      await merge(join(__dirname, 'fixtures', 'object-with-internal-ref.json')),
      [
        { name: "base" },
        { id: 'foobar', name: "base", key: 'value' },
        { id: 'barfoo', name: "base", key: 'value', a: 'b', b: 'c' }
      ]
    );
  });

  await it('merges an array with an external reference', async () => {
    assert.deepEqual(
      await merge(join(__dirname, 'fixtures', 'array-with-external-ref.json')),
      [[[{ foo: 'bar2', bar2: 'foo', foobar: 'foobar' }]], { another: 'entry' }, 'notanentry']
    );
  });

  await it('merges an array with a pattern reference', async () => {
    assert.deepEqual(
      await merge(join(__dirname, 'fixtures', 'array-with-pattern-ref.json')),
      [
        {
          'from': 'array-item',
          'foobar': {
            'foo': 'bar2',
            'bar': 'foo',
            'bar2': 'foo',
            'foobar': 'foobar'
          }
        },
        {
          'from': 'array-item',
          'foo': 'bar2',
          'bar2': 'foo',
          'foobar': 'foobar'
        }
      ]
    );
  });

  await it('throws for a reference outside of the directory', async () => {
    try {
      await merge(join(__dirname, 'fixtures', 'object-with-broken-ref.json'));
      fail('Expected an error to be thrown');
    } catch {
      // expected
    };
  });

  await it('throws for a pattern reference in an object', async () => {
    try {
      await merge(join(__dirname, 'fixtures', 'object-with-pattern-ref.json'));
      fail('Expected an error to be thrown');
    } catch {
      // expected
    };
  });

  await it('throws for a reference not found', async () => {
    try {
      await merge(join(__dirname, 'fixtures', 'object-with-reference-not-found.json'));
      fail('Expected an error to be thrown');
    } catch {
      // expected
    };
  });
});