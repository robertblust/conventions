import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgesOf, levelsOf, downstreamOf, chainsOf, releasesIn } from '../../family/graph.mjs';

const pin = (taker, upstream, kind = 'npm-tag', status = 'current', available = 'v2') => ({ taker, upstream, kind, file: 'package.json', status, available, pinned: ['v1'] });
const pins = [
  pin('design', 'robertblust/conventions', 'conventions'),
  pin('meta', 'robertblust/conventions', 'conventions'),
  pin('server', 'meta', 'npm-tag', 'behind'),
  pin('chat', 'server'),
  pin('site', 'server'),
  pin('site', 'design'),
  pin('deploy', 'chat'),
  pin('deploy', 'model', 'source-commit'),
  pin('site', 'else', 'npm-tag', 'outside'),
];
const repos = ['robertblust/conventions', 'design', 'meta', 'server', 'chat', 'site', 'deploy', 'model'];

test('an edge joins a member and what it pins, outside pins aside', () => {
  const edges = edgesOf(pins);
  assert.ok(edges.some((e) => e.from === 'site' && e.to === 'design'));
  assert.ok(!edges.some((e) => e.to === 'else'));
});

test('a level is one above the highest level of what a member pins', () => {
  const { level, cycles } = levelsOf(repos, edgesOf(pins));
  assert.deepEqual(Object.fromEntries(level), { 'robertblust/conventions': 0, design: 1, meta: 1, server: 2, chat: 3, site: 3, deploy: 4, model: 0 });
  assert.deepEqual(cycles, []);
});

test('a cycle is named and its members have no level', () => {
  const { level, cycles } = levelsOf(['a', 'b', 'c'], edgesOf([pin('a', 'b'), pin('b', 'a'), pin('c', 'a')]));
  assert.equal(cycles.length, 1);
  assert.deepEqual([...cycles[0]].sort(), ['a', 'b']);
  assert.equal(level.get('a'), null);
  assert.equal(level.get('c'), null);
});

test('a chain carries a behind pin through everything downstream, level by level', () => {
  const edges = edgesOf(pins);
  const { level } = levelsOf(repos, edges);
  assert.deepEqual([...downstreamOf('server', edges)].sort(), ['chat', 'deploy', 'site']);
  const [chain] = chainsOf(pins, edges, level);
  assert.deepEqual(chain, { n: 1, taker: 'server', kind: 'npm-tag', file: 'package.json', upstream: 'meta', available: 'v2', steps: [['server'], ['chat', 'site'], ['deploy']] });
});

test('a member is released when a later member of the run takes it by tag', () => {
  const edges = edgesOf(pins);
  assert.equal(releasesIn('server', new Set(['server', 'chat']), edges), true);
  assert.equal(releasesIn('model', new Set(['model', 'deploy']), edges), false);
  assert.equal(releasesIn('server', new Set(['server']), edges), false);
  assert.equal(releasesIn('robertblust/conventions', new Set(['design']), edges), false);
});
