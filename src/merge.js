import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { cwd } from 'node:process';
import glob from 'fast-glob';

async function readJsonFile(path) {
  const fileContent = await readFile(path, 'utf-8');
  return JSON.parse(fileContent);
}

function findRef(path, object, origianlPath = path) {
  if (path === '/' || path === '') {
    return object;
  }

  const [, ...parts] = path.split('/');
  const key = parts.shift();
  let nextObject;
  if (Array.isArray(object)) {
    nextObject = object.find((item) => item.id === key || item.name === key);
  } else if (typeof object === 'object') {
    nextObject = object[key];
  }
  if (!nextObject) {
    throw new Error(`Reference '${origianlPath}' not found`);
  }
  return findRef(`/${parts.join('/')}`, nextObject, origianlPath);
}

async function walk(file, object, self = object) {
  function validateRelativeTo(otherFile) {
    const relativeToCwd = relative(cwd(), otherFile);
    if (relativeToCwd.startsWith('..')) {
      throw new Error(`Reference '${ref}' resolves to file outside of the current working directory`);
    }
  }

  async function resolveValue(ref, allowPattern = false) {
    let [otherFile, path = '/'] = ref.split('#');

    if (!otherFile) {
      const value = findRef(path, self);
      return [await walk(file, value, self)];
    }

    const dir = dirname(file);
    let paths;
    if (glob.isDynamicPattern(otherFile)) {
      if (!allowPattern) {
        throw new Error(`Pattern reference '${otherFile}' only permitted in arrays`);
      }
      paths = await glob.glob(otherFile, { cwd: dir });
      paths = paths
        .map((path) => resolve(dir, path))
        .sort();
    } else {
      paths = [resolve(dir, otherFile)];
    }

    return await Promise.all(paths.map(async (otherFile) => {
      validateRelativeTo(otherFile);
      const otherObject = await readJsonFile(otherFile);
      const value = findRef(path, otherObject);
      return await walk(otherFile, value, otherObject)
    }));
  }

  function mergeObject(left, right, position) {
    const leftKeys = Object.keys(left);
    const leftValues = Object.values(left);
    const rightKeys = Object.keys(right);
    const rightValues = Object.values(right);
    const mergedKeys = [...leftKeys.slice(0, position), ...rightKeys, ...leftKeys.slice(position + 1)];
    const mergedValues = [...leftValues.slice(0, position), ...rightValues, ...leftValues.slice(position + 1)];
    return Object.fromEntries(mergedKeys.map((key, index) => [key, mergedValues[index]]));
  }

  if (Array.isArray(object)) {
    const mergedNotFlattened = await Promise.all(object.map(async (item) => {
      if (Array.isArray(item)) {
        return [await walk(file, item, self)];
      }
      if (typeof item === 'object') {
        const keys = Object.keys(item);
        const refIndex = keys.findIndex((key) => key === '...');
        if (refIndex >= 0) {
          const ref = item['...'];
          let values = await resolveValue(ref, true);
          if (keys.length === 1) {
            // the ref is the only key in the object, flatten if the results are arrays
            // merging is not necessary
            values = values.flatMap((value) => Array.isArray(value) ? value : [value]);
          } else {
            // if not, no matter what, we merge them
            values = values.map((value) => mergeObject(item, value, refIndex));
          }          
          return values;
        }
        for (const key in item) {
          item[key] = await walk(file, item[key], self);
        }
      }
      return [item];
    }));
    return mergedNotFlattened.flatMap((array) => array);
  }

  if (typeof object === 'object' && object !== null) {
    const refIndex = Object.keys(object).findIndex((key) => key === '...');
    if (refIndex >= 0) {
      const ref = object['...'];
      const [value] = await resolveValue(ref);
      return mergeObject(object, value, refIndex);
    }
    for (const key in object) {
      object[key] = await walk(file, object[key], self);
    }
  }

  return object;
}

export async function merge(input) {
  return await walk(input, await readJsonFile(input));
}
