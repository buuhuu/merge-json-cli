import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { cwd } from 'node:process';
import glob from 'fast-glob';

async function readJsonFile(path) {
  const fileContent = await readFile(path, 'utf-8');
  return JSON.parse(fileContent);
}

function findRef(path, object, originalPath = path) {
  if (path === '/' || path === '') {
    return object;
  }

  const parts = path.split('/').filter(Boolean);
  let current = object;

  for (const part of parts) {
    if (Array.isArray(current)) {
      // If we're looking for any property in an array of objects, find the first object with that property
      const foundObject = current.find(item => item[part] !== undefined);
      if (foundObject) {
        current = foundObject[part];
      } else {
        current = current.find(item => item.id === part);
      }
    } else if (typeof current === 'object' && current !== null) {
      current = current[part];
    } else {
      current = undefined;
    }

    if (current === undefined) {
      throw new Error(`Reference '${originalPath}' not found at '${part}'`);
    }
  }

  return current;
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
      try {
        validateRelativeTo(otherFile);
        const otherObject = await readJsonFile(otherFile);
        const value = findRef(path, otherObject);
        return await walk(otherFile, value, otherObject);
      } catch (error) {
        throw error;
      }
    }));
  }

  function mergeObject(left, right) {
    const result = { ...left };
    for (const key in right) {
      if (Object.prototype.hasOwnProperty.call(right, key)) {
        if (typeof right[key] === 'object' && right[key] !== null && !Array.isArray(right[key])) {
          result[key] = mergeObject(result[key] || {}, right[key]);
        } else {
          result[key] = right[key];
        }
      }
    }
    return result;
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
          values = values.flatMap(value => Array.isArray(value) ? value : [value]);
          // Merge the imported values with the rest of the properties in the item
          const { '...': _, ...rest } = item;
          return values.map(value => mergeObject(value, rest));
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
      // Merge the imported value with the rest of the properties in the object
      const { '...': _, ...rest } = object;
      return mergeObject(value, rest);
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
