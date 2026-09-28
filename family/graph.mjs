// The family as a graph: an edge from each member to what it pins, a level for each member one
// above the highest level of what it pins, and the chains a behind pin starts.
import { KINDS } from './pins.mjs';

export const CONVENTIONS = 'robertblust/conventions';
export const TAG_KINDS = new Set(Object.keys(KINDS).filter((k) => KINDS[k].byTag));

export function edgesOf(pins) {
  const seen = new Map();
  for (const p of pins) {
    if (p.status === 'outside' || p.status === 'drift') continue;
    const key = `${p.taker}>${p.upstream}`;
    const e = seen.get(key) ?? { from: p.taker, to: p.upstream, kinds: [] };
    if (!e.kinds.includes(p.kind)) e.kinds.push(p.kind);
    seen.set(key, e);
  }
  return [...seen.values()];
}

export function levelsOf(repos, edges) {
  const ups = new Map(repos.map((r) => [r, []]));
  for (const e of edges) ups.get(e.from)?.push(e.to);
  const level = new Map();
  const open = new Set();
  const cycles = [];
  const visit = (r, stack) => {
    if (level.has(r)) return level.get(r);
    if (open.has(r)) {
      cycles.push(stack.slice(stack.indexOf(r)));
      return null;
    }
    open.add(r);
    let l = 0;
    for (const u of ups.get(r) ?? []) {
      const lu = visit(u, [...stack, r]);
      l = lu === null || l === null ? null : Math.max(l, lu + 1);
    }
    open.delete(r);
    level.set(r, l);
    return l;
  };
  for (const r of repos) visit(r, []);
  return { level, cycles };
}

export function downstreamOf(repo, edges) {
  const out = new Set();
  const walk = (r) => {
    for (const e of edges) {
      if (e.to === r && !out.has(e.from)) {
        out.add(e.from);
        walk(e.from);
      }
    }
  };
  walk(repo);
  return out;
}

export function stepsOf(repo, edges, level) {
  const byLevel = new Map();
  for (const r of [repo, ...downstreamOf(repo, edges)]) {
    const l = level.get(r);
    if (l === null || l === undefined) continue;
    byLevel.set(l, [...(byLevel.get(l) ?? []), r]);
  }
  return [...byLevel.keys()].sort((a, b) => a - b).map((l) => byLevel.get(l).sort());
}

export function chainsOf(pins, edges, level) {
  const rank = (p) => level.get(p.taker) ?? Infinity;
  return pins
    .filter((p) => p.status === 'behind')
    .sort((a, b) => rank(a) - rank(b) || a.taker.localeCompare(b.taker) || a.upstream.localeCompare(b.upstream))
    .map((p, i) => ({ n: i + 1, taker: p.taker, kind: p.kind, file: p.file, upstream: p.upstream, available: p.available, steps: stepsOf(p.taker, edges, level) }));
}

export function releasesIn(repo, closure, edges) {
  if (repo === CONVENTIONS) return false;
  return edges.some((e) => e.to === repo && closure.has(e.from) && e.kinds.some((k) => TAG_KINDS.has(k)));
}
