// GitHub for the tests: the same five questions realGithub answers, answered from objects a test
// builds and may change as a run goes on. A file at another ref is keyed "<path>@<ref>".
export function fakeGithub({ files = {}, releases = {}, heads = {}, compares = {}, pulls = {}, unreachable = [] } = {}) {
  const gate = (repo) => {
    if (unreachable.includes(repo)) throw new Error(`gh api repos/${repo}: HTTP 403`);
  };
  return {
    files, releases, heads, compares, pulls,
    file(repo, path, ref = 'main') { gate(repo); return files[repo]?.[ref === 'main' ? path : `${path}@${ref}`] ?? null; },
    latestRelease(repo) { gate(repo); return releases[repo] ?? null; },
    head(repo) { gate(repo); return heads[repo]; },
    compare(repo, base, head) { gate(repo); return compares[`${repo}:${base}...${head}`] ?? { aheadBy: 0, shas: [], files: [] }; },
    pullHeads(repo, sha) { gate(repo); return pulls[`${repo}:${sha}`] ?? []; },
  };
}
