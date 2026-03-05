<script lang="ts">
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { formatDate, formatTimeRange, groupByDate, spotsLabel } from '$lib/format';
  import type { EventDetails, EventShift } from '$lib/types';

  let details = $state<EventDetails | null>(null);
  let error = $state('');

  const roleById = $derived(new Map((details?.roles ?? []).map((r) => [r.id, r])));
  const days = $derived(groupByDate<EventShift>(details?.shifts ?? []));

  async function load() {
    try {
      details = await api.get<EventDetails>(`/events/${page.params.id}`);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load the event.';
    }
  }

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>{details?.event.name ?? 'Event'} · Volunteer Shifts</title></svelte:head>

{#if error}
  <p class="alert">{error}</p>
{:else if !details}
  <p class="muted">Loading…</p>
{:else}
  {@const event = details.event}
  <header class="stack">
    <p><a href="/events">← All events</a></p>
    <h1>
      {event.name}
      {#if event.status !== 'published'}<StatusBadge status={event.status} />{/if}
    </h1>
    <p class="muted">
      {#if event.location}{event.location} ·{/if} Times are shown in {event.timezone}
    </p>
    {#if event.description}<p class="description">{event.description}</p>{/if}
  </header>

  {#if days.length === 0}
    <div class="card"><p>No shifts have been added yet.</p></div>
  {/if}

  {#each days as day (day.date)}
    <section class="day">
      <h2>{formatDate(day.date)}</h2>
      <ul class="shifts">
        {#each day.shifts as shift (shift.id)}
          {@const role = roleById.get(shift.roleId)}
          <li class="card shift">
            <div>
              <strong>{role?.name}</strong>
              <span class="muted">{formatTimeRange(shift)}</span>
              {#if role?.minAge}<span class="badge muted">{role.minAge}+</span>{/if}
              {#each role?.requiredSkills ?? [] as skill (skill.id)}
                <span class="badge muted">{skill.name}</span>
              {/each}
              {#if shift.notes}<p class="muted notes">{shift.notes}</p>{/if}
            </div>
            <div class="spots">
              <span>{spotsLabel(shift)}</span>
              {#if shift.mySignup}<StatusBadge status={shift.mySignup.status} />{/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}

<style>
  .description {
    white-space: pre-line;
  }

  .day {
    margin-top: 1.5rem;
  }

  .shifts {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .shift {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .shift strong {
    margin-right: 0.5rem;
  }

  .notes {
    margin: 0.25rem 0 0;
  }

  .spots {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    white-space: nowrap;
  }
</style>
