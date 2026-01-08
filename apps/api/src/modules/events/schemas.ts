import { z } from 'zod';
import { isValidTimeZone } from '../../lib/time.js';

const timezone = z
  .string()
  .trim()
  .refine(isValidTimeZone, 'Unknown time zone, use a name like Europe/London.');

export const createEventSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(160),
  description: z.string().max(5000).default(''),
  location: z.string().trim().max(200).default(''),
  timezone: timezone.default('UTC'),
});

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(160),
    description: z.string().max(5000),
    location: z.string().trim().max(200),
    timezone,
  })
  .partial();
