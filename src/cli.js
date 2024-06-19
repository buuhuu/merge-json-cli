#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { merge } from './merge.js';

const { values: { in: input, out: output } } = parseArgs({
  options: {
    in: {
      type: 'string',
      short: 'i',
    },
    out: {
      type: 'string',
      short: 'o',
    },
  },
});

if (!input || !output) {
  console.error('Usage: merge-json --in <input> --out <output>');
  process.exit(1);
}

const mergedCotnent = await merge(input);

await writeFile(output, JSON.stringify(mergedCotnent, null, 2));
