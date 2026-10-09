import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMember, assessPins, releaseBlock, handPulls, pendingRelease, unreleasedCommits, isVendored, resyncOnly, mainState, missingSteps } from '../../family/assess.mjs';
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

test('unreleased commits name each non-merge commit since the release and whether it only re-synced', () => {
  const gh = fakeGithub({
    releases: { 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } },
    compares: { 'robertblust/design:v2.1.0...main': { aheadBy: 3, shas: ['s1', 'm1', 's2'], files: [] } },
    commits: {
      'robertblust/design:s1': { subject: 'Takes conventions v1.35.0', parents: 1, files: ['conventions/WRITING.md', 'conventions.json', '.markdownlint-cli2.jsonc'] },
      'robertblust/design:m1': { subject: 'Merge pull request #9', parents: 2, files: ['tokens.css'] },
      'robertblust/design:s2': { subject: 'Tokens gain a spacing scale', parents: 1, files: ['tokens.css', 'AGENTS.md'] },
    },
  });
  assert.deepEqual(unreleasedCommits(gh, 'robertblust/design'), {
    since: 'v2.1.0',
    compare: 'https://github.com/robertblust/design/compare/v2.1.0...main',
    commits: [
      { sha: 's1', subject: 'Takes conventions v1.35.0', resyncOnly: true },
      { sha: 's2', subject: 'Tokens gain a spacing scale', resyncOnly: false },
    ],
  });
});

test('there are no unreleased commits without a release or when main is not ahead', () => {
  const gh = fakeGithub({ releases: { 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } } });
  assert.equal(unreleasedCommits(gh, 'robertblust/design'), null);
  assert.equal(unreleasedCommits(gh, 'robertblust/model'), null);
});

test('a vendored path is one the conventions sync writes', () => {
  for (const p of ['conventions/WRITING.md', 'conventions.json', 'pins.json', 'AGENTS.md', 'CLAUDE.md', '.markdownlint-cli2.jsonc', '.github/workflows/conventions.yml', '.github/dependabot.yml']) assert.equal(isVendored(p), true, p);
  for (const p of ['README.md', 'docs/conventions/x.md', '.github/workflows/test.yml', 'src/AGENTS.md']) assert.equal(isVendored(p), false, p);
});

test('main is red, pending, none or green by its check runs', () => {
  const run = (name, status, conclusion = null) => ({ name, status, conclusion });
  const state = (runs) => mainState(fakeGithub({ checks: { 'o/r': runs } }), 'o/r');
  assert.deepEqual(state([run('test', 'completed', 'failure'), run('conventions', 'completed', 'timed_out'), run('test', 'completed', 'failure'), run('build', 'in_progress'), run('lint', 'completed', 'success')]), { state: 'red', failing: ['conventions', 'test'] });
  assert.deepEqual(state([run('x', 'completed', 'cancelled'), run('a', 'completed', 'action_required')]), { state: 'red', failing: ['a', 'x'] });
  assert.deepEqual(state([run('test', 'completed', 'success'), run('build', 'queued')]), { state: 'pending', failing: [] });
  assert.deepEqual(state([]), { state: 'none', failing: [] });
  assert.deepEqual(state([run('test', 'completed', 'success'), run('skip', 'completed', 'skipped'), run('n', 'completed', 'neutral')]), { state: 'green', failing: [] });
});

test('a check FAMILY_REPORT_IGNORE_CHECKS names does not count toward main', (t) => {
  const run = (name, status, conclusion = null) => ({ name, status, conclusion });
  const state = (runs) => mainState(fakeGithub({ checks: { 'o/r': runs } }), 'o/r');
  const before = process.env.FAMILY_REPORT_IGNORE_CHECKS;
  t.after(() => {
    if (before === undefined) delete process.env.FAMILY_REPORT_IGNORE_CHECKS;
    else process.env.FAMILY_REPORT_IGNORE_CHECKS = before;
  });
  delete process.env.FAMILY_REPORT_IGNORE_CHECKS;
  assert.deepEqual(state([run('test', 'completed', 'success'), run('family report', 'in_progress')]), { state: 'pending', failing: [] });
  assert.deepEqual(state([run('test', 'completed', 'success'), run('family report', 'completed', 'failure')]), { state: 'red', failing: ['family report'] });
  process.env.FAMILY_REPORT_IGNORE_CHECKS = 'family report, other';
  assert.deepEqual(state([run('test', 'completed', 'success'), run('family report', 'in_progress')]), { state: 'green', failing: [] });
  assert.deepEqual(state([run('test', 'completed', 'success'), run('family report', 'completed', 'failure'), run('other', 'queued')]), { state: 'green', failing: [] });
  assert.deepEqual(state([run('family report', 'in_progress')]), { state: 'none', failing: [] });
  assert.deepEqual(state([run('test', 'in_progress'), run('family report', 'in_progress')]), { state: 'pending', failing: [] });
  process.env.FAMILY_REPORT_IGNORE_CHECKS = '';
  assert.deepEqual(state([run('family report', 'in_progress')]), { state: 'pending', failing: [] });
});

const BLOCK = '<!-- conventions · v1.35.0 -->\nShared conventions live in `conventions/`.\n<!-- end conventions -->\n';
const agents = (block, own) => `${block}${own}`;
function resyncWorld(extra = {}) {
  return fakeGithub({
    releases: { 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } },
    files: {
      'robertblust/design': {
        'AGENTS.md@in': agents(BLOCK.replace('v1.35.0', 'v1.36.0'), '# Own\n\nThe design system.\n'),
        'AGENTS.md@p-in': agents(BLOCK, '# Own\n\nThe design system.\n'),
        'AGENTS.md@out': agents(BLOCK, '# Own\n\nThe design system, edited by hand.\n'),
        'AGENTS.md@p-out': agents(BLOCK, '# Own\n\nThe design system.\n'),
      },
    },
    commits: {
      'robertblust/design:vend': { subject: 'Takes conventions v1.36.0', parents: 1, parent: 'p-vend', files: ['conventions/WRITING.md', 'conventions.json', 'pins.json'] },
      'robertblust/design:own': { subject: 'Tokens gain a spacing scale', parents: 1, parent: 'p-own', files: ['conventions.json', 'tokens.css'] },
      'robertblust/design:in': { subject: 'Takes conventions v1.36.0', parents: 1, parent: 'p-in', files: ['AGENTS.md', 'conventions/WORKING.md'] },
      'robertblust/design:out': { subject: 'Says more about the tokens', parents: 1, parent: 'p-out', files: ['AGENTS.md'] },
      'robertblust/design:merge': { subject: 'Merge pull request #9', parents: 2, parent: 'p-merge', files: ['conventions.json'] },
      'robertblust/design:empty': { subject: 'Nothing', parents: 1, parent: 'p-empty', files: [] },
    },
    ...extra,
  });
}

test('a commit is re-sync only when it changes vendored files alone and AGENTS.md only inside the block', () => {
  const gh = resyncWorld();
  assert.equal(resyncOnly(gh, 'robertblust/design', 'vend'), true);
  assert.equal(resyncOnly(gh, 'robertblust/design', 'own'), false);
  assert.equal(resyncOnly(gh, 'robertblust/design', 'in'), true);
  assert.equal(resyncOnly(gh, 'robertblust/design', 'out'), false);
  assert.equal(resyncOnly(gh, 'robertblust/design', 'merge'), false);
  assert.equal(resyncOnly(gh, 'robertblust/design', 'empty'), false);
});

// conventions v1.44.0 asks every member to ignore its family pins in .github/dependabot.yml, and
// no consumer builds from that file, so a commit that only adds those lines owes no release.
test('a commit that only changes .github/dependabot.yml is maintenance, not release work', () => {
  const gh = resyncWorld();
  gh.commits['robertblust/design:bot'] = { subject: "Dependabot leaves the family's pins alone", parents: 1, parent: 'p-bot', files: ['.github/dependabot.yml'] };
  gh.commits['robertblust/design:botcode'] = { subject: 'Dependabot and the tokens', parents: 1, parent: 'p-botcode', files: ['.github/dependabot.yml', 'tokens.css'] };
  assert.equal(resyncOnly(gh, 'robertblust/design', 'bot'), true);
  assert.equal(resyncOnly(gh, 'robertblust/design', 'botcode'), false, 'beside a file a consumer builds from, it is work');
});

test('an AGENTS.md missing on one side counts as empty', () => {
  const gh = resyncWorld();
  gh.commits['robertblust/design:new'] = { subject: 'Adds AGENTS.md', parents: 1, parent: 'p-new', files: ['AGENTS.md'] };
  gh.files['robertblust/design']['AGENTS.md@new'] = BLOCK;
  assert.equal(resyncOnly(gh, 'robertblust/design', 'new'), true);
  gh.files['robertblust/design']['AGENTS.md@new'] = `${BLOCK}Own text.\n`;
  assert.equal(resyncOnly(gh, 'robertblust/design', 'new'), false);
});

const since = (shas) => ({ compares: { 'robertblust/design:v2.1.0...main': { aheadBy: shas.length, shas, files: [] } } });

test('commits that only re-synced do not block a release', () => {
  assert.equal(releaseBlock(resyncWorld(since(['vend', 'in'])), 'robertblust/design'), null);
});

test('one real commit among re-sync-only ones blocks, counted alone', () => {
  assert.equal(releaseBlock(resyncWorld(since(['vend', 'out', 'in'])), 'robertblust/design'), 'unreleased work on main: 1 commit since v2.1.0');
});

test('the merge of a re-sync-only pull request does not block', () => {
  assert.equal(releaseBlock(resyncWorld(since(['vend', 'merge'])), 'robertblust/design'), null);
});

test('a commit that cannot be read blocks and says so', () => {
  const gh = resyncWorld(since(['vend', 'in']));
  gh.commits['robertblust/design:vend'] = () => { throw new Error('HTTP 502'); };
  assert.equal(releaseBlock(gh, 'robertblust/design'), 'unreleased work on main: 1 commit since v2.1.0, 1 commit could not be read: HTTP 502');
  const agentsFails = resyncWorld(since(['vend', 'in']));
  const file = agentsFails.file;
  agentsFails.file = (repo, path, ref) => { if (path === 'AGENTS.md') throw new Error('HTTP 500'); return file(repo, path, ref); };
  assert.match(releaseBlock(agentsFails, 'robertblust/design'), /^unreleased work on main: 1 commit since v2\.1\.0, 1 commit could not be read: HTTP 500$/);
});

test('a rename into a vendored path is not re-sync only', () => {
  const gh = resyncWorld();
  gh.commits['robertblust/design:mv'] = { subject: 'Moves x', parents: 1, parent: 'p-mv', files: [{ filename: 'conventions/x', previous_filename: 'src/x' }] };
  assert.equal(resyncOnly(gh, 'robertblust/design', 'mv'), false);
});

test('commits the compare does not list count as work', () => {
  const gh = resyncWorld({ compares: { 'robertblust/design:v2.1.0...main': { aheadBy: 252, shas: ['vend', 'in'], files: [] } } });
  assert.equal(releaseBlock(gh, 'robertblust/design'), 'unreleased work on main: 250 commits since v2.1.0');
});

test('a marker that only looks like the block is not the block', () => {
  const gh = resyncWorld();
  gh.commits['robertblust/design:local'] = { subject: 'Edits the local notes', parents: 1, parent: 'p-local', files: ['AGENTS.md'] };
  gh.files['robertblust/design']['AGENTS.md@local'] = '<!-- conventions-local -->\nNew notes.\n<!-- end conventions -->\n';
  gh.files['robertblust/design']['AGENTS.md@p-local'] = '<!-- conventions-local -->\nOld notes.\n<!-- end conventions -->\n';
  assert.equal(resyncOnly(gh, 'robertblust/design', 'local'), false);
});

// A member as readMember gives it: the declared pins.json and the package.json among its texts.
const site = ({ pins = [], verify, scripts = {} } = {}) => ({
  repo: 'robertblust/site',
  declared: { pins, ...(verify ? { verify } : {}) },
  invalid: null,
  texts: { 'package.json': JSON.stringify({ scripts }) },
});
const DESIGN = { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design' };

test('a check in verify whose writer no step runs is a missing step', () => {
  const member = site({ pins: [{ ...DESIGN, after: ['npm run design'] }], verify: ['npm run sitemap:check'], scripts: { sitemap: 'x', 'sitemap:check': 'y' } });
  assert.deepEqual(missingSteps(member), [{ check: 'sitemap:check', step: 'npm run sitemap' }]);
});

test('a writer a pin runs after its move is no missing step', () => {
  const member = site({ pins: [{ ...DESIGN, after: ['npm run design', 'npm run sitemap'] }], verify: ['npm run sitemap:check'], scripts: { sitemap: 'x' } });
  assert.deepEqual(missingSteps(member), []);
});

test('a check without a writer script is no missing step', () => {
  const member = site({ pins: [DESIGN], verify: ['npm run pin:check'], scripts: { 'pin:check': 'y' } });
  assert.deepEqual(missingSteps(member), []);
});

test('a writer a pin runs in its move is no missing step', () => {
  const core = { kind: 'core-release', file: '.companygraph/manifest.json', repo: 'companygraph/meta-model', move: 'npx core {version} && npm run og' };
  const member = site({ pins: [core], verify: ['npm run og:check'], scripts: { og: 'x' } });
  assert.deepEqual(missingSteps(member), []);
});

test('only the whole command counts as the writer', () => {
  const member = site({ pins: [{ ...DESIGN, after: ['npm run sitemap-x', 'npm run sitemap:check'] }], verify: ['npm run sitemap:check'], scripts: { sitemap: 'x', 'sitemap-x': 'z' } });
  assert.deepEqual(missingSteps(member), [{ check: 'sitemap:check', step: 'npm run sitemap' }]);
});

test('a compound verify entry is read for every check in it, each named once', () => {
  const member = site({
    pins: [{ ...DESIGN, after: ['npm run design'] }],
    verify: ['npm run verify && npx design links', 'npm run og:check && npm run sitemap:check', 'npm run sitemap:check'],
    scripts: { verify: 'v', og: 'x', sitemap: 'y' },
  });
  assert.deepEqual(missingSteps(member), [{ check: 'og:check', step: 'npm run og' }, { check: 'sitemap:check', step: 'npm run sitemap' }]);
});

test('a member without pins.json or package.json has no missing step', () => {
  assert.deepEqual(missingSteps({ ...site({ verify: ['npm run sitemap:check'], scripts: { sitemap: 'x' } }), declared: null }), []);
  assert.deepEqual(missingSteps({ ...site({ verify: ['npm run sitemap:check'] }), texts: {} }), []);
});

// A hand pull request #12 that moved design's pin on tokens, two commits: the move and a fix.
function handWorld(shas, { base = '{"t":"github:robertblust/tokens#v1.0.0"}', merge = '{"t":"github:robertblust/tokens#v2.0.0"}' } = {}) {
  const gh = resyncWorld(since(shas));
  gh.files['robertblust/design']['pins.json'] = JSON.stringify({ pins: [{ kind: 'npm-tag', file: 'package.json', repo: 'robertblust/tokens' }] });
  if (base !== null) gh.files['robertblust/design']['package.json@b12'] = base;
  gh.files['robertblust/design']['package.json@m12'] = merge;
  const pull = { number: 12, title: 'Takes tokens v2.0.0', url: 'https://github.com/robertblust/design/pull/12', head: 'tokens-2', base: 'b12', merge: 'm12' };
  gh.commits['robertblust/design:hand'] = { subject: 'Takes tokens v2.0.0', parents: 1, parent: 'p-hand', files: ['package.json', 'package-lock.json'] };
  gh.commits['robertblust/design:fix'] = { subject: 'The token test follows v2.0.0', parents: 1, parent: 'p-fix', files: ['test/tokens.test.mjs'] };
  gh.pullRecords['robertblust/design:hand'] = [pull];
  gh.pullRecords['robertblust/design:fix'] = [pull];
  return gh;
}

test('a merged pull request that moved a declared pin is the run\'s own work, its fix included', () => {
  assert.equal(releaseBlock(handWorld(['hand', 'fix']), 'robertblust/design'), null);
  assert.deepEqual(handPulls(handWorld(['hand', 'fix']), 'robertblust/design').map((p) => p.number), [12]);
});

test('a pull request that left the pin where it was blocks', () => {
  const same = '{"t":"github:robertblust/tokens#v1.0.0"}';
  assert.equal(releaseBlock(handWorld(['hand', 'fix'], { merge: same }), 'robertblust/design'), 'unreleased work on main: 2 commits since v2.1.0');
});

test('a pin-move pull request beside a feature commit blocks, counting the feature alone', () => {
  assert.equal(releaseBlock(handWorld(['hand', 'fix', 'own']), 'robertblust/design'), 'unreleased work on main: 1 commit since v2.1.0');
});

test('a pull request whose pin value cannot be read blocks', () => {
  assert.match(releaseBlock(handWorld(['hand'], { base: null }), 'robertblust/design'), /^unreleased work on main: 1 commit since v2\.1\.0, 1 commit could not be read/);
});

test('a commit in two pull requests counts as the run\'s when one of them moved a pin', () => {
  const gh = handWorld(['hand']);
  gh.pullRecords['robertblust/design:hand'] = [{ number: 11, title: 'Other', url: 'u11', head: 'other', base: 'm12', merge: 'm12' }, ...gh.pullRecords['robertblust/design:hand']];
  assert.equal(releaseBlock(gh, 'robertblust/design'), null);
});

test('a hand pin move makes a release pending, and the report lists its commits as pin moves', () => {
  const gh = handWorld(['hand', 'fix']);
  assert.equal(pendingRelease(gh, 'robertblust/design'), true);
  assert.deepEqual(unreleasedCommits(gh, 'robertblust/design').commits.map((c) => `${c.sha} ${c.pinMove}`), ['hand true', 'fix true']);
});
