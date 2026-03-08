<script lang="ts">
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import EventForm, { type EventFormValues } from '$lib/components/EventForm.svelte';
  import RolesEditor from '$lib/components/RolesEditor.svelte';
  import ShiftsEditor from '$lib/components/ShiftsEditor.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import type { EventDetails, VolunteerEvent } from '$lib/types';

  let details = $state<EventDetails | null>(null);
  let error = $state('');
  let saved = $state(false);

  async function load() {
    try {
      details = await api.get<EventDetails>(`/events/${page.params.id}`);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load the event.';
    }
  }

  async function save(values: EventFormValues) {
    saved = false;
    const { event } = await api.patch<{ event: VolunteerEvent }>(
      `/events/${page.params.id}`,
      values,
    );
    if (details) details.event = event;
    saved = true;
  }

  async function setStatus(action: 'publish' | 'cancel') {
    if (
      action === 'cancel' &&
      !confirm('Cancel this event? Volunteers will no longer be able to sign up.')
    ) {
      return;
    }
    try {
      const { event } = await api.post<{ event: VolunteerEvent }>(
        `/events/${page.params.id}/${action}`,
      );
      if (details) details.event = event;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not update the event.';
    }
  }

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>Manage {details?.event.name ?? 'event'} · Volunteer Shifts</title></svelte:head>

{#if error}<p class="alert">{error}</p>{/if}
{#if details}
  {@const event = details.event}
  <p><a href="/events/{event.id}">← Back to the event page</a></p>
  <div class="header">
    <h1>{event.name} <StatusBadge status={event.status} /></h1>
    <div class="actions">
      {#if event.status === 'draft'}
        <button onclick={() => setStatus('publish')}>Publish</button>
      {/if}
      {#if event.status !== 'cancelled'}
        <button class="secondary" onclick={() => setStatus('cancel')}>Cancel event</button>
      {/if}
    </div>
  </div>

  {#if event.status !== 'cancelled'}
    <section>
      <h2>Details</h2>
      <EventForm initial={event} onsubmit={save} />
      {#if saved}<p class="muted" role="status">Saved.</p>{/if}
    </section>

    <section>
      <h2>Roles</h2>
      <RolesEditor eventId={event.id} roles={details.roles} onchange={load} />
    </section>

    <section>
      <h2>Shifts</h2>
      <ShiftsEditor
        eventId={event.id}
        timezone={event.timezone}
        roles={details.roles}
        shifts={details.shifts}
        onchange={load}
      />
    </section>
  {:else}
    <p class="alert warning">This event was cancelled and can no longer be edited.</p>
  {/if}
{:else if !error}
  <p class="muted">Loading…</p>
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  section {
    margin-top: 1.5rem;
  }
</style>
