// What each pin of a member is against what its upstream offers, and whether a member other
// members take by tag has work on main that no release describes.
import { KINDS, SCANNED, discover, validatePins } from './pins.mjs';
import { NON_PROPAGATING } from './graph.mjs';

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

// A check in a member's verify list that compares a generated file with what its writer would
// write fails as soon as a move changes what that writer writes, unless a step the run takes
// before verify runs the writer. So a verify entry's `npm run <name>:check`, where package.json
// has a script `<name>` and no pin's `after` or `move` runs `npm run <name>` as a whole command,
// is a step pins.json is missing. A script that runs the check from inside another script is not
// seen.
const WORD_END = '(?=$|[\\s;&|)])';
const runs = (cmd, name) => new RegExp(`(^|[\\s;&|(])npm run ${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}${WORD_END}`).test(cmd);
export function missingSteps(member) {
  const declared = member.declared;
  const raw = member.texts?.['package.json'];
  if (!declared || raw === undefined) return [];
  let scripts;
  try {
    scripts = JSON.parse(raw).scripts ?? {};
  } catch {
    return [];
  }
  const steps = (declared.pins ?? []).flatMap((p) => [...(p.after ?? []), ...(p.move ? [p.move] : [])]);
  const names = new Set();
  for (const entry of declared.verify ?? []) {
    for (const m of entry.matchAll(new RegExp(`(?:^|[\\s;&|(])npm run ([\\w.:-]+):check${WORD_END}`, 'g'))) names.add(m[1]);
  }
  return [...names]
    .filter((name) => Object.hasOwn(scripts, name) && !steps.some((cmd) => runs(cmd, name)))
    .sort()
    .map((name) => ({ check: `${name}:check`, step: `npm run ${name}` }));
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

// Whether a pull request merged into main moved one of the member's declared pins other than the
// conventions pins, which a hand move owes no release for: the pin reads values in its file at both
// the merge commit's first parent, the commit the merge followed (a stacked pull request's base is
// not that commit), and the merge, and the two share no value. A pin added or removed has not
// moved, and neither has one that keeps any value it had, so a pull request that brings in or drops
// a dependency, or an entry of one beside another it leaves, is work; the run's own resync settles
// a pin moved in part. For a member with no such pin, the merge commit and the pin files are not
// read. Every pin whose file reads at both refs is judged first; only when none moved and a file
// could not be read does it throw, and the caller treats that as a move it could not prove: a
// commit that only re-synced stays a re-sync, any other counts as work.
function movedPin(github, repo, pull, declared) {
  if (pull.base !== 'main') return false;
  const pins = (declared?.pins ?? []).filter((p) => !NON_PROPAGATING.has(p.kind));
  if (!pins.length) return false;
  const before = github.commit(repo, pull.merge).parent;
  let unreadable = null;
  for (const d of pins) {
    try {
      const read = (ref) => {
        const text = ref == null ? null : github.file(repo, d.file, ref);
        if (text === null) throw new Error(`${repo}: ${d.file} at ${ref} cannot be read`);
        return KINDS[d.kind].read(text, d.repo);
      };
      const was = read(before);
      const is = read(pull.merge);
      if (was.length && is.length && !was.some((v) => is.includes(v))) return true;
    } catch (e) {
      unreadable ??= e;
    }
  }
  if (unreadable) throw unreadable;
  return false;
}

const declaredPins = (github, repo) => {
  try {
    return validatePins(JSON.parse(github.file(repo, 'pins.json')));
  } catch {
    return null;
  }
};

// The commits on main since the latest release, each judged once: the run's own (a resync pull
// request, a re-sync, or a pull request that moved one of the member's declared pins, whose
// every commit counts, the fix that came with the move included) or work. A merge commit only
// carries the others and is not counted either way. A commit that cannot be read counts as work,
// because blocking is the side a wrong guess can be undone from, and so does every commit past
// the most the compare lists. A pin move that cannot be proved, because a pin file cannot be read,
// does not make a re-sync work: it only fails to count as the run's. `carried` holds the hand
// pull requests the run's notes name.
function scanUnreleased(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return { rel: null };
  const c = github.compare(repo, rel.tag, 'main');
  const declared = declaredPins(github, repo);
  const carried = new Map();
  const commits = [];
  let work = Math.max(0, c.aheadBy - c.shas.length);
  const unread = [];
  for (const sha of c.shas) {
    try {
      const heads = github.pullHeads(repo, sha);
      if (heads.some((h) => h.startsWith('resync-'))) {
        commits.push({ sha, resync: true, vendored: !heads.some((h) => h.startsWith('resync-') && !h.startsWith('resync-vendored-')) });
        continue;
      }
      const commit = github.commit(repo, sha);
      if (commit.parents !== 1) continue;
      let moved = null;
      let unproven = null;
      try {
        for (const p of github.pullsOf(repo, sha)) {
          try {
            if (p.merge && movedPin(github, repo, p, declared)) {
              moved = p;
              break;
            }
          } catch (e) {
            unproven ??= e;
          }
        }
      } catch (e) {
        unproven ??= e;
      }
      if (moved) {
        carried.set(moved.number, { number: moved.number, title: moved.title, url: moved.url });
        commits.push({ sha, subject: commit.subject, pinMove: true });
        continue;
      }
      const only = resyncOnly(github, repo, sha, commit);
      if (unproven && !only) throw unproven;
      commits.push({ sha, subject: commit.subject, resyncOnly: only });
      if (!only) work += 1;
    } catch (e) {
      work += 1;
      unread.push(e.message);
    }
  }
  return { rel, aheadBy: c.aheadBy, work, unread, carried: [...carried.values()], commits };
}

// A member others take by tag owes no release for what the run or the conventions sync wrote,
// only for work a person did that moved none of its pins, and that work is what blocks it: a
// release the run cut over it would carry notes no one wrote. A merge commit only carries the
// others, so it is not counted either way; its content is in the commits it merged. A merge
// commit not from a `resync-` pull request is therefore not counted, accepted because its merged
// commits are, though a conflict resolved inside a merge is not seen. A commit that cannot be
// read counts as work, because blocking is the side a wrong guess can be undone from, and so
// does every commit past the most the compare lists, since it was never read at all.
export function releaseBlock(github, repo) {
  const s = scanUnreleased(github, repo);
  if (!s.rel) return 'has no release to follow';
  if (s.aheadBy === 0 || s.work === 0) return null;
  const why = s.unread.length ? `, ${plural(s.unread.length, 'commit')} could not be read: ${s.unread[0]}` : '';
  return `unreleased work on main: ${plural(s.work, 'commit')} since ${s.rel.tag}${why}`;
}

// What a release of this member would carry, for its notes: the hand pull requests, and whether
// a resync pull request other than a vendored one merged pins, so the notes credit the resync
// only where it moved something.
export function carriedWork(github, repo) {
  const s = scanUnreleased(github, repo);
  if (!s.rel || s.work > 0) return { pulls: [], resynced: false };
  return { pulls: s.carried, resynced: s.commits.some((c) => c.resync && !c.vendored) };
}

// The hand pull requests a release of this member would carry.
export const handPulls = (github, repo) => carriedWork(github, repo).pulls;

// What the conventions sync writes into a member, and the files beside it a member keeps by
// hand that no consumer builds from: pins.json, the conventions workflow, the excludes in
// conventions.json, CLAUDE.md, and .github/dependabot.yml, whose family ignores PINS.md asks
// for. A commit that touches nothing else is a re-sync, a formality a release still owes but no
// one has to read, so a hand edit to one of these files counts as re-sync only by design.
const VENDORED = new Set(['conventions.json', 'pins.json', 'AGENTS.md', 'CLAUDE.md', '.markdownlint-cli2.jsonc', '.github/workflows/conventions.yml', '.github/dependabot.yml']);
export const isVendored = (path) => path.startsWith('conventions/') || VENDORED.has(path);

// AGENTS.md is vendored only in its block; the rest of it is the member's own, so a commit that
// changes the rest is work however little it changed.
// The opening line is the sync's own form, OPEN_RE in conventions/conventions-sync.
const CONVENTIONS_BLOCK = /^<!-- conventions · v[^ \n]* -->\n[\s\S]*?^<!-- end conventions -->$\n?/m;
const ownText = (text) => (text ?? '').replace(CONVENTIONS_BLOCK, '');

// Whether a commit only re-synced: it changed something, everything it changed is vendored, and
// AGENTS.md, if it is among them, is the same outside the block as at its parent. A merge commit
// never is. A caller that already read the commit passes it.
export function resyncOnly(github, repo, sha, commit = github.commit(repo, sha)) {
  const { parents, parent, files } = commit;
  if (parents !== 1 || files.length === 0 || !files.every(isVendored)) return false;
  if (!files.includes('AGENTS.md')) return true;
  return ownText(github.file(repo, 'AGENTS.md', sha)) === ownText(github.file(repo, 'AGENTS.md', parent));
}

// The commits on main since the latest release, so the owner can tell a re-sync from real work
// before deciding what to release. Merge commits are left out: they only carry the others. A
// commit that cannot be read costs the list, not the report: the compare link still stands.
export function unreleasedCommits(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return null;
  const c = github.compare(repo, rel.tag, 'main');
  if (c.aheadBy <= 0) return null;
  const found = { since: rel.tag, compare: `https://github.com/${repo}/compare/${rel.tag}...main` };
  const commits = [];
  const moves = new Set(scanUnreleased(github, repo).commits?.filter((c) => c.pinMove).map((c) => c.sha) ?? []);
  try {
    for (const sha of c.shas) {
      const commit = github.commit(repo, sha);
      if (commit.parents !== 1) continue;
      commits.push({ sha, subject: commit.subject, resyncOnly: resyncOnly(github, repo, sha, commit), ...(moves.has(sha) ? { pinMove: true } : {}) });
    }
  } catch (e) {
    return { ...found, commits: null, error: e.message };
  }
  return { ...found, commits };
}

// Whether main's checks pass, so a red main is seen in the report and not first when the run
// blocks on it.
// A main with no check runs is `none`, which the report shows as green.
// The scheduled report runs as a check on conventions' own main, so it would read that main as
// pending while it runs, and as red the day after it failed; the workflow names its own check in
// FAMILY_REPORT_IGNORE_CHECKS, comma-separated, and a check named there is not counted.
const FAILED = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
const ignoredChecks = () => new Set((process.env.FAMILY_REPORT_IGNORE_CHECKS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
export function mainState(github, repo) {
  const ignored = ignoredChecks();
  const runs = github.checks(repo).filter((r) => !ignored.has(r.name));
  const failing = [...new Set(runs.filter((r) => r.status === 'completed' && FAILED.has(r.conclusion)).map((r) => r.name))].sort();
  if (failing.length) return { state: 'red', failing };
  if (runs.some((r) => r.status !== 'completed')) return { state: 'pending', failing: [] };
  return { state: runs.length ? 'green' : 'none', failing: [] };
}

// A member whose main holds only the run's own work since its last release, a resync pull
// request or a pin a person moved by hand, has a release a rerun can finish, though nothing in it
// is behind. A re-sync, by the run or by hand, may sit beside that work, since it owes no release
// of its own; a re-sync alone owes none. With no work left, every other commit is one of these.
export function pendingRelease(github, repo) {
  const s = scanUnreleased(github, repo);
  if (!s.rel || s.aheadBy <= 0 || s.work > 0) return false;
  return s.commits.some((c) => c.pinMove || (c.resync && !c.vendored));
}
