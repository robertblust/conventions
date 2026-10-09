// GitHub for the tests: the same eight questions realGithub answers, answered from objects a test
// builds and may change as a run goes on. A file at another ref is keyed "<path>@<ref>", a commit
// "<repo>:<sha>", and a commit no test describes is a plain one that changed nothing. The checks
// fixture is exposed as `runs`, since `checks` is the question; a repository's runs may be a
// function, which a test uses to make reading them throw, and so may a commit. A commit's file may
// be a name or `{ filename, previous_filename }`, and a rename answers both names, as GitHub's
// does. A commit's pull requests for `pullsOf` are keyed `<repo>:<sha>` in `pullRecords`.
export function fakeGithub({ files = {}, releases = {}, heads = {}, compares = {}, pulls = {}, commits = {}, pullRecords = {}, checks = {}, unreachable = [] } = {}) {
  const gate = (repo) => {
    if (unreachable.includes(repo)) throw new Error(`gh api repos/${repo}: HTTP 403`);
  };
  return {
    files, releases, heads, compares, pulls, commits, pullRecords, runs: checks,
    file(repo, path, ref = 'main') { gate(repo); return files[repo]?.[ref === 'main' ? path : `${path}@${ref}`] ?? null; },
    latestRelease(repo) { gate(repo); return releases[repo] ?? null; },
    head(repo) { gate(repo); return heads[repo]; },
    compare(repo, base, head) { gate(repo); return compares[`${repo}:${base}...${head}`] ?? { aheadBy: 0, shas: [], files: [] }; },
    pullHeads(repo, sha) { gate(repo); return pulls[`${repo}:${sha}`] ?? []; },
    pullsOf(repo, sha) { gate(repo); return pullRecords[`${repo}:${sha}`] ?? []; },
    commit(repo, sha) {
      gate(repo);
      const c = commits[`${repo}:${sha}`] ?? { subject: sha, parents: 1, parent: `${sha}^`, files: [] };
      const read = typeof c === 'function' ? c() : c;
      return { ...read, files: read.files.flatMap((f) => (typeof f === 'string' ? [f] : [f.filename, ...(f.previous_filename ? [f.previous_filename] : [])])) };
    },
    checks(repo) { gate(repo); const c = checks[repo] ?? []; return typeof c === 'function' ? c() : c; },
  };
}
