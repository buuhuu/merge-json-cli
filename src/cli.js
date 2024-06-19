#!/usr/bin/env node

import { writeFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { merge } from './merge.js';
import { join, basename } from 'node:path';
import { cwd, exit } from 'node:process';
import glob from 'fast-glob';

let { values: { in: input, out: output } } = parseArgs({
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

if (input) {
  if (glob.isDynamicPattern(input)) {
    if (output) {
      const s = await stat(output);
      if (!s.isDirectory()) {
        console.error(`If input is a pattern, output '${output}' must be a directory.`);
        output = null;
      }
    } else {
      output = cwd();
    }
    input = await glob(input, { cwd: cwd() });
    output = input.map((file) => join(output, basename(file)));
  } else {
    if (!output) {
      output = cwd();
    }
    const s = await stat(output);
    if (s.isDirectory()) {
      output = join(output, basename(input));
    }
    input = [input];
  }
}

if (!input || !output) {
  console.error('Usage: merge-json --in <input> [--out <output>]');
  exit(1);
}

await Promise.all(
  input
    .map((file, index) => [file, output[index]])
    .map(async ([input, output]) => {
      const mergedCotnent = await merge(input); 
      console.log(`writing ${output}...`);
      await writeFile(output, JSON.stringify(mergedCotnent, null, 2));
    }));
