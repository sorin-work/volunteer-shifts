<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import HoursLogView from '$lib/components/HoursLog.svelte';
  import { session } from '$lib/session.svelte';
  import type { HoursLog } from '$lib/types';

  let log = $state<HoursLog | null>(null);
  let error = $state('');

  $effect(() => {
    if (!session.user) return;
    api
      .get<HoursLog>(`/volunteers/${session.user.id}/hours`)
      .then((res) => (log = res))
      .catch(
        (err) => (error = err instanceof ApiError ? err.message : 'Could not load your hours.'),
      );
  });
</script>

<svelte:head><title>My hours · Volunteer Shifts</title></svelte:head>

<h1>My hours</h1>
{#if error}<p class="alert">{error}</p>{/if}
{#if log}
  <HoursLogView {log} />
{:else if !error}
  <p class="muted">Loading…</p>
{/if}
