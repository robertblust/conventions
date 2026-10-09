// How the family's generated text writes a version, a list and a date, so the report, the
// commits and the release notes read as the rest of the family does.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);
export const shortV = (v) => (isSha(v) ? v.slice(0, 7) : v ?? '—');
export const listed = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

const moves = (pins) => listed(pins.map((p) => `${p.upstream} in \`${p.file}\` from ${p.pinned.map(shortV).join(', ')} to ${shortV(p.available)}`));

// The trailers of every commit a resync run makes: a re-pin, a re-sync and a release bump are
// the Implementer's work in the Implement phase of Delivery, on its Code track.
export const TRAILERS = 'Process: Delivery\nPhase: Implement\nTrack: Code';

export function commitMessage(pins, ran) {
  const subject = `Takes ${listed([...new Set(pins.map((p) => `${p.upstream.split('/')[1]} ${shortV(p.available)}`))])}`;
  const notes = [...new Set(pins.map((p) => p.url).filter(Boolean))];
  const body = `The family resync moves ${moves(pins)}.${notes.length ? ` The upstream notes are at ${listed(notes)}.` : ''}`;
  const verified = ran.length ? `Verified: ${listed(ran.map((c) => `\`${c}\``))} passed.` : 'Verified: the move needed no command.';
  return { subject, body: `${body}\n\n${verified}`, full: `${subject}\n\n${body}\n\n${verified}\n\n${TRAILERS}\n` };
}

export function releaseNotes(pins) {
  const notes = [...new Set(pins.map((p) => p.url).filter(Boolean))];
  return `This release takes newer pins and changes nothing else: ${moves(pins)}.${notes.length ? ` Their notes are at ${listed(notes)}.` : ''}\n\nNothing breaks. A repository that takes this one re-pins it and changes nothing else.\n`;
}

// The release notes of a member whose unreleased work includes pull requests a person made to
// move its pins: the run's notes, with one line per pull request after their first paragraph. A
// hand pull request may change more than its pin, so that paragraph no longer says the release
// changes nothing else. A title keeps its words, and its own final period gives way to the line's.
export function withCarried(notes, pulls) {
  if (!pulls.length) return notes;
  const lines = pulls.map((p) => `It also carries [#${p.number}](${p.url}), made by hand: ${p.title.replace(/\.$/, '')}.`).join('\n');
  const [first, ...rest] = notes.split('\n\n');
  return [first.replace(' and changes nothing else', ''), lines, ...rest].join('\n\n');
}

export const pendingNotes = () => 'This release carries pins the family resync already merged and changes nothing else.\n\nNothing breaks. A repository that takes this one re-pins it and changes nothing else.\n';
