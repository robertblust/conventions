// The report as Markdown for a person: counts first and what blocks, then whose main is not green,
// then one table per level, the chains a resync can choose from, and what disagrees. The run
// record's Note column carries a member's note and each step or check that passed on a retry.
import { shortV, longDate, plural, listed } from './words.mjs';

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const statusText = (p) => (p.status === 'behind' && p.behindBy ? `behind, ${plural(p.behindBy, 'commit')}` : p.status);

export function renderReport(data) {
  const count = (s) => data.pins.filter((p) => p.status === s).length;
  const lines = [`# Family resync report, ${longDate(data.date)}`, ''];
  lines.push(`${count('behind')} behind, ${count('current')} current, ${count('unmanaged')} unmanaged, ${count('drift')} drift.`, '');
  const blocked = data.members.filter((m) => m.blocked);
  if (blocked.length) {
    lines.push('Blocked:', '');
    for (const m of blocked) {
      lines.push(`- ${m.repo}: ${m.blocked}`);
      if (!m.unreleased) continue;
      lines.push(`  - [${m.unreleased.since}...main](${m.unreleased.compare})`);
      if (!m.unreleased.commits) lines.push(`  - the commits could not be read: ${cell(m.unreleased.error)}`);
      for (const c of m.unreleased.commits ?? []) lines.push(`  - ${c.sha.slice(0, 7)} ${cell(c.subject)}${c.resyncOnly ? ' (re-sync only)' : ''}${c.pinMove ? ' (pin move)' : ''}`);
    }
    lines.push('');
  }
  lines.push('## Main', '');
  const unwell = data.members.filter((m) => m.main && !['green', 'none'].includes(m.main.state));
  if (!unwell.length) lines.push("Every member's main is green.");
  for (const m of unwell) {
    if (m.main.state === 'red') lines.push(`- ${m.repo}: main is red (${m.main.failing.map(cell).join(', ')}), so the run will block here`);
    else if (m.main.state === 'pending') lines.push(`- ${m.repo}: main's checks are still running`);
    else lines.push(`- ${m.repo}: main's checks could not be read`);
  }
  lines.push('');
  const levels = [...new Set(data.members.map((m) => m.level).filter((l) => l !== null))].sort((a, b) => a - b);
  for (const l of levels) {
    const repos = data.members.filter((m) => m.level === l).map((m) => m.repo).sort();
    const rows = data.pins
      .filter((p) => repos.includes(p.taker) && p.status !== 'outside')
      .sort((a, b) => a.taker.localeCompare(b.taker) || a.upstream.localeCompare(b.upstream));
    lines.push(`## Level ${l}`, '');
    if (!rows.length) {
      lines.push(`Nothing in the family is pinned here: ${repos.join(', ')}.`, '');
      continue;
    }
    lines.push('| Member | Pin | Upstream | Pinned | Available | Status |', '| --- | --- | --- | --- | --- | --- |');
    for (const p of rows) {
      lines.push(`| ${p.taker} | ${p.kind} \`${p.file}\` | ${p.upstream} | ${p.pinned.map(shortV).join(', ') || '—'} | ${shortV(p.available)} | ${statusText(p)} |`);
    }
    lines.push('');
  }
  lines.push('## Chains', '');
  if (!data.chains.length) lines.push('Nothing is behind.');
  for (const c of data.chains) {
    const head = c.kind === 'release' ? `${c.taker} has unreleased resync work` : `${c.upstream} ${shortV(c.available)}`;
    lines.push(`${c.n}. ${head} → ${c.steps.map((s) => s.join(', ')).join(' → ')}`);
  }
  lines.push('');
  if (data.problems.length) {
    lines.push('## What disagrees', '');
    for (const p of data.problems) lines.push(`- ${p.repo}: ${cell(p.text)}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderRecord(record, date, dryRun, left = []) {
  const lines = [`# Family resync run, ${longDate(date)}${dryRun ? ' (dry run)' : ''}`, ''];
  if (!record.length) return `${lines[0]}\n\nThe choice moved nothing.\n`;
  lines.push('| Member | Status | Pull request | Merge | Release | Note |', '| --- | --- | --- | --- | --- | --- |');
  for (const r of record) {
    lines.push(`| ${r.repo} | ${r.status} | ${r.pr ?? ''} | ${r.merge ? shortV(r.merge) : ''} | ${r.release ?? ''} | ${cell([r.reason ?? r.note, ...(r.retries ?? [])].filter(Boolean).join('; '))} |`);
  }
  if (left.length) lines.push('', `Left for a later run: ${listed(left)}.`);
  return `${lines.join('\n')}\n`;
}
