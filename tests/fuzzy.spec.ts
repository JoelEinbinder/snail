import { test, expect } from './fixtures';
import { FilePathScoreFunction } from '../src/FilePathScoreFunction';
import fs from 'fs';
test('score correctly', async ({ }) => {
  const scorer = new FilePathScoreFunction('hand');
  const items = [
    '/foo/bar/baz',
    '/foo/bar/handle.js',
    '/abc/h/woo/ndle.js',
  ];
  const sortedItems = items.map(title => {
    const score = scorer.calculateScore(title, null);
    return {title, score};
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 100);
  expect(sortedItems).toEqual([
    { title: '/foo/bar/handle.js', score: 28142 },
    { title: '/abc/h/woo/ndle.js', score: 16110 },
    { title: '/foo/bar/baz', score: 244 },
  ]);
});
test('quickly render a big file', async ({ }) => {
  const scorer = new FilePathScoreFunction('hand');
  const items: string[] = JSON.parse(fs.readFileSync(require.resolve('./resources/filenames.json'), 'utf8'));
  console.time('fuzzy');
  const sortedItems = items.map(title => {
    const score = scorer.calculateScore(title, null);
    return {title, score};
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 100);
  console.timeEnd('fuzzy');
});
