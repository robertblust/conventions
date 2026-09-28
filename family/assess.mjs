// What each pin of a member is against what its upstream offers, and whether a member other
// members take by tag has work on main that no release describes.
import { KINDS, SCANNED, discover, validatePins } from './pins.mjs';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function readMember(github, repo) {
  const raw = github.file(repo, 'pins.json');
  let declared = null;
  let invalid = null;
  if (raw !== null) {
    try {
      declared = validatePins(JSON.parse(raw));
    } catch (e) {
      invalid = e.message;
    }
  }
  const paths = new Set([...SCANNED, ...(declared?.pins ?? []).map((p) => p.file)]);
  const texts = {};
  for (const path of paths) {
    const text = github.file(repo, path);
    if (text !== null) texts[path] = text;
  }
  return { repo, declared, invalid, texts };
}

function offered(github, cache, kind, repo) {
  const key = `${kind}|${repo}`;
  if (!cache.has(key)) {
    let value;
    if (kind === 'core-release') {
      // An instance records the meta-model release it took as `tooling`, a version without its v.
      const rel = github.latestRelease(repo);
      value = { available: rel ? rel.tag.replace(/^v/, '') : null, url: rel?.url ?? null };
    } else if (KINDS[kind].byTag) {
      const rel = github.latestRelease(repo);
      value = { available: rel?.tag ?? null, url: rel?.url ?? null };
    } else {
      value = { available: github.head(repo), url: `https://github.com/${repo}` };
    }
    cache.set(key, value);
  }
  return cache.get(key);
}

export function assessPins(github, member, family, cache = new Map()) {
  const found = Object.entries(member.texts).flatMap(([file, text]) => discover(file, text));
  const declared = member.declared?.pins ?? [];
  const pins = [];
  for (const f of found) {
    if (f.repo === member.repo) continue;
    const text = member.texts[f.file];
    const kind = KINDS[f.kind];
    const entry = declared.find((d) => d.kind === f.kind && d.file === f.file && d.repo === f.repo) ?? null;
    const pin = { taker: member.repo, kind: f.kind, file: f.file, upstream: f.repo, pinned: kind.read(text, f.repo), entry };
    if (!family.has(f.repo)) {
      pins.push({ ...pin, status: 'outside' });
      continue;
    }
    const { available, url } = offered(github, cache, f.kind, f.repo);
    Object.assign(pin, { available, url });
    let behind = false;
    if (kind.byTag) {
      behind = available !== null && pin.pinned.some((p) => p !== available);
    } else {
      const watch = entry?.watch ?? kind.watch?.(text, f.repo) ?? null;
      for (const p of pin.pinned.filter((c) => c !== available)) {
        const c = github.compare(f.repo, p, available);
        const touched = !watch || c.files.some((file) => watch.some((w) => file === w || file.startsWith(`${w}/`)));
        if (c.aheadBy > 0 && touched) {
          behind = true;
          pin.behindBy = Math.max(pin.behindBy ?? 0, c.aheadBy);
        }
      }
    }
    pin.status = entry ? (behind ? 'behind' : 'current') : 'unmanaged';
    pins.push(pin);
  }
  for (const d of declared) {
    let there = false;
    try {
      there = member.texts[d.file] !== undefined && KINDS[d.kind].read(member.texts[d.file], d.repo).length > 0;
    } catch {
      there = false;
    }
    if (!there) pins.push({ taker: member.repo, kind: d.kind, file: d.file, upstream: d.repo, pinned: [], entry: d, status: 'drift' });
  }
  return pins;
}

export function releaseBlock(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return 'has no release to follow';
  const c = github.compare(repo, rel.tag, 'main');
  if (c.aheadBy === 0) return null;
  const ours = c.shas.every((sha) => github.pullHeads(repo, sha).some((h) => h.startsWith('resync-')));
  return ours ? null : `unreleased work on main: ${plural(c.aheadBy, 'commit')} since ${rel.tag}`;
}

// What the conventions sync writes into a member. A commit that touches nothing else is a
// re-sync, a formality a release still owes but no one has to read.
const VENDORED = new Set(['conventions.json', 'pins.json', 'AGENTS.md', 'CLAUDE.md', '.markdownlint-cli2.jsonc', '.github/workflows/conventions.yml']);
export const isVendored = (path) => path.startsWith('conventions/') || VENDORED.has(path);

// The commits on main since the latest release, so the owner can tell a re-sync from real work
// before deciding what to release. Merge commits are left out: they only carry the others.
export function unreleasedCommits(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return null;
  const c = github.compare(repo, rel.tag, 'main');
  if (c.aheadBy <= 0) return null;
  const commits = [];
  for (const sha of c.shas) {
    const { subject, parents, files } = github.commit(repo, sha);
    if (parents !== 1) continue;
    commits.push({ sha, subject, resyncOnly: files.length > 0 && files.every(isVendored) });
  }
  return { since: rel.tag, compare: `https://github.com/${repo}/compare/${rel.tag}...main`, commits };
}

// Whether main's checks pass, so a red main is seen in the report and not first when the run
// blocks on it.
const FAILED = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
export function mainState(github, repo) {
  const runs = github.checks(repo);
  const failing = [...new Set(runs.filter((r) => r.status === 'completed' && FAILED.has(r.conclusion)).map((r) => r.name))].sort();
  if (failing.length) return { state: 'red', failing };
  if (runs.some((r) => r.status !== 'completed')) return { state: 'pending', failing: [] };
  return { state: runs.length ? 'green' : 'none', failing: [] };
}

// True when a member's main is ahead of its latest release only by commits the run itself made
// (their pull request's head starts `resync-`), and at least one of them moved more than vendored
// files, so a rerun can finish the release the first run left undone instead of finding nothing
// behind and no chain to offer it in. A `resync-vendored-` merge alone is owed no release.
export function pendingRelease(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return false;
  const c = github.compare(repo, rel.tag, 'main');
  if (c.aheadBy <= 0) return false;
  const heads = c.shas.map((sha) => github.pullHeads(repo, sha));
  if (!heads.every((hs) => hs.some((h) => h.startsWith('resync-')))) return false;
  return heads.some((hs) => hs.some((h) => h.startsWith('resync-') && !h.startsWith('resync-vendored-')));
}
