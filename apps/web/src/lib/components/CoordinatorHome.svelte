<script lang="ts">
  import { api } from '$lib/api';
  import { formatDate, formatTimeRange } from '$lib/format';
  import type { EventSummary, Shift } from '$lib/types';

  type Understaffed = Shift & { eventName: string; roleName: string; confirmedCount: number };

  let events: EventSummary[] = $state([]);
  let understaffed: Understaffed[] = $state([]);
  let loaded = $state(false);

  $effect(() => {
    Promise.all([
      api.get<{ events: EventSummary[] }>('/events'),
      api.get<{ shifts: Understaffed[] }>('/shifts/understaffed?days=7'),
    ])
      .then(([e, u]) => {
        events = e.events;
        understaffed = u.shifts;
      })
      .finally(() => (loaded = true));
  });

  const percent = (e: EventSummary) =>
    e.totalSpots ? Math.round((e.filledSpots / e.totalSpots) * 100) : 0;
</script>

{#if !loaded}
  <p class="muted">Loading…</p>
{:else}
  <section class="stack">
    <h2>Needs people this week</h2>
    {#if understaffed.length === 0}
      <div class="card"><p>Every shift in the next 7 days is fully staffed.</p></div>
    {:else}
      <ul class="card list">
        {#each understaffed as shift (shift.id)}
          <li>
            <a href="/shifts/{shift.id}">{shift.eventName}: {shift.roleName}</a>
            <span class="muted">{formatDate(shift.date)} · {formatTimeRange(shift)}</span>
            <span class="badge warning">{shift.confirmedCount}/{shift.capacity}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="stack">
    <h2>Upcoming events</h2>
    {#if events.length === 0}
      <div class="card"><p>No upcoming events. <a href="/events/new">Plan one</a>.</p></div>
    {:else}
      <ul class="card list">
        {#each events as event (event.id)}
          <li>
            <a href="/events/{event.id}/manage">{event.name}</a>
            <span class="muted">{event.filledSpots} of {event.totalSpots} spots filled</span>
            <progress max="100" value={percent(event)} aria-label="Spots filled"
              >{percent(event)}%</progress
            >
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  section {
    margin-top: 1.5rem;
  }

  .list {
    list-style: none;
    margin: 0;
  }

  .list li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  .list li:last-child {
    border-bottom: none;
  }

  .list a {
    font-weight: 600;
    flex: 1 1 240px;
  }

  progress {
    width: 140px;
    accent-color: var(--primary);
  }
</style>
