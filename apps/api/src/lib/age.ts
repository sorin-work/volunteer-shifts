/** Age in whole years on the given date (both YYYY-MM-DD). */
export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = onDate.split('-').map(Number) as [number, number, number];
  let age = y - by;
  // Not had this year's birthday yet. Someone born on 29 February counts as a
  // year older on 1 March in common years.
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}
