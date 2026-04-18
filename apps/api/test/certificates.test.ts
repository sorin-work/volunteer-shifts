import type { Response } from 'superagent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { renderCertificate } from '../src/modules/certificates/pdf.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';

function binary(res: Response, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

describe('certificates', () => {
  let db: Database;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;
  let volunteerId: number;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    const app = buildApp(buildContext(db));
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    volunteerId = (await createUser(db, { email: 'vol@example.org', name: 'Zoë Martin' })).id;
    coordinator = await loginAs(app, 'coord@example.org');
    volunteer = await loginAs(app, 'vol@example.org');
    await db
      .insertInto('hour_entries')
      .values([
        { user_id: volunteerId, worked_on: '2025-06-01', hours: 3, description: 'Fair' },
        { user_id: volunteerId, worked_on: '2025-09-12', hours: 2.5, description: 'Pantry' },
      ])
      .execute();
  });
  afterAll(() => db.destroy());

  it('downloads a pdf for a year with hours', async () => {
    const res = await volunteer
      .get(`/api/volunteers/${volunteerId}/certificates/2025`)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="volunteer-certificate-2025-zo-martin.pdf"',
    );
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns 404 for a year without hours', async () => {
    const res = await volunteer.get(`/api/volunteers/${volunteerId}/certificates/2024`);
    expect(res.status).toBe(404);
  });

  it("does not hand out other volunteers' certificates", async () => {
    const other = await createUser(db, { email: 'other@example.org' });
    const res = await volunteer.get(`/api/volunteers/${other.id}/certificates/2025`);
    expect(res.status).toBe(403);
    const asCoordinator = await coordinator.get(`/api/volunteers/${volunteerId}/certificates/2025`);
    expect(asCoordinator.status).toBe(200);
  });

  it('renders without events or shifts', async () => {
    const pdf = await renderCertificate({
      organisation: 'Test Org',
      volunteerName: 'A Volunteer',
      year: 2026,
      hours: 1.5,
      shifts: 0,
      events: [],
      issuedOn: '1 May 2026',
    });
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
