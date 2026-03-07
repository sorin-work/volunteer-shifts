<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import EventForm, { type EventFormValues } from '$lib/components/EventForm.svelte';
  import type { VolunteerEvent } from '$lib/types';

  async function create(values: EventFormValues) {
    const { event } = await api.post<{ event: VolunteerEvent }>('/events', values);
    await goto(`/events/${event.id}/manage`);
  }
</script>

<svelte:head><title>New event · Volunteer Shifts</title></svelte:head>

<p><a href="/events">← Events</a></p>
<h1>New event</h1>
<p class="muted">Events start as drafts. Add roles and shifts, then publish when you're ready.</p>
<EventForm submitLabel="Create draft" onsubmit={create} />
