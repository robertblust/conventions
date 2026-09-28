// The run over the chains the owner chose, level by level. It reads each member again before it
// moves it, so a release made at one level is there to take at the next, and it holds every
// member downstream of one it had to block.
import { readMember, assessPins, releaseBlock } from './assess.mjs';
import { releasesIn } from './graph.mjs';
import { pinKey } from './pins.mjs';
import { releaseNotes } from './words.mjs';

export const nextMinor = (tag) => {
  const m = tag?.match(/^v?(\d+)\.(\d+)\.\d+$/);
  return m ? `v${m[1]}.${Number(m[2]) + 1}.0` : 'v0.1.0';
};

export function orchestrate({ report, selection, github, member, date, log = () => {} }) {
  const chosen = selection === 'all' ? report.chains : report.chains.filter((c) => selection.includes(c.n));
  const starts = new Set(chosen.map((c) => pinKey(c)));
  const closure = new Set(chosen.flatMap((c) => c.steps.flat()));
  const levelOf = new Map(report.members.map((m) => [m.repo, m.level]));
  const family = new Set(report.members.map((m) => m.repo));
  const state = new Map();
  const record = [];
  const top = Math.max(0, ...[...closure].map((r) => levelOf.get(r) ?? 0));
  for (let l = 1; l <= top; l++) {
    const cache = new Map();
    for (const repo of [...closure].filter((r) => levelOf.get(r) === l).sort()) {
      const finish = (status, extra = {}) => {
        state.set(repo, status);
        record.push({ repo, status, ...extra });
        log(`${repo}: ${status}${extra.reason ? ` — ${extra.reason}` : ''}`);
      };
      const waits = report.edges.filter((e) => e.from === repo && ['blocked', 'held'].includes(state.get(e.to))).map((e) => e.to);
      if (waits.length) { finish('held', { reason: `waits on ${waits.join(', ')}` }); continue; }
      const current = readMember(github, repo);
      if (!current.declared) { finish('skipped', { reason: 'no pins.json' }); continue; }
      const pins = assessPins(github, current, family, cache).filter((p) => p.status === 'behind' && (starts.has(pinKey(p)) || closure.has(p.upstream)));
      if (!pins.length) { finish('skipped', { reason: 'nothing to move' }); continue; }
      const releasing = releasesIn(repo, closure, report.edges);
      const unreleased = releasing ? releaseBlock(github, repo) : null;
      if (unreleased) { finish('blocked', { reason: unreleased }); continue; }
      try {
        const landed = member.update(repo, pins, { date, verify: current.declared.verify ?? [] });
        const release = releasing
          ? member.release(repo, nextMinor(github.latestRelease(repo)?.tag), releaseNotes(pins), current.declared.release ?? [], { date }).tag
          : null;
        finish('done', { pr: landed.pr, merge: landed.merge, release, note: landed.note ?? null });
      } catch (e) {
        finish('blocked', { reason: e.message });
      }
    }
  }
  return record;
}
