// What the report and the run read from GitHub, as eight questions. A test answers them from
// fixtures instead; the scripts ask nothing else.
import { ghOrNull } from './gh.mjs';

export function realGithub() {
  const json = (path) => {
    const out = ghOrNull(['api', path]);
    return out === null ? null : JSON.parse(out);
  };
  const found = (repo, path) => {
    const out = json(path);
    if (out === null) throw new Error(`${repo}: GitHub has nothing at ${path}`);
    return out;
  };
  return {
    file(repo, path, ref = 'main') {
      return ghOrNull(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`]);
    },
    latestRelease(repo) {
      const r = json(`repos/${repo}/releases/latest`);
      return r && { tag: r.tag_name, url: r.html_url };
    },
    head(repo) {
      return found(repo, `repos/${repo}/commits/main`).sha;
    },
    compare(repo, base, head) {
      const c = found(repo, `repos/${repo}/compare/${base}...${head}`);
      return { aheadBy: c.ahead_by, shas: c.commits.map((x) => x.sha), files: (c.files ?? []).map((f) => f.filename) };
    },
    pullHeads(repo, sha) {
      return (json(`repos/${repo}/commits/${sha}/pulls`) ?? []).filter((p) => p.head.repo?.full_name === repo).map((p) => p.head.ref);
    },
    pullsOf(repo, sha) {
      return (json(`repos/${repo}/commits/${sha}/pulls`) ?? [])
        .filter((p) => p.head.repo?.full_name === repo && p.merged_at)
        .map((p) => ({ number: p.number, title: p.title, url: p.html_url, head: p.head.ref, base: p.base.ref, merge: p.merge_commit_sha }));
    },
    commit(repo, sha) {
      const c = found(repo, `repos/${repo}/commits/${sha}`);
      return { subject: c.commit.message.split('\n')[0], parents: c.parents.length, parent: c.parents[0]?.sha ?? null, files: (c.files ?? []).flatMap((f) => (f.previous_filename ? [f.filename, f.previous_filename] : [f.filename])) };
    },
    checks(repo) {
      const c = found(repo, `repos/${repo}/commits/main/check-runs?per_page=100`);
      return c.check_runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
    },
  };
}
