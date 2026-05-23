<script lang="ts">
  import { api } from '$lib/api';
  import CoordinatorHome from '$lib/components/CoordinatorHome.svelte';
  import SignupList from '$lib/components/SignupList.svelte';
  import { session } from '$lib/session.svelte';
  import type { MySignup } from '$lib/types';

  let next: MySignup[] = $state([]);
  let loaded = $state(false);

  $effect(() => {
    api
      .get<{ signups: MySignup[] }>('/me/signups')
      .then((res) => (next = res.signups.slice(0, 3)))
      .finally(() => (loaded = true));
  });
</script>

<svelte:head><title>Volunteer Shifts</title></svelte:head>

<h1>Hi {session.user?.name.split(' ')[0]}</h1>

{#if session.user?.role === 'coordinator'}
  <CoordinatorHome />
{/if}

<section class="stack">
  <h2>Your next shifts</h2>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if next.length === 0}
    <div class="card">
      <p>Nothing booked yet. <a href="/events">Browse upcoming events</a> and pick a shift.</p>
    </div>
  {:else}
    <SignupList signups={next} />
    <p><a href="/my/shifts">All my shifts →</a></p>
  {/if}
</section>
