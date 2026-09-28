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
