import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseNotes, pendingNotes, withCarried } from '../../family/words.mjs';

const pin = { upstream: 'o/meta', file: 'package.json', pinned: ['v1.0.0'], available: 'v2.0.0', url: 'um' };
const pull = (title) => ({ number: 7, title, url: 'u7' });

test('notes that carry nothing are the run\'s notes', () => {
  assert.equal(withCarried(releaseNotes([pin]), []), releaseNotes([pin]));
  assert.equal(withCarried(pendingNotes(), []), pendingNotes());
});

test('a title ending in a period gives one period, not two', () => {
  assert.match(withCarried(pendingNotes(), [pull('Takes meta v2.0.0.')]), /made by hand: Takes meta v2\.0\.0\.\n/);
  assert.doesNotMatch(withCarried(pendingNotes(), [pull('Takes meta v2.0.0.')]), /\.\./);
  assert.match(withCarried(pendingNotes(), [pull('Takes meta v2.0.0')]), /made by hand: Takes meta v2\.0\.0\.\n/);
});

test('notes that carry a hand pull request no longer say they change nothing else', () => {
  const pending = withCarried(pendingNotes(), [pull('Takes meta v2.0.0')]);
  assert.match(pending, /^This release carries pins the family resync already merged\.\n\nIt also carries \[#7\]\(u7\), made by hand: Takes meta v2\.0\.0\.\n\nNothing breaks\./);
  const taken = withCarried(releaseNotes([pin]), [pull('Takes meta v2.0.0')]);
  assert.match(taken, /^This release takes newer pins: o\/meta in `package.json` from v1\.0\.0 to v2\.0\.0\. Their notes are at um\.\n\nIt also carries/);
  assert.equal(taken.split('\n\n')[0].includes('changes nothing else'), false);
  assert.match(taken, /A repository that takes this one re-pins it and changes nothing else\./);
});
