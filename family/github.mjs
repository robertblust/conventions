// What the report and the run read from GitHub, as five questions. A test answers them from
// fixtures instead; the scripts ask nothing else.
import { ghOrNull } from './gh.mjs';

export function realGithub() {
  const json = (path) => {
    const out = ghOrNull(['api', path]);
    return out === null ? null : JSON.parse(out);
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
      return json(`repos/${repo}/commits/main`).sha;
    },
    compare(repo, base, head) {
      const c = json(`repos/${repo}/compare/${base}...${head}`);
      return { aheadBy: c.ahead_by, shas: c.commits.map((x) => x.sha), files: (c.files ?? []).map((f) => f.filename) };
    },
    pullHeads(repo, sha) {
      return (json(`repos/${repo}/commits/${sha}/pulls`) ?? []).filter((p) => p.head.repo?.full_name === repo).map((p) => p.head.ref);
    },
  };
}
