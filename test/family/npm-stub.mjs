// An npm for the tests: records every call and creates node_modules where the real npm would, so
// a worktree's own install is visible without reaching the real registry.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.NPM_STUB_DIR;
const args = process.argv.slice(2);
appendFileSync(join(dir, 'npm-calls.log'), `${args.join(' ')}\n`);
const i = args.indexOf('--prefix');
const prefix = i < 0 ? '.' : args[i + 1];
mkdirSync(join(process.cwd(), prefix, 'node_modules'), { recursive: true });
