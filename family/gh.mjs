// Every call to GitHub goes through gh, and every call to gh goes through here, so a test puts
// its own gh first on the path and sees each call the scripts make.
import { execFileSync } from 'node:child_process';

export function gh(args, { cwd } = {}) {
  try {
    return execFileSync('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = new Error(`gh ${args.join(' ')}: ${String(e.stderr || e.message).trim()}`);
    err.notFound = /HTTP 404/.test(String(e.stderr));
    throw err;
  }
}

export function ghOrNull(args) {
  try {
    return gh(args);
  } catch (e) {
    if (e.notFound) return null;
    throw e;
  }
}
