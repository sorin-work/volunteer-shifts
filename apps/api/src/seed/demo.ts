import type { Database } from '../db/connection.js';
import { addDays, localDate, zonedTimeToUtc } from '../lib/time.js';
import { hashPassword } from '../modules/auth/passwords.js';
import { creditedHours } from '../modules/hours/credit.js';

export const DEMO_PASSWORD = 'demo-password';
export const DEMO_COORDINATOR = 'coordinator@example.org';
export const DEMO_VOLUNTEER = 'volunteer@example.org';

const TZ = 'Europe/London';

const FIRST_NAMES = [
  'Amara',
  'Ben',
  'Chloe',
  'Dmitri',
  'Elena',
  'Femi',
  'Grace',
  'Hiro',
  'Isla',
  'Jonah',
  'Kavya',
  'Liam',
  'Mei',
  'Noah',
  'Olu',
  'Paula',
  'Quinn',
  'Rosa',
  'Sanjay',
  'Tess',
  'Umar',
  'Vik',
  'Wren',
  'Yara',
];
const LAST_NAMES = [
  'Okafor',
  'Hughes',
  'Martin',
  'Petrov',
  'Garcia',
  'Adeyemi',
  'Taylor',
  'Sato',
  'Murray',
  'Clarke',
  'Iyer',
  'Walsh',
  'Chen',
  'Evans',
  'Bello',
  'Silva',
  'Reid',
  'Moreno',
  'Patel',
  'Byrne',
  'Rahman',
  'Novak',
  'Price',
  'Haddad',
];

/** Small deterministic PRNG so every demo database looks the same. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** The Saturday on or before the given date. */
function saturdayOnOrBefore(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 1) % 7));
}

interface ShiftPlan {
  roleId: number;
  date: string;
  start: string;
  end: string;
  capacity: number;
  notes?: string;
  /** Spots kept free for the demo volunteer. */
  reserve?: number;
}

/**
 * Fills an empty database with a coordinator, a demo volunteer, a few dozen
 * other volunteers and three events with a mix of past and upcoming shifts.
 * Returns false when there are users already, so it is safe to run on boot.
 */
export async function seedDemo(db: Database, now = new Date()): Promise<boolean> {
  const existing = await db.selectFrom('users').select('id').limit(1).executeTakeFirst();
  if (existing) return false;

  const rnd = random(4420);
  const passwordHash = await hashPassword(DEMO_PASSWORD, 10);
  const today = localDate(now, TZ);

  await db.transaction().execute(async (trx) => {
    const coordinator = await trx
      .insertInto('users')
      .values({
        email: DEMO_COORDINATOR,
        name: 'Priya Shah',
        role: 'coordinator',
        password_hash: passwordHash,
        phone: '07700 900123',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const skills = await trx
      .insertInto('skills')
      .values([
        { name: 'Food hygiene certificate' },
        { name: 'First aid' },
        { name: 'Forklift licence' },
        { name: 'Driving licence' },
        { name: 'Spanish speaker' },
      ])
      .returning(['id', 'name'])
      .execute();
    const skill = (name: string) => skills.find((s) => s.name === name)!.id;

    const demo = await trx
      .insertInto('users')
      .values({
        email: DEMO_VOLUNTEER,
        name: 'Sam Rivera',
        password_hash: passwordHash,
        phone: '07700 900456',
        birth_date: '1994-06-15',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const others = await trx
      .insertInto('users')
      .values(
        FIRST_NAMES.map((first, i) => {
          const year = rnd() < 0.15 ? 2009 + Math.floor(rnd() * 3) : 1955 + Math.floor(rnd() * 48);
          const month = String(1 + Math.floor(rnd() * 12)).padStart(2, '0');
          const day = String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
          return {
            email: `${first.toLowerCase()}.${LAST_NAMES[i]!.toLowerCase()}@example.org`,
            name: `${first} ${LAST_NAMES[i]}`,
            password_hash: passwordHash,
            phone: rnd() < 0.7 ? `07700 9${String(10000 + i * 37).slice(-5)}` : null,
            birth_date: `${year}-${month}-${day}`,
          };
        }),
      )
      .returning(['id', 'birth_date'])
      .execute();

    const userSkills = [
      { user_id: demo.id, skill_id: skill('Food hygiene certificate') },
      { user_id: demo.id, skill_id: skill('Driving licence') },
    ];
    for (const u of others) {
      for (const s of skills) if (rnd() < 0.25) userSkills.push({ user_id: u.id, skill_id: s.id });
    }
    await trx.insertInto('user_skills').values(userSkills).execute();

    const skillsOf = new Map<number, Set<number>>();
    for (const us of userSkills) {
      const set = skillsOf.get(us.user_id) ?? new Set();
      set.add(us.skill_id);
      skillsOf.set(us.user_id, set);
    }
    const volunteers = [{ id: demo.id, birth_date: '1994-06-15' }, ...others];

    async function createEvent(attrs: {
      name: string;
      description: string;
      location: string;
      status: 'draft' | 'published';
    }) {
      return trx
        .insertInto('events')
        .values({ ...attrs, timezone: TZ, created_by: coordinator.id })
        .returning('id')
        .executeTakeFirstOrThrow();
    }

    async function createRole(
      eventId: number,
      name: string,
      description: string,
      minAge: number | null,
      skillNames: string[] = [],
    ) {
      const role = await trx
        .insertInto('roles')
        .values({ event_id: eventId, name, description, min_age: minAge })
        .returning(['id', 'name', 'min_age'])
        .executeTakeFirstOrThrow();
      if (skillNames.length) {
        await trx
          .insertInto('role_skills')
          .values(skillNames.map((n) => ({ role_id: role.id, skill_id: skill(n) })))
          .execute();
      }
      return { ...role, skills: skillNames.map(skill) };
    }

    type SeedRole = Awaited<ReturnType<typeof createRole>>;

    async function createShifts(
      eventId: number,
      eventName: string,
      plans: ShiftPlan[],
      roles: SeedRole[],
    ) {
      for (const plan of plans) {
        const startsAt = zonedTimeToUtc(plan.date, plan.start, TZ);
        const endsAt = zonedTimeToUtc(
          plan.end <= plan.start ? addDays(plan.date, 1) : plan.date,
          plan.end,
          TZ,
        );
        const shift = await trx
          .insertInto('shifts')
          .values({
            event_id: eventId,
            role_id: plan.roleId,
            starts_at: startsAt,
            ends_at: endsAt,
            capacity: plan.capacity,
            notes: plan.notes ?? '',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const role = roles.find((r) => r.id === plan.roleId)!;
        const past = endsAt <= now;
        const eligible = volunteers.filter((v) => {
          const age = Number(plan.date.slice(0, 4)) - Number(v.birth_date!.slice(0, 4)) - 1;
          if (role.min_age !== null && age < role.min_age) return false;
          return role.skills.every((s) => skillsOf.get(v.id)?.has(s));
        });
        // Past shifts were mostly full; upcoming ones are filling up.
        const fill = past ? 0.7 + rnd() * 0.3 : rnd() * 1.3;
        const open = plan.capacity - (plan.reserve ?? 0);
        const wanted = Math.min(eligible.length, Math.round(plan.capacity * fill), open);
        const chosen = [...eligible]
          .filter((v) => v.id !== demo.id)
          .sort(() => rnd() - 0.5)
          .slice(0, wanted);
        if (!past && !plan.reserve && rnd() < 0.3 && eligible.length > chosen.length + 2) {
          // A couple of extra people waiting for a spot.
          chosen.push(
            ...eligible.filter((v) => v.id !== demo.id && !chosen.includes(v)).slice(0, 2),
          );
        }

        for (const [i, v] of chosen.entries()) {
          await addSignup(shift.id, v.id, i < open ? 'confirmed' : 'waitlisted', {
            startsAt,
            endsAt,
            past,
            description: `${eventName}: ${role.name}`,
            signedUpAt: new Date(startsAt.getTime() - (3 + i) * 86_400_000),
          });
        }
      }
    }

    async function addSignup(
      shiftId: number,
      userId: number,
      status: 'confirmed' | 'waitlisted',
      info: { startsAt: Date; endsAt: Date; past: boolean; description: string; signedUpAt: Date },
    ) {
      const attended = info.past && status === 'confirmed' ? rnd() < 0.88 : null;
      const signup = await trx
        .insertInto('signups')
        .values({
          shift_id: shiftId,
          user_id: userId,
          status,
          created_at: info.signedUpAt,
          attendance: attended === null ? 'pending' : attended ? 'present' : 'no_show',
          checked_in_at: attended ? new Date(info.startsAt.getTime() - 10 * 60_000) : null,
          attendance_marked_by: attended === null ? null : coordinator.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      // Now and then someone dropped out, some of them at the last minute.
      if (userId !== demo.id && status === 'confirmed' && rnd() < 0.06) {
        const hoursBefore = rnd() < 0.5 ? 2 + Math.floor(rnd() * 20) : 30 + Math.floor(rnd() * 100);
        await trx
          .insertInto('signups')
          .values({
            shift_id: shiftId,
            user_id: others[Math.floor(rnd() * others.length)]!.id,
            status: 'cancelled',
            created_at: info.signedUpAt,
            cancelled_at: new Date(info.startsAt.getTime() - hoursBefore * 3_600_000),
          })
          .execute();
      }
      if (attended) {
        await trx
          .insertInto('hour_entries')
          .values({
            user_id: userId,
            signup_id: signup.id,
            worked_on: localDate(info.startsAt, TZ),
            hours: creditedHours(info.startsAt, info.endsAt),
            description: info.description,
            created_by: coordinator.id,
          })
          .execute();
      }
    }

    // 1. Weekly food bank distribution, eight weeks back and six ahead.
    const foodBank = await createEvent({
      name: 'Riverside Food Bank: Saturday distribution',
      description:
        'Every Saturday we sort donations in the morning and hand out food parcels after lunch.\n' +
        'Please wear closed-toe shoes. Parking is behind the hall.\n' +
        'Volunteer handbook: https://example.org/riverside/handbook',
      location: 'Riverside Community Hall, 14 Mill Lane',
      status: 'published',
    });
    const fbRoles = [
      await createRole(
        foodBank.id,
        'Sorting',
        'Check dates and sort donated food into crates.',
        14,
      ),
      await createRole(foodBank.id, 'Distribution', 'Welcome visitors and pack parcels.', 16, [
        'Food hygiene certificate',
      ]),
      await createRole(foodBank.id, 'Driver', 'Collect supermarket donations with the van.', 21, [
        'Driving licence',
      ]),
      await createRole(foodBank.id, 'Warehouse', 'Move pallets in the store room.', 18, [
        'Forklift licence',
      ]),
    ];
    const plans: ShiftPlan[] = [];
    const firstSaturday = addDays(saturdayOnOrBefore(today), -56);
    for (let week = 0; week < 14; week++) {
      const date = addDays(firstSaturday, week * 7);
      plans.push(
        { roleId: fbRoles[2]!.id, date, start: '08:00', end: '11:00', capacity: 2 },
        { roleId: fbRoles[0]!.id, date, start: '09:00', end: '12:00', capacity: 6, reserve: 1 },
        { roleId: fbRoles[1]!.id, date, start: '12:30', end: '15:30', capacity: 5 },
      );
      if (week % 2 === 0) {
        plans.push({ roleId: fbRoles[3]!.id, date, start: '09:00', end: '13:00', capacity: 1 });
      }
    }
    await createShifts(foodBank.id, 'Riverside Food Bank', plans, fbRoles);

    // 2. A weekend festival a few weeks from now.
    const festivalStart = addDays(saturdayOnOrBefore(addDays(today, 30)), -1);
    const festival = await createEvent({
      name: 'Harvest Festival',
      description:
        'Three days of music, food stalls and workshops in Victoria Park.\n' +
        'Volunteers get a free meal voucher for every shift.',
      location: 'Victoria Park, north gate',
      status: 'published',
    });
    const fRoles = [
      await createRole(festival.id, 'Gate & tickets', 'Scan tickets and hand out wristbands.', 16),
      await createRole(
        festival.id,
        'Stewarding',
        'Keep walkways clear and help with directions.',
        18,
      ),
      await createRole(
        festival.id,
        'Info tent',
        'Answer questions and look after lost property.',
        16,
      ),
      await createRole(festival.id, 'Litter pick', 'Keep the park tidy.', 12),
      await createRole(festival.id, 'First aid post', 'Support the medical team.', 18, [
        'First aid',
      ]),
      await createRole(
        festival.id,
        'Night security',
        'Walk the site overnight with the security team.',
        21,
      ),
    ];
    const fPlans: ShiftPlan[] = [];
    for (let d = 0; d < 3; d++) {
      const date = addDays(festivalStart, d);
      fPlans.push(
        { roleId: fRoles[0]!.id, date, start: '10:00', end: '14:00', capacity: 6 },
        { roleId: fRoles[0]!.id, date, start: '14:00', end: '18:00', capacity: 6 },
        { roleId: fRoles[1]!.id, date, start: '11:00', end: '17:00', capacity: 8 },
        { roleId: fRoles[2]!.id, date, start: '10:00', end: '16:00', capacity: 3 },
        { roleId: fRoles[3]!.id, date, start: '17:00', end: '20:00', capacity: 10 },
        { roleId: fRoles[4]!.id, date, start: '10:00', end: '18:00', capacity: 2 },
        {
          roleId: fRoles[5]!.id,
          date,
          start: '22:00',
          end: '06:00',
          capacity: 2,
          notes: 'Hi-vis provided.',
        },
      );
    }
    await createShifts(festival.id, 'Harvest Festival', fPlans, fRoles);

    // 3. A finished winter coat drive.
    const coatDrive = await createEvent({
      name: 'Winter Coat Drive',
      description: 'Collecting, washing and handing out warm coats before the cold snap.',
      location: 'St. Anne’s Church Hall',
      status: 'published',
    });
    const cRoles = [
      await createRole(coatDrive.id, 'Collection point', 'Receive and log donated coats.', 14),
      await createRole(coatDrive.id, 'Fitting room', 'Help people find a coat that fits.', 16, [
        'Spanish speaker',
      ]),
    ];
    const coatStart = addDays(saturdayOnOrBefore(today), -120);
    await createShifts(
      coatDrive.id,
      'Winter Coat Drive',
      [0, 1, 7, 8].flatMap((offset) => [
        {
          roleId: cRoles[0]!.id,
          date: addDays(coatStart, offset),
          start: '10:00',
          end: '13:00',
          capacity: 4,
        },
        {
          roleId: cRoles[1]!.id,
          date: addDays(coatStart, offset),
          start: '13:00',
          end: '16:30',
          capacity: 3,
        },
      ]),
      cRoles,
    );

    // 4. A draft the coordinator is still planning.
    await createEvent({
      name: 'Community garden planting day',
      description: 'Draft: waiting for the council to confirm the date.',
      location: 'Allotments, Brook Street',
      status: 'draft',
    });

    // The demo volunteer: a few past Saturdays and two upcoming shifts.
    const sorting = await trx
      .selectFrom('shifts')
      .select(['id', 'starts_at', 'ends_at'])
      .where('role_id', '=', fbRoles[0]!.id)
      .orderBy('starts_at')
      .execute();
    const demoShifts = [
      ...sorting.filter((s) => s.ends_at <= now).slice(-5),
      ...sorting.filter((s) => s.starts_at > now).slice(0, 2),
    ];
    for (const s of demoShifts) {
      const past = s.ends_at <= now;
      await addSignup(s.id, demo.id, 'confirmed', {
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        past,
        description: 'Riverside Food Bank: Sorting',
        signedUpAt: new Date(s.starts_at.getTime() - 5 * 86_400_000),
      });
    }

    // Last year's hours, logged by hand before the app existed.
    const lastYear = Number(today.slice(0, 4)) - 1;
    await trx
      .insertInto('hour_entries')
      .values(
        [
          { worked_on: `${lastYear}-03-14`, hours: 6, description: 'Spring food drive' },
          { worked_on: `${lastYear}-07-05`, hours: 4.5, description: 'Summer fair: info tent' },
          { worked_on: `${lastYear}-11-22`, hours: 3, description: 'Warehouse stock take' },
          { worked_on: `${lastYear}-12-20`, hours: 5, description: 'Christmas hamper packing' },
        ].map((e) => ({ ...e, user_id: demo.id, created_by: coordinator.id })),
      )
      .execute();
  });

  return true;
}
