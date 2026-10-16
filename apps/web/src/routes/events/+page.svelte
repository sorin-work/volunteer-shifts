<script lang="ts">
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { formatDateRange, plural } from '$lib/format';
  import { isCoordinator } from '$lib/session.svelte';
  import type { EventSummary } from '$lib/types';

  const tab = $derived(page.url.searchParams.get('when') ?? 'upcoming');
  const when = $derived(tab === 'past' ? 'past' : tab === 'drafts' ? 'all' : 'upcoming');
  const statusFilter = $derived(tab === 'drafts' ? '&status=draft' : '');
  const label = $derived(tab === 'drafts' ? 'draft' : when);
  let search = $state('');
  let debounced = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function onSearch() {
    clearTimeout(timer);
    timer = setTimeout(() => (debounced = search.trim()), 250);
  }

  let events: EventSummary[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    const current = when;
    const q = debounced ? `&search=${encodeURIComponent(debounced)}` : '';
    loading = true;
    error = '';
    api
      .get<{ events: EventSummary[] }>(`/events?when=${current}${statusFilter}${q}`)
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

<div class="toolbar">
  <nav class="tabs">
    <a href="/events" aria-current={tab === 'upcoming' ? 'page' : undefined}>Upcoming</a>
    <a href="/events?when=past" aria-current={tab === 'past' ? 'page' : undefined}>Past</a>
    {#if isCoordinator()}
      <a href="/events?when=drafts" aria-current={tab === 'drafts' ? 'page' : undefined}>Drafts</a>
    {/if}
  </nav>
  <input
    type="search"
    placeholder="Search events or places"
    aria-label="Search events"
    bind:value={search}
    oninput={onSearch}
  />
</div>

{#if loading}
  <p class="muted">Loading events…</p>
{:else if error}
  <p class="alert">{error}</p>
{:else if events.length === 0}
  <div class="card empty">
    <p>
      {debounced ? `No ${label} events match “${debounced}”.` : `No ${label} events right now.`}
    </p>
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
            {formatDateRange(
              event.firstShiftAt,
              event.lastShiftEndsAt ?? event.firstShiftAt,
              event.timezone,
            )}
            · {plural(event.shiftCount, 'shift')}
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

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin: 0.5rem 0 1rem;
  }

  .toolbar input {
    max-width: 280px;
  }

  .tabs {
    display: flex;
    gap: 1rem;
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
