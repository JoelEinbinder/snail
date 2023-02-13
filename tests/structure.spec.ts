import { test, expect } from './fixtures';
import path from 'path';
import fs from 'fs';

test('should have the same version number in all packages', async ({}) => {
  const packages = [
    path.join(__dirname, '..', 'package.json'),
    path.join(__dirname, '..', 'slug', 'package.json'),
  ];
  const versions = new Set(packages.map(p => JSON.parse(fs.readFileSync(p, 'utf8')).version));
  expect(versions.size).toBe(1);
  expect(typeof versions.values().next().value).toEqual('string');
});