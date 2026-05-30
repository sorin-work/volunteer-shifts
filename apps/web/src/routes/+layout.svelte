<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { loadSession, session, signOut } from '$lib/session.svelte';

  let { children } = $props();

  const publicPaths = ['/login', '/register'];
  const isPublic = $derived(publicPaths.includes(page.url.pathname));

  $effect(() => {
    if (!session.loaded) loadSession();
  });

  $effect(() => {
    if (session.loaded && !session.user && !isPublic) {
      const next = page.url.pathname + page.url.search;
      goto(`/login?next=${encodeURIComponent(next)}`, { replaceState: true });
    }
  });

  async function handleSignOut() {
    await signOut();
    goto('/login');
  }
</script>

{#if session.user}
  <header class="topbar">
    <nav class="container nav">
      <a class="brand" href="/">Volunteer Shifts</a>
      <a href="/events">Events</a>
      <a href="/my/shifts">My shifts</a>
      <a href="/my/hours">Hours</a>
      {#if session.user.role === 'coordinator'}
        <a href="/volunteers">Volunteers</a>
        <a href="/skills">Skills</a>
      {/if}
      <span class="spacer"></span>
      <a class="user" href="/settings">{session.user.name}</a>
      <button class="secondary" onclick={handleSignOut}>Sign out</button>
    </nav>
  </header>
  <main class="container">
    {@render children()}
  </main>
{:else if isPublic}
  <main class="container narrow">
    {@render children()}
  </main>
{:else}
  <p class="container muted">Loading…</p>
{/if}

<style>
  .topbar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .nav a {
    text-decoration: none;
    font-weight: 600;
  }

  .brand {
    color: var(--text);
  }

  .spacer {
    flex: 1;
  }

  .narrow {
    max-width: 420px;
    padding-top: 4rem;
  }
</style>
