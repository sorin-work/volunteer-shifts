import type { Signup } from '../../db/types.js';

export function toSignupDto(signup: Signup) {
  return {
    id: signup.id,
    shiftId: signup.shift_id,
    userId: signup.user_id,
    status: signup.status,
    createdAt: signup.created_at.toISOString(),
    cancelledAt: signup.cancelled_at?.toISOString() ?? null,
    attendance: signup.attendance,
    checkedInAt: signup.checked_in_at?.toISOString() ?? null,
  };
}
