<script lang="ts">
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { formatDateTime } from '$lib/format';
  import { isCoordinator } from '$lib/session.svelte';
  import type { EventSummary } from '$lib/types';

  const when = $derived(page.url.searchParams.get('when') === 'past' ? 'past' : 'upcoming');

  let events: EventSummary[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    const current = when;
    loading = true;
    error = '';
    api
      .get<{ events: EventSummary[] }>(`/events?when=${current}`)
      .then((res) => (events = res.events))
      .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load events.'))
      .finally(() => (loading = false));
  });
</script>

<svelte:head><title>Events · Volunteer Shifts</title></svelte:head>

<div class="header">
  <h1>Events</h1>
  {#if isCoordinator()}<a class="button" href="/events/new">New event</a>{/if}
</div>

<nav class="tabs">
  <a href="/events" aria-current={when === 'upcoming' ? 'page' : undefined}>Upcoming</a>
  <a href="/events?when=past" aria-current={when === 'past' ? 'page' : undefined}>Past</a>
</nav>

{#if loading}
  <p class="muted">Loading events…</p>
{:else if error}
  <p class="alert">{error}</p>
{:else if events.length === 0}
  <div class="card empty">
    <p>No {when} events right now.</p>
    {#if when === 'upcoming'}<p class="muted">
        New events will show up here once they're published.
      </p>{/if}
  </div>
{:else}
  <ul class="list">
    {#each events as event (event.id)}
      <li class="card">
        <a class="title" href="/events/{event.id}">{event.name}</a>
        {#if event.status !== 'published'}<StatusBadge status={event.status} />{/if}
        <p class="muted">
          {#if event.firstShiftAt}
            {formatDateTime(event.firstShiftAt, event.timezone)}
            · {event.shiftCount} shift{event.shiftCount === 1 ? '' : 's'}
          {:else}
            No shifts yet
          {/if}
          {#if event.location}· {event.location}{/if}
        </p>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tabs {
    display: flex;
    gap: 1rem;
    margin: 0.5rem 0 1rem;
  }

  .tabs a {
    text-decoration: none;
    color: var(--muted);
    font-weight: 600;
    padding-bottom: 0.2rem;
  }

  .tabs a[aria-current='page'] {
    color: var(--primary);
    border-bottom: 2px solid var(--primary);
  }

  .list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .title {
    font-size: 1.1rem;
    font-weight: 700;
    text-decoration: none;
    margin-right: 0.5rem;
  }

  .list p {
    margin: 0.25rem 0 0;
  }

  .empty p {
    margin: 0.25rem 0;
  }
</style>
