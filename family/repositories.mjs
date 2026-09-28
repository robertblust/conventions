// The family as REPOSITORIES.md writes it: the members of its table, and the pairs its drawing
// of what pins what connects, as "<from>><to>".
export function parseMembers(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^\| ([\w.-]+\/[\w.-]+) \| ([^|]+) \|/))
    .filter(Boolean)
    .map((m) => ({ repo: m[1], title: m[2].trim() }));
}

export function parseDrawing(markdown) {
  const pairs = new Set();
  const block = markdown.match(/^```mermaid\n([\s\S]*?)^```$/m);
  if (!block) return pairs;
  const repoOf = {};
  const edges = [];
  let org = null;
  for (const line of block[1].split('\n')) {
    const sub = line.match(/^\s*subgraph (\S+)/);
    if (sub) { org = sub[1]; continue; }
    if (/^\s*end\s*$/.test(line)) { org = null; continue; }
    const edge = line.match(/^\s*(.+?)\s*-->\s*(?:\|[^|]*\|\s*)?(.+?)\s*$/);
    if (edge) { edges.push([edge[1], edge[2]]); continue; }
    const node = line.match(/^\s*(\w+)\[([^\]]+)\]\s*$/);
    if (node && org) repoOf[node[1]] = `${org}/${node[2]}`;
  }
  const ids = (s) => s.split('&').map((x) => x.trim());
  for (const [from, to] of edges) for (const a of ids(from)) for (const b of ids(to)) pairs.add(`${repoOf[a]}>${repoOf[b]}`);
  return pairs;
}

// The local path the table gives a repository, its last column, as conventions/hooks/commit-msg
// reads it; null where the table has no row for it.
export function localPathOf(markdown, repo) {
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells[1] === repo && cells.length > 3) return cells[cells.length - 2] || null;
  }
  return null;
}
