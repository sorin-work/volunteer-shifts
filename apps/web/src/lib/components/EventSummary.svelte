<script lang="ts">
  import { api } from '$lib/api';
  import { formatHours } from '$lib/format';

  interface Summary {
    confirmed: number;
    waitlisted: number;
    cancelled: number;
    present: number;
    noShows: number;
    turnout: number | null;
    hours: number;
  }

  let { eventId }: { eventId: number } = $props();
  let summary = $state<Summary | null>(null);

  $effect(() => {
    api
      .get<{ summary: Summary }>(`/events/${eventId}/summary`)
      .then((res) => (summary = res.summary))
      .catch(() => (summary = null));
  });
</script>

{#if summary}
  <dl class="summary">
    <div class="card">
      <dt>Signed up</dt>
      <dd>{summary.confirmed}</dd>
    </div>
    <div class="card">
      <dt>Waitlist</dt>
      <dd>{summary.waitlisted}</dd>
    </div>
    <div class="card">
      <dt>Checked in</dt>
      <dd>{summary.present}</dd>
    </div>
    <div class="card">
      <dt>No-shows</dt>
      <dd>{summary.noShows}</dd>
    </div>
    <div class="card">
      <dt>Turnout</dt>
      <dd>{summary.turnout === null ? '–' : `${summary.turnout}%`}</dd>
    </div>
    <div class="card">
      <dt>Hours given</dt>
      <dd>{formatHours(summary.hours)}</dd>
    </div>
  </dl>
{/if}

<style>
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 0;
  }

  dt {
    color: var(--muted);
    font-size: 0.85rem;
  }

  dd {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
  }
</style>
