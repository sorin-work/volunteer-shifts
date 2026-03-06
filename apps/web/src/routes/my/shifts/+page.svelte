<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import SignupList from '$lib/components/SignupList.svelte';
  import type { MySignup } from '$lib/types';

  let upcoming: MySignup[] = $state([]);
  let past: MySignup[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    try {
      const [u, p] = await Promise.all([
        api.get<{ signups: MySignup[] }>('/me/signups'),
        api.get<{ signups: MySignup[] }>('/me/signups?when=past'),
      ]);
      upcoming = u.signups;
      past = p.signups;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load your shifts.';
    } finally {
      loading = false;
    }
  }

  async function cancel(signup: MySignup) {
    if (!confirm(`Cancel your ${signup.role.name} shift at ${signup.event.name}?`)) return;
    try {
      await api.delete(`/signups/${signup.id}`);
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not cancel.';
    }
  }

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>My shifts · Volunteer Shifts</title></svelte:head>

<h1>My shifts</h1>
{#if error}<p class="alert">{error}</p>{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <section>
    <h2>Coming up</h2>
    {#if upcoming.length === 0}
      <div class="card">
        <p>You have no upcoming shifts. <a href="/events">Find something to help with</a>.</p>
      </div>
    {:else}
      <SignupList signups={upcoming}>
        {#snippet actions(signup)}
          <button class="secondary" onclick={() => cancel(signup)}>Cancel</button>
        {/snippet}
      </SignupList>
    {/if}
  </section>

  {#if past.length}
    <section>
      <h2>Past shifts</h2>
      <SignupList signups={past} />
    </section>
  {/if}
{/if}

<style>
  section {
    margin-top: 1.5rem;
  }
</style>
