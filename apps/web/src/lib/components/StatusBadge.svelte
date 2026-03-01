<script lang="ts">
  import type { EventStatus, SignupStatus } from '$lib/types';

  let { status }: { status: EventStatus | SignupStatus } = $props();

  const labels: Record<string, string> = {
    draft: 'Draft',
    published: 'Published',
    cancelled: 'Cancelled',
    confirmed: 'Confirmed',
    waitlisted: 'Waitlist',
  };
  const tone = $derived(
    status === 'cancelled'
      ? 'muted'
      : status === 'draft' || status === 'waitlisted'
        ? 'warning'
        : '',
  );
</script>

<span class="badge {tone}">{labels[status] ?? status}</span>
