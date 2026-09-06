<script lang="ts">
  import { api } from '$lib/api';
  import CoordinatorHome from '$lib/components/CoordinatorHome.svelte';
  import SignupList from '$lib/components/SignupList.svelte';
  import { formatHours } from '$lib/format';
  import { session } from '$lib/session.svelte';
  import type { MySignup, VolunteerProfile } from '$lib/types';

  let next: MySignup[] = $state([]);
  let stats = $state<VolunteerProfile['stats'] | null>(null);
  let loaded = $state(false);

  $effect(() => {
    if (!session.user) return;
    const id = session.user.id;
    Promise.all([
      api.get<{ signups: MySignup[] }>('/me/signups'),
      api.get<VolunteerProfile>(`/volunteers/${id}`),
    ])
      .then(([s, p]) => {
        next = s.signups.slice(0, 3);
        stats = p.stats;
      })
      .finally(() => (loaded = true));
  });
</script>

<svelte:head><title>Volunteer Shifts</title></svelte:head>

<h1>Hi {session.user?.name.split(' ')[0]}</h1>

{#if session.user?.role === 'coordinator'}
  <CoordinatorHome />
{/if}

{#if stats && (stats.totalHours > 0 || stats.attended > 0)}
  <div class="stats">
    <a class="card" href="/my/hours">
      <span class="muted">Hours this year</span>
      <strong>{formatHours(stats.hoursThisYear)}</strong>
    </a>
    <a class="card" href="/my/shifts">
      <span class="muted">Shifts worked</span>
      <strong>{stats.attended}</strong>
    </a>
  </div>
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

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 1.5rem;
  }

  .stats a {
    display: grid;
    text-decoration: none;
    color: inherit;
  }

  .stats strong {
    font-size: 1.5rem;
  }
</style>
