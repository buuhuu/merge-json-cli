# Merge JSON CLI
This is a command-line tool built with Node.js. It provides a utility to merge JSON files using the JavaScript spread syntax.

```json
{
    "key": "value",
    "...": "./another-file.json"
}
```

## Usage

This package can be used with `npx`

```bash
npx https://github.com/Buuhuu/merge-json-cli --in ./input.json --out ./output.json
```

or it can be installed and ran as package script

```bash
npm install --save-dev https://github.com/Buuhuu/merge-json-cli
```

### Arguments

- `--in|-i` the source file that should be read and merged
- `--out|-o` the target file the result should be written to

## Implementation

The semantics of the syntax for merging objects and arrays is similar to the spread syntax in JavaScript. The keys of the referenced file will be included at the position of and replace the spread operator. 

When merging arrays it is possible to specifc a glob pattern that matches many files. Each matched file will be merged, and if the spread operator is the only key in the source object the target object will replace it entirely. This allows also for merging arrays into an array.

### Merging objects

For example, given the following input.json

```json
{
    "key1": "value1",
    "...": "./other.json",
    "key2": "value2"
}
```

and other.json

```json
{
    "other-key1": "other-value1",
    "other-key2": "other-value2"
}
```

will be merged to 

```json
{
    "key1": "value1",
    "other-key1": "other-value1",
    "other-key2": "other-value2",
    "key2": "value2"
}
```

It is also possible to reference nested objects in other files

```json
{
    "...": "./other.json#/some/key"
}
```

### Merging Arrays

When merging arrays path patterns can be used to merge 0..n objects into the array

```json
[
    { "...": "../*/component.json" }
]
````

If the source object only contains the spread operator and the target object is an array, the array items will be spliced into the source array at the position of the source object.