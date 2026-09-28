import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, discover, validatePins, pinKey } from '../../family/pins.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('a conventions pin reads and writes its tag and nothing else', () => {
  const text = '{ "repo": "robertblust/conventions", "tag": "v1.34.0", "exclude": ["meta"] }\n';
  assert.deepEqual(KINDS.conventions.read(text), ['v1.34.0']);
  assert.equal(KINDS.conventions.write(text, 'robertblust/conventions', 'v1.35.0'), '{ "repo": "robertblust/conventions", "tag": "v1.35.0", "exclude": ["meta"] }\n');
});

test('an npm pin moves only its own repository', () => {
  const text = '{ "a": "github:companygraph/meta-model#v0.55.0", "b": "github:companygraph/mcp-server#v0.38.0" }';
  assert.deepEqual(KINDS['npm-tag'].read(text, 'companygraph/meta-model'), ['v0.55.0']);
  assert.equal(KINDS['npm-tag'].write(text, 'companygraph/meta-model', 'v0.56.0'), '{ "a": "github:companygraph/meta-model#v0.56.0", "b": "github:companygraph/mcp-server#v0.38.0" }');
});

test('a source pin finds its object at the top or under a key', () => {
  const top = `{"repo": "robertblust/mental-model", "commit": "${A}"}`;
  const keyed = `{"meta-model":{"repo":"companygraph/meta-model","commit":"${A}"},"mental-model":{"repo":"companygraph/mental-model","commit":"${B}"}}`;
  assert.deepEqual(KINDS['source-commit'].read(top, 'robertblust/mental-model'), [A]);
  assert.equal(KINDS['source-commit'].write(keyed, 'companygraph/mental-model', C), keyed.replace(B, C));
});

test('a contract pin moves every string of its repository and watches their paths', () => {
  const text = `{ "sources": [ "guestgraph/engine@${A}:specs/005/contracts/a.yaml", "guestgraph/engine@${B}:specs/009/contracts/b.yaml" ] }`;
  assert.deepEqual(KINDS['contract-commit'].read(text, 'guestgraph/engine'), [A, B]);
  assert.deepEqual(KINDS['contract-commit'].watch(text, 'guestgraph/engine'), ['specs/005/contracts/a.yaml', 'specs/009/contracts/b.yaml']);
  const moved = KINDS['contract-commit'].write(text, 'guestgraph/engine', C);
  assert.deepEqual(KINDS['contract-commit'].read(moved, 'guestgraph/engine'), [C]);
});

test('a core pin reads core.version and is moved only by its own command', () => {
  assert.deepEqual(KINDS['core-release'].read('{"tooling":"0.57.0","core":{"version":"0.46.0"}}'), ['0.46.0']);
  assert.equal(KINDS['core-release'].write, null);
});

test('discover finds the pins of every scanned file', () => {
  const kinds = (ps) => ps.map((p) => `${p.kind} ${p.repo}`);
  assert.deepEqual(kinds(discover('conventions.json', '{"repo":"robertblust/conventions","tag":"v1.0.0"}')), ['conventions robertblust/conventions']);
  assert.deepEqual(kinds(discover('service-conventions.json', '{"repo":"guestgraph/service-conventions","tag":"v0.10.1"}')), ['service-conventions guestgraph/service-conventions']);
  assert.deepEqual(kinds(discover('chat/package.json', '{"x":"github:companygraph/chat-server#v0.17.3","y":"github:robertblust/design#v0.87.0"}')), ['npm-tag companygraph/chat-server', 'npm-tag robertblust/design']);
  assert.deepEqual(kinds(discover('api-sources.json', `{"engine":{"repo":"guestgraph/engine","commit":"${A}"}}`)), ['source-commit guestgraph/engine']);
  assert.deepEqual(kinds(discover('src/main/resources/api/sources.json', `{"sources":["guestgraph/engine@${A}:x.yaml","guestgraph/engine@${B}:y.yaml"]}`)), ['contract-commit guestgraph/engine']);
  assert.deepEqual(kinds(discover('.companygraph/manifest.json', '{"core":{"version":"0.46.0"}}')), ['core-release companygraph/meta-model']);
  assert.deepEqual(discover('source.json', 'not json'), []);
  assert.deepEqual(discover('package.json', '{"name":"no pins"}'), []);
  assert.deepEqual(discover('conventions.json', '{ "exclude": ["docs/superpowers"], "format-exclude": [] }'), []);
});

test('validatePins refuses what the run could not follow', () => {
  assert.throws(() => validatePins({}), /no "pins" list/);
  assert.throws(() => validatePins({ pins: [{ kind: 'svn', file: 'x', repo: 'a/b' }] }), /unknown kind/);
  assert.throws(() => validatePins({ pins: [{ kind: 'npm-tag', repo: 'a/b' }] }), /needs "file" and "repo"/);
  assert.throws(() => validatePins({ pins: [{ kind: 'core-release', file: '.companygraph/manifest.json', repo: 'companygraph/meta-model' }] }), /needs "move"/);
  assert.throws(() => validatePins({ pins: [{ kind: 'npm-tag', file: 'package.json', repo: 'a/b', after: 'npm run x' }] }), /"after" is a list/);
  assert.throws(() => validatePins({ pins: [], verify: 'npm test' }), /"verify" is a list/);
});

test('the example in PINS.md is a valid pins.json', () => {
  const md = readFileSync(new URL('../../conventions/PINS.md', import.meta.url), 'utf8');
  validatePins(JSON.parse(md.match(/```json\n([\s\S]*?)```/)[1]));
});

test('a pin key names the member, the kind, the file and the upstream', () => {
  assert.equal(pinKey({ taker: 'a/b', kind: 'npm-tag', file: 'package.json', upstream: 'c/d' }), 'a/b|npm-tag|package.json|c/d');
});
