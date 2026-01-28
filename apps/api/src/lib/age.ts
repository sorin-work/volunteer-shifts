/** Age in whole years on the given date (both YYYY-MM-DD). */
export function ageOn(birthDate: string, onDate: string): number {
  const birthYear = Number(birthDate.slice(0, 4));
  const year = Number(onDate.slice(0, 4));
  return year - birthYear;
}
