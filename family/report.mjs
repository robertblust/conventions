#!/usr/bin/env node
// The family report: every member's pins read from GitHub and set against what each upstream
// offers. `node family/report.mjs` writes dist/resync-<date>.md and .json and prints the path of
// the Markdown; it writes nothing else.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parseMembers, parseDrawing } from './repositories.mjs';
import { readMember, assessPins, missingSteps, releaseBlock, pendingRelease, unreleasedCommits, mainState } from './assess.mjs';
import { edgesOf, levelsOf, chainsOf, stepsOf, CONVENTIONS, TAG_KINDS } from './graph.mjs';
import { renderReport } from './render.mjs';
import { realGithub } from './github.mjs';

export const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
export const today = () => new Date().toLocaleDateString('en-CA');

export function assessFamily({ github, members, drawing, date }) {
  const repos = members.map((m) => m.repo);
  const family = new Set(repos);
  const cache = new Map();
  const pins = [];
  const managed = new Map();
  const problems = [];
  const main = new Map();
  for (const repo of repos) {
    try {
      const member = readMember(github, repo);
      managed.set(repo, member.declared !== null);
      try {
        main.set(repo, mainState(github, repo));
      } catch {
        main.set(repo, { state: 'unknown', failing: [] });
      }
      if (member.invalid) problems.push({ type: 'invalid', repo, text: `pins.json: ${member.invalid}` });
      for (const { check, step } of missingSteps(member)) problems.push({ type: 'missing-step', repo, text: `pins.json never runs \`${step}\`, which \`${check}\` in its verify checks` });
      pins.push(...assessPins(github, member, family, cache));
    } catch (e) {
      problems.push({ type: 'unreachable', repo, text: e.message });
    }
  }
  const edges = edgesOf(pins);
  const { level, cycles } = levelsOf(repos.filter((r) => managed.has(r)), edges);
  const blocked = new Map();
  const unreleased = new Map();
  for (const cycle of cycles) for (const r of cycle) blocked.set(r, `on a cycle: ${cycle.join(' → ')}`);
  const takenByTag = new Set(edges.filter((e) => e.to !== CONVENTIONS && e.kinds.some((k) => TAG_KINDS.has(k))).map((e) => e.to));
  for (const r of takenByTag) {
    if (blocked.has(r) || !managed.get(r)) continue;
    const reason = releaseBlock(github, r);
    if (reason) {
      blocked.set(r, reason);
      unreleased.set(r, unreleasedCommits(github, r));
    }
  }
  for (const e of edges) {
    if (e.to !== CONVENTIONS && !drawing.has(`${e.from}>${e.to}`)) problems.push({ type: 'undrawn', repo: e.from, text: `pins ${e.to}, which the drawing in REPOSITORIES.md does not show` });
  }
  for (const p of pins) if (p.status === 'outside') problems.push({ type: 'outside', repo: p.taker, text: `pins ${p.upstream} in ${p.file}, which is not in the family` });
  // A member a later level takes by tag whose main holds only the run's own resync commits still
  // ahead of its last release has a release a rerun can finish, though nothing in it is behind.
  // Only a declared pin is a promise the run can act on, so the edge that offers the chain is
  // built from declared pins alone, unlike `takenByTag` above, which the blocked check keeps
  // wide because an undeclared pin still leaves the upstream's own main unreleased.
  const declaredEdges = edgesOf(pins.filter((p) => p.entry));
  const takenByDeclaredTag = new Set(declaredEdges.filter((e) => e.to !== CONVENTIONS && e.kinds.some((k) => TAG_KINDS.has(k))).map((e) => e.to));
  const pending = new Set();
  for (const r of takenByDeclaredTag) {
    if (blocked.has(r) || !managed.get(r)) continue;
    if (pendingRelease(github, r)) pending.add(r);
  }
  const chains = chainsOf(pins, edges, level);
  let n = chains.length;
  for (const repo of [...pending].sort()) {
    n += 1;
    chains.push({ n, taker: repo, kind: 'release', file: null, upstream: repo, available: 'unreleased', steps: stepsOf(repo, edges, level) });
  }
  return {
    date,
    members: repos.map((repo) => ({ repo, level: level.get(repo) ?? null, managed: managed.get(repo) ?? false, blocked: blocked.get(repo) ?? null, unreleased: unreleased.get(repo) ?? null, main: main.get(repo) ?? null, pending: pending.has(repo) })),
    pins,
    edges,
    chains,
    problems,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const markdown = readFileSync(join(HERE, 'conventions/REPOSITORIES.md'), 'utf8');
  const date = today();
  const data = assessFamily({ github: realGithub(), members: parseMembers(markdown), drawing: parseDrawing(markdown), date });
  const out = join(HERE, 'dist');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `resync-${date}.json`), `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(join(out, `resync-${date}.md`), renderReport(data));
  console.log(join(out, `resync-${date}.md`));
}
