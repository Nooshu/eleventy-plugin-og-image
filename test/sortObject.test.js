import test from 'ava';
import { sortObject } from '../src/utils/index.js';

test('sorts keys', (t) => {
  t.is(
    JSON.stringify({
      a: 'a',
      b: {
        a: 'a',
        b: 'b',
      },
    }),
    JSON.stringify(
      sortObject({
        b: {
          b: 'b',
          a: 'a',
        },
        a: 'a',
      }),
    ),
  );
});

test('preserves null and non-object leaf values', (t) => {
  t.deepEqual(sortObject({ z: null, a: 1, m: 'x', b: false }), {
    a: 1,
    b: false,
    m: 'x',
    z: null,
  });
});

test('sorts empty objects', (t) => {
  t.deepEqual(sortObject({}), {});
});

test('recursively sorts nested objects and array-like objects', (t) => {
  t.deepEqual(
    sortObject({
      b: { z: 1, a: 2 },
      a: { 1: 'one', 0: 'zero' },
    }),
    {
      a: { 0: 'zero', 1: 'one' },
      b: { a: 2, z: 1 },
    },
  );
});
