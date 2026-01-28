import type { AppContext } from '../../context.js';
import type { User } from '../../db/types.js';
import { ageOn } from '../../lib/age.js';
import { unprocessable } from '../../lib/errors.js';
import { localDate } from '../../lib/time.js';

interface ShiftForEligibility {
  starts_at: Date;
  role_id: number;
  role_name: string;
  role_min_age: number | null;
  event_timezone: string;
}

/** Throws a 422 explaining why the user can't take this shift's role. */
export async function assertEligible(ctx: AppContext, user: User, shift: ShiftForEligibility) {
  if (shift.role_min_age !== null) {
    if (!user.birth_date) {
      throw unprocessable(
        'birth_date_required',
        `${shift.role_name} has a minimum age, add your date of birth to your profile first.`,
      );
    }
    const age = ageOn(user.birth_date, localDate(shift.starts_at, shift.event_timezone));
    if (age < shift.role_min_age) {
      throw unprocessable(
        'too_young',
        `You need to be at least ${shift.role_min_age} for ${shift.role_name}.`,
        { minAge: shift.role_min_age },
      );
    }
  }

  const missing = await ctx.db
    .selectFrom('role_skills')
    .innerJoin('skills', 'skills.id', 'role_skills.skill_id')
    .select(['skills.id', 'skills.name'])
    .where('role_skills.role_id', '=', shift.role_id)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('user_skills')
            .select('user_skills.skill_id')
            .whereRef('user_skills.skill_id', '=', 'role_skills.skill_id')
            .where('user_skills.user_id', '=', user.id),
        ),
      ),
    )
    .orderBy('skills.name')
    .execute();
  if (missing.length) {
    throw unprocessable(
      'missing_skills',
      `${shift.role_name} needs: ${missing.map((s) => s.name).join(', ')}.`,
      { skills: missing },
    );
  }
}
