// The kinds of pin conventions/PINS.md defines: how each reads its line, how it writes a new
// value into it, and what runs after. `discover` finds the pins a member's files hold whether or
// not its pins.json declares them, so the report can name the ones it does not.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const uniq = (xs) => [...new Set(xs)];

function sourceObjects(obj) {
  if (obj && obj.repo && obj.commit) return [obj];
  return Object.values(obj ?? {}).filter((v) => v && typeof v === 'object' && v.repo && v.commit);
}

function setJsonString(text, key, value) {
  const re = new RegExp(`("${key}"\\s*:\\s*")[^"]*"`);
  if (!re.test(text)) throw new Error(`no "${key}" to set`);
  return text.replace(re, `$1${value}"`);
}

export const KINDS = {
  conventions: {
    byTag: true,
    read: (text) => [JSON.parse(text).tag],
    write: (text, repo, value) => setJsonString(text, 'tag', value),
    commands: ['sh conventions/conventions-sync sync'],
  },
  'service-conventions': {
    byTag: true,
    read: (text) => [JSON.parse(text).tag],
    write: (text, repo, value) => setJsonString(text, 'tag', value),
    commands: ['sh service-conventions/service-conventions-sync sync'],
  },
  'npm-tag': {
    byTag: true,
    read: (text, repo) => uniq([...text.matchAll(new RegExp(`"github:${esc(repo)}#([^"]+)"`, 'g'))].map((m) => m[1])),
    write: (text, repo, value) => text.replace(new RegExp(`("github:${esc(repo)}#)[^"]+"`, 'g'), `$1${value}"`),
    commands: ['npm install'],
  },
  'source-commit': {
    byTag: false,
    read: (text, repo) => uniq(sourceObjects(JSON.parse(text)).filter((o) => o.repo === repo).map((o) => o.commit)),
    write: (text, repo, value) => KINDS['source-commit'].read(text, repo).reduce((out, c) => out.split(c).join(value), text),
    commands: [],
  },
  'contract-commit': {
    byTag: false,
    read: (text, repo) => uniq([...text.matchAll(new RegExp(`${esc(repo)}@([0-9a-f]{7,40}):`, 'g'))].map((m) => m[1])),
    write: (text, repo, value) => text.replace(new RegExp(`(${esc(repo)}@)[0-9a-f]{7,40}:`, 'g'), `$1${value}:`),
    watch: (text, repo) => uniq([...text.matchAll(new RegExp(`${esc(repo)}@[0-9a-f]{7,40}:([^"\\s]+)`, 'g'))].map((m) => m[1])),
    commands: [],
  },
  'core-release': {
    byTag: true,
    read: (text) => [JSON.parse(text).tooling].filter(Boolean),
    write: null,
    commands: [],
  },
};

// The files a member may hold a pin in, beside any its pins.json names.
export const SCANNED = [
  'conventions.json',
  'service-conventions.json',
  'package.json',
  'chat/package.json',
  'source.json',
  'api-sources.json',
  '.companygraph/manifest.json',
  'src/main/resources/api/sources.json',
];

export function discover(file, text) {
  const base = file.split('/').pop();
  const as = (kind, repos) => uniq(repos.filter(Boolean)).map((repo) => ({ kind, file, repo }));
  try {
    if (file === 'conventions.json') return as('conventions', [JSON.parse(text).repo]);
    if (file === 'service-conventions.json') return as('service-conventions', [JSON.parse(text).repo]);
    if (file.endsWith('api/sources.json')) return as('contract-commit', [...text.matchAll(/"([\w.-]+\/[\w.-]+)@[0-9a-f]{7,40}:/g)].map((m) => m[1]));
    if (base === 'package.json') return as('npm-tag', [...text.matchAll(/"github:([\w.-]+\/[\w.-]+)#[^"]+"/g)].map((m) => m[1]));
    if (base === 'source.json' || base === 'api-sources.json') return as('source-commit', sourceObjects(JSON.parse(text)).map((o) => o.repo));
    if (file === '.companygraph/manifest.json') return JSON.parse(text).tooling ? as('core-release', ['companygraph/meta-model']) : [];
  } catch {
    return [];
  }
  return [];
}

export const pinKey = (p) => `${p.taker}|${p.kind}|${p.file}|${p.upstream}`;

export function validatePins(obj) {
  if (!obj || !Array.isArray(obj.pins)) throw new Error('pins.json has no "pins" list');
  for (const [i, p] of obj.pins.entries()) {
    const at = `pins[${i}]`;
    if (!KINDS[p.kind]) throw new Error(`${at}: unknown kind "${p.kind}"`);
    if (typeof p.file !== 'string' || typeof p.repo !== 'string') throw new Error(`${at}: needs "file" and "repo"`);
    if (p.kind === 'core-release' && typeof p.move !== 'string') throw new Error(`${at}: a core-release pin needs "move"`);
    for (const k of ['after', 'watch']) if (p[k] !== undefined && !Array.isArray(p[k])) throw new Error(`${at}: "${k}" is a list`);
  }
  for (const k of ['verify', 'release']) if (obj[k] !== undefined && !Array.isArray(obj[k])) throw new Error(`"${k}" is a list`);
  return obj;
}
