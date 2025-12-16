import type { z } from 'zod';
import { HttpError } from './errors.js';

/** Parses input with a zod schema, turning failures into a 400 with field errors. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw new HttpError(400, 'validation_error', 'Some fields are invalid.', { fields });
  }
  return result.data;
}
