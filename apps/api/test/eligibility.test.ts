import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('skills and eligibility', () => {
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let event: Awaited<ReturnType<typeof createEvent>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    app = buildApp(buildContext(db));
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    coordinator = await loginAs(app, 'coord@example.org');
    event = await createEvent(db);
  });
  afterAll(() => db.destroy());

  async function shiftForRole(attrs: { minAge?: number | null; skillIds?: number[] } = {}) {
    const role = await createRole(db, event.id, { name: 'Forklift', minAge: attrs.minAge });
    if (attrs.skillIds?.length) {
      await db
        .insertInto('role_skills')
        .values(attrs.skillIds.map((skill_id) => ({ role_id: role.id, skill_id })))
        .execute();
    }
    return createShift(db, {
      eventId: event.id,
      roleId: role.id,
      startsAt: '2026-03-07T09:00:00Z',
      endsAt: '2026-03-07T12:00:00Z',
    });
  }

  describe('skills catalogue', () => {
    it('creates and lists skills alphabetically', async () => {
      await coordinator.post('/api/skills').send({ name: 'Food hygiene' }).expect(201);
      await coordinator.post('/api/skills').send({ name: 'Forklift licence' }).expect(201);
      await coordinator.post('/api/skills').send({ name: 'First aid' }).expect(201);
      const res = await coordinator.get('/api/skills');
      expect(res.body.skills.map((s: { name: string }) => s.name)).toEqual([
        'First aid',
        'Food hygiene',
        'Forklift licence',
      ]);
    });

    it('treats names case-insensitively for duplicates', async () => {
      await coordinator.post('/api/skills').send({ name: 'First aid' }).expect(201);
      const res = await coordinator.post('/api/skills').send({ name: 'first AID' });
      expect(res.status).toBe(409);
    });

    it('lets coordinators confirm skills for a volunteer', async () => {
      const vol = await createUser(db, { email: 'vol@example.org' });
      const { body } = await coordinator.post('/api/skills').send({ name: 'First aid' });
      const res = await coordinator
        .put(`/api/volunteers/${vol.id}/skills`)
        .send({ skillIds: [body.skill.id, body.skill.id] });
      expect(res.status).toBe(200);
      expect(res.body.skills).toEqual([{ id: body.skill.id, name: 'First aid' }]);
      const me = await (await loginAs(app, 'vol@example.org')).get('/api/auth/me');
      expect(me.body.user.skills).toEqual([{ id: body.skill.id, name: 'First aid' }]);
    });

    it('does not let volunteers set their own skills', async () => {
      const vol = await createUser(db, { email: 'vol@example.org' });
      const agent = await loginAs(app, 'vol@example.org');
      expect(
        (await agent.put(`/api/volunteers/${vol.id}/skills`).send({ skillIds: [] })).status,
      ).toBe(403);
    });

    it('stores required skills on roles', async () => {
      const { body } = await coordinator.post('/api/skills').send({ name: 'Forklift licence' });
      const res = await coordinator
        .post(`/api/events/${event.id}/roles`)
        .send({ name: 'Warehouse', skillIds: [body.skill.id] });
      expect(res.status).toBe(201);
      expect(res.body.role.requiredSkills).toEqual([
        { id: body.skill.id, name: 'Forklift licence' },
      ]);
    });
  });

  describe('sign-up eligibility', () => {
    it('asks for a birth date when the role has a minimum age', async () => {
      const shift = await shiftForRole({ minAge: 18 });
      await createUser(db, { email: 'vol@example.org' });
      const res = await (
        await loginAs(app, 'vol@example.org')
      ).post(`/api/shifts/${shift.id}/signups`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('birth_date_required');
    });

    it('rejects volunteers below the minimum age', async () => {
      const shift = await shiftForRole({ minAge: 18 });
      await createUser(db, { email: 'teen@example.org', birth_date: '2012-01-20' });
      const res = await (
        await loginAs(app, 'teen@example.org')
      ).post(`/api/shifts/${shift.id}/signups`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('too_young');
    });

    it('rejects volunteers whose birthday is after the shift date', async () => {
      // Turns 18 on 2026-04-15; the shift is on 2026-03-07.
      const shift = await shiftForRole({ minAge: 18 });
      await createUser(db, { email: 'almost@example.org', birth_date: '2008-04-15' });
      const res = await (
        await loginAs(app, 'almost@example.org')
      ).post(`/api/shifts/${shift.id}/signups`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('too_young');
    });

    it('accepts volunteers who are old enough', async () => {
      const shift = await shiftForRole({ minAge: 18 });
      await createUser(db, { email: 'adult@example.org', birth_date: '1990-05-05' });
      const res = await (
        await loginAs(app, 'adult@example.org')
      ).post(`/api/shifts/${shift.id}/signups`);
      expect(res.status).toBe(201);
    });

    it('explains on the event page why a shift is out of reach', async () => {
      await shiftForRole({ minAge: 18 });
      await createUser(db, { email: 'teen@example.org', birth_date: '2012-01-20' });
      const res = await (await loginAs(app, 'teen@example.org')).get(`/api/events/${event.id}`);
      expect(res.body.shifts[0].eligibility).toEqual({
        code: 'too_young',
        message: 'Ages 18 and up.',
      });
      const adult = await createUser(db, { email: 'adult@example.org', birth_date: '1990-01-01' });
      expect(adult).toBeDefined();
      const ok = await (await loginAs(app, 'adult@example.org')).get(`/api/events/${event.id}`);
      expect(ok.body.shifts[0].eligibility).toBeNull();
    });

    it('lists the skills a volunteer is missing', async () => {
      const skills = await db
        .insertInto('skills')
        .values([{ name: 'Forklift licence' }, { name: 'First aid' }])
        .returning(['id', 'name'])
        .execute();
      const shift = await shiftForRole({ skillIds: skills.map((s) => s.id) });
      const vol = await createUser(db, { email: 'vol@example.org' });
      await db
        .insertInto('user_skills')
        .values({ user_id: vol.id, skill_id: skills[1]!.id })
        .execute();

      const agent = await loginAs(app, 'vol@example.org');
      const res = await agent.post(`/api/shifts/${shift.id}/signups`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('missing_skills');
      expect(res.body.error.details.skills).toEqual([
        { id: skills[0]!.id, name: 'Forklift licence' },
      ]);

      await db
        .insertInto('user_skills')
        .values({ user_id: vol.id, skill_id: skills[0]!.id })
        .execute();
      expect((await agent.post(`/api/shifts/${shift.id}/signups`)).status).toBe(201);
    });
  });
});
