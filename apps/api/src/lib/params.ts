import { notFound } from './errors.js';

/** Parses a numeric route id; anything else is treated as a missing resource. */
export function idParam(value: string | string[] | undefined, what = 'Resource'): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,9}$/.test(raw)) throw notFound(what);
  return Number(raw);
}
