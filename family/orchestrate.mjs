// The run over the chains and members the owner chose, level by level. It reads each member
// again before it moves it, so a release made at one level is there to take at the next, and it holds every
// member downstream of one it had to block or found unmanaged. A member `releasesIn` counts is
// decided from declared pins alone, so an upstream one takes in a file its pins.json does not
// name never causes a release; and a member whose pins already moved but whose own release the
// last run left undone is released again here rather than skipped as having nothing to move. A
// member that moved only its conventions or service-conventions pin is not released for that
// move, though a release an earlier run left undone is still finished. A step or a required check
// that passed only on its second try leaves the member done, and the record names each one.
import { readMember, assessPins, releaseBlock, pendingRelease, handPulls } from './assess.mjs';
import { releasesIn, edgesOf, downstreamOf, NON_PROPAGATING } from './graph.mjs';
import { pinKey } from './pins.mjs';
import { releaseNotes, pendingNotes, withCarried } from './words.mjs';

export const nextMinor = (tag) => {
  const m = tag?.match(/^v?(\d+)\.(\d+)\.\d+$/);
  if (!m) throw new Error(`cannot take the next minor of ${tag}`);
  return `v${m[1]}.${Number(m[2]) + 1}.0`;
};

// A choice the report cannot answer stops the run before it moves anything.
export const choiceError = (message) => Object.assign(new Error(message), { choice: true });

// The run's members from the owner's choice: each chosen chain's steps, and each named member
// alone. `starts` are the pins the choice itself moves; a member reached through `closure` also
// moves a pin whose upstream the run moves before it.
export function membersOf(report, selection) {
  const picks = selection === 'all' ? report.chains.map((c) => c.n) : selection;
  const chosen = [...new Set(picks.filter((p) => typeof p === 'number'))].map((n) => {
    const c = report.chains.find((c) => c.n === n);
    if (!c) throw choiceError(`no chain ${n} in the report`);
    return c;
  });
  const starts = new Set(chosen.map((c) => pinKey(c)));
  const closure = new Set(chosen.flatMap((c) => c.steps.flat()));
  for (const name of new Set(picks.filter((p) => typeof p === 'string'))) {
    const found = report.members.find((m) => m.repo === name);
    if (!found) throw choiceError(`no member ${name} in the report`);
    const behind = report.pins.filter((p) => p.taker === name && p.status === 'behind' && p.entry);
    if (!behind.length) throw choiceError(`${name} has no pin behind in the report`);
    // A member on a cycle has no level, so the run would never reach it.
    if (found.level == null) throw choiceError(`${name} has no level to move at`);
    for (const p of behind) starts.add(pinKey(p));
    closure.add(name);
  }
  return { chosen, starts, closure };
}

// The members downstream of what a choice names that it does not move itself, so the run record
// says what the next run would take. Only a named member with a pin behind that propagates
// leaves anything, and only through a declared pin that propagates, as a chain starts and a run
// releases; a taker through an undeclared pin is left alone by every run. A choice of chains
// alone leaves nothing behind.
export function leftBehind(report, selection) {
  if (selection === 'all') return [];
  const { closure } = membersOf(report, selection);
  const edges = edgesOf(report.pins.filter((p) => p.entry)).filter((e) => e.kinds.some((k) => !NON_PROPAGATING.has(k)));
  const names = selection.filter((p) => typeof p === 'string' && report.pins.some((q) => q.taker === p && q.status === 'behind' && q.entry && !NON_PROPAGATING.has(q.kind)));
  const below = new Set(names.flatMap((n) => [...downstreamOf(n, edges)]));
  return [...below].filter((r) => !closure.has(r)).sort();
}

export function orchestrate({ report, selection, github, member, date, dryRun = false, log = () => {}, record = [] }) {
  const { starts, closure } = membersOf(report, selection);
  const managedEdges = edgesOf(report.pins.filter((p) => p.entry));
  const levelOf = new Map(report.members.map((m) => [m.repo, m.level]));
  const family = new Set(report.members.map((m) => m.repo));
  const state = new Map();
  const holds = new Set(['blocked', 'held', 'unmanaged']);
  // A dry run releases nothing, so what takes a member it would have released finds nothing
  // behind; it says what it would re-pin instead of that it has nothing to move.
  const wouldRelease = new Set();
  // A release answers its tag, a note where its bump could not be authored as the Implementer,
  // and the steps and checks that passed only when tried again.
  const release = (repo, tag, notes, ...rest) => {
    const { tag: released, note = null, retries = [] } = member.release(repo, tag, withCarried(notes, handPulls(github, repo)), ...rest);
    if (dryRun) wouldRelease.add(repo);
    return { tag: released, note, retries };
  };
  const retried = (...lists) => {
    const all = lists.flatMap((l) => l ?? []);
    return all.length ? { retries: all } : {};
  };
  const notes = (...xs) => [...new Set(xs.filter(Boolean).flatMap((x) => x.split('; ')))].join('; ') || null;
  const top = Math.max(0, ...[...closure].map((r) => levelOf.get(r) ?? 0));
  for (let l = 1; l <= top; l++) {
    const cache = new Map();
    for (const repo of [...closure].filter((r) => levelOf.get(r) === l).sort()) {
      const waits = report.edges.filter((e) => e.from === repo && holds.has(state.get(e.to))).map((e) => e.to);
      // Anything that throws, a read of GitHub as much as a step of the member, blocks this member
      // alone; what it landed before it threw stays in its record.
      let landed = null;
      let outcome;
      try {
        outcome = waits.length ? ['held', { reason: `waits on ${waits.join(', ')}` }] : advance(repo, cache, (l2) => { landed = l2; });
      } catch (e) {
        outcome = ['blocked', { reason: e.message, ...(landed ? { pr: landed.pr, merge: landed.merge, ...retried(landed.retries) } : {}) }];
      }
      const [status, extra] = outcome;
      state.set(repo, status);
      record.push({ repo, status, ...extra });
      log(`${repo}: ${status}${extra.reason ? ` — ${extra.reason}` : ''}`);
    }
  }
  return record;

  function advance(repo, cache, landedWith) {
    const current = readMember(github, repo);
    if (!current.declared) return ['unmanaged', { reason: 'no pins.json' }];
    const pins = assessPins(github, current, family, cache).filter((p) => p.status === 'behind' && (starts.has(pinKey(p)) || closure.has(p.upstream)));
    const releasing = releasesIn(repo, closure, managedEdges);
    if (!pins.length) {
      if (releasing && pendingRelease(github, repo)) {
        const unreleased = releaseBlock(github, repo);
        if (unreleased) return ['blocked', { reason: unreleased }];
        const r = release(repo, nextMinor(github.latestRelease(repo)?.tag), pendingNotes(), current.declared.release ?? [], { date });
        return ['done', { release: r.tag, ...(r.note ? { note: r.note } : {}), ...retried(r.retries) }];
      }
      const upstreams = managedEdges.filter((e) => e.from === repo && wouldRelease.has(e.to) && e.kinds.some((k) => !NON_PROPAGATING.has(k))).map((e) => e.to).sort();
      if (!upstreams.length) return ['skipped', { reason: 'nothing to move' }];
      if (releasing) wouldRelease.add(repo);
      return ['skipped', { reason: `would re-pin ${upstreams.join(', ')} once ${upstreams.length === 1 ? 'it releases' : 'they release'}` }];
    }
    const releases = releasing && pins.some((p) => !NON_PROPAGATING.has(p.kind));
    const unreleased = releases ? releaseBlock(github, repo) : null;
    if (unreleased) return ['blocked', { reason: unreleased }];
    const landed = member.update(repo, pins, { date, verify: current.declared.verify ?? [] });
    landedWith(landed);
    let released = { tag: null, note: null, retries: [] };
    if (releases) {
      released = release(repo, nextMinor(github.latestRelease(repo)?.tag), releaseNotes(pins), current.declared.release ?? [], { date });
    } else if (releasing && pendingRelease(github, repo)) {
      // Only vendored pins moved, but an earlier run left a release undone that a later level
      // of this run takes, so it is finished here as on the pending path.
      const blocked = releaseBlock(github, repo);
      if (blocked) return ['blocked', { reason: blocked, pr: landed.pr, merge: landed.merge, ...retried(landed.retries) }];
      released = release(repo, nextMinor(github.latestRelease(repo)?.tag), pendingNotes(), current.declared.release ?? [], { date });
    }
    return ['done', { pr: landed.pr, merge: landed.merge, release: released.tag, note: notes(landed.note, released.note), ...retried(landed.retries, released.retries) }];
  }
}
