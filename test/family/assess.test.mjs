import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMember, assessPins, releaseBlock } from '../../family/assess.mjs';
import { fakeGithub } from './fake-github.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const conv = (tag) => `{"repo":"robertblust/conventions","tag":"${tag}"}`;
const FAMILY = new Set(['robertblust/conventions', 'robertblust/design', 'robertblust/site', 'robertblust/model']);

function family(overrides = {}) {
  return fakeGithub({
    files: {
      'robertblust/conventions': { 'conventions.json': conv('v1.0.0') },
      'robertblust/site': {
        'conventions.json': conv('v0.9.0'),
        'package.json': '{"d":"github:robertblust/design#v2.0.0","x":"github:someone/else#v1"}',
        'source.json': `{"repo":"robertblust/model","commit":"${A}"}`,
        'pins.json': JSON.stringify({ pins: [
          { kind: 'conventions', file: 'conventions.json', repo: 'robertblust/conventions' },
          { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design' },
          { kind: 'source-commit', file: 'source.json', repo: 'robertblust/model', watch: ['model'] },
          { kind: 'npm-tag', file: 'chat/package.json', repo: 'robertblust/design' },
        ] }),
      },
      'robertblust/model': { 'conventions.json': conv('v1.0.0') },
    },
    releases: { 'robertblust/conventions': { tag: 'v1.0.0', url: 'u1' }, 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } },
    heads: { 'robertblust/model': B },
    compares: { [`robertblust/model:${A}...${B}`]: { aheadBy: 3, shas: [], files: ['model/x.md'] } },
    ...overrides,
  });
}
const status = (pins) => Object.fromEntries(pins.map((p) => [`${p.kind} ${p.file} ${p.upstream}`, p.status]));

test('each pin of a member gets its status', () => {
  const gh = family();
  const pins = assessPins(gh, readMember(gh, 'robertblust/site'), FAMILY);
  assert.deepEqual(status(pins), {
    'conventions conventions.json robertblust/conventions': 'behind',
    'npm-tag package.json robertblust/design': 'behind',
    'npm-tag package.json someone/else': 'outside',
    'source-commit source.json robertblust/model': 'behind',
    'npm-tag chat/package.json robertblust/design': 'drift',
  });
  const model = pins.find((p) => p.upstream === 'robertblust/model');
  assert.equal(model.behindBy, 3);
  assert.equal(model.available, B);
});

test('a commit pin whose watched paths did not change is current', () => {
  const gh = family({ compares: { [`robertblust/model:${A}...${B}`]: { aheadBy: 3, shas: [], files: ['docs/y.md'] } } });
  const pins = assessPins(gh, readMember(gh, 'robertblust/site'), FAMILY);
  assert.equal(pins.find((p) => p.upstream === 'robertblust/model').status, 'current');
});

test('a member without pins.json has only unmanaged pins', () => {
  const gh = family();
  const pins = assessPins(gh, readMember(gh, 'robertblust/model'), FAMILY);
  assert.deepEqual(pins.map((p) => p.status), ['unmanaged']);
});

test('a member pinning itself is not a pin', () => {
  const gh = family();
  assert.deepEqual(assessPins(gh, readMember(gh, 'robertblust/conventions'), FAMILY), []);
});

test('an invalid pins.json is reported and its pins are unmanaged', () => {
  const gh = family();
  gh.files['robertblust/model']['pins.json'] = '{"pins": "no"}';
  const member = readMember(gh, 'robertblust/model');
  assert.match(member.invalid, /no "pins" list/);
  assert.deepEqual(assessPins(gh, member, FAMILY).map((p) => p.status), ['unmanaged']);
});

test('work on main since the last release blocks a release unless the run made it', () => {
  const gh = family({ compares: { 'robertblust/design:v2.1.0...main': { aheadBy: 1, shas: ['s1'], files: [] } } });
  assert.equal(releaseBlock(gh, 'robertblust/design'), 'unreleased work on main: 1 commit since v2.1.0');
  gh.pulls['robertblust/design:s1'] = ['resync-2026-09-28'];
  assert.equal(releaseBlock(gh, 'robertblust/design'), null);
  assert.equal(releaseBlock(gh, 'robertblust/model'), 'has no release to follow');
});

test('a core pin is behind when meta-model has a newer release than the tooling the instance took', () => {
  const gh = fakeGithub({
    files: {
      'robertblust/model': {
        '.companygraph/manifest.json': '{"tooling":"0.57.0","core":{"version":"0.46.0"}}',
        'pins.json': JSON.stringify({ pins: [{ kind: 'core-release', file: '.companygraph/manifest.json', repo: 'companygraph/meta-model', move: 'upgrade {version}' }] }),
      },
    },
    releases: { 'companygraph/meta-model': { tag: 'v0.58.0', url: 'um' } },
  });
  const [pin] = assessPins(gh, readMember(gh, 'robertblust/model'), new Set(['robertblust/model', 'companygraph/meta-model']));
  assert.deepEqual([pin.pinned, pin.available, pin.status], [['0.57.0'], '0.58.0', 'behind']);
});
