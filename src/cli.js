#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { writeFile, stat } from 'node:fs/promises';
import { merge } from './merge.js';
import { join, basename } from 'node:path';
import { cwd, exit } from 'node:process';
import glob from 'fast-glob';
import parseArgs from 'yargs-parser';

let { input, output } = parseArgs(
  process.argv.slice(2),
  {
    alias: {
      input: ['i'],
      output: ['o']
    }
  }
);

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
    if (existsSync(output)) {
      const s = await stat(output);
      if (s.isDirectory()) {
        output = join(output, basename(input));
      }
    }
    output = [output];
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
      const mergedContent = await merge(input);
      console.log(`writing ${output}...`);
      await writeFile(output, JSON.stringify(mergedContent, null, 2));
    }));
