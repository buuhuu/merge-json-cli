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

  const [, ...parts] = path.split('/');
  const key = parts.shift();
  let nextObject;
  if (Array.isArray(object)) {
    if (!isNaN(key)) {
      // If the key is a number, use it as an array index so when in json files, we can properly target /0/fields or other indexes
      nextObject = object[parseInt(key, 10)];
    } else {
      nextObject = object.find((item) => item.id === key || item.name === key);
    }
  } else if (typeof object === 'object') {
    nextObject = object[key];
  }
  if (!nextObject) {
    throw new Error(`Reference '${originalPath}' not found`);
  }
  return findRef(`/${parts.join('/')}`, nextObject, originalPath);
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

  async function processObject(obj) {
    let importedFields = [];
    let newObject = {};

    for (const key of Object.keys(obj)) {
      if (key.startsWith('...')) {
        const ref = obj[key];
        let values = await resolveValue(ref);
        importedFields = importedFields.concat(values);
      } else if (key === 'fields') {
        // CHANGE: Handle existing 'fields' separately
        newObject[key] = await walk(file, obj[key], self);
      } else {
        newObject[key] = await walk(file, obj[key], self);
      }
    }

    // CHANGE: Consolidate fields
    if (importedFields.length > 0 || newObject.fields) {
      // Merge imported fields with existing fields, if any
      newObject.fields = (newObject.fields || []).concat(importedFields);
      
      // CHANGE: Flatten the fields array to remove nested 'fields' objects
      newObject.fields = newObject.fields.flatMap(field => {
        if (field.fields) {
          // If a field has its own 'fields' property, merge it into the main fields array
          return field.fields;
        }
        return field;
      });
    }

    return newObject;
  }

  if (Array.isArray(object)) {
    return Promise.all(object.map(async (item) => {
      if (typeof item === 'object' && item !== null) {
        return processObject(item);
      }
      return item;
    }));
  }

  if (typeof object === 'object' && object !== null) {
    return processObject(object);
  }

  return object;
}

export async function merge(input) {
  return await walk(input, await readJsonFile(input));
}
