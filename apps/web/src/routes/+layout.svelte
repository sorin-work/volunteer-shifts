<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { loadSession, session, signOut } from '$lib/session.svelte';

  let { children } = $props();
  let menuOpen = $state(false);

  const publicPaths = ['/login', '/register'];
  const isPublic = $derived(publicPaths.includes(page.url.pathname));

  $effect(() => {
    if (!session.loaded) loadSession();
  });

  // Close the phone menu after navigating.
  $effect(() => {
    void page.url.pathname;
    menuOpen = false;
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
      <button
        class="secondary menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-menu"
        onclick={() => (menuOpen = !menuOpen)}>Menu</button
      >
      <div id="main-menu" class="links" class:open={menuOpen}>
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
      </div>
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

  .links {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex: 1;
  }

  .menu-toggle {
    display: none;
    margin-left: auto;
  }

  @media (max-width: 720px) {
    .nav {
      flex-wrap: wrap;
    }

    .menu-toggle {
      display: inline-flex;
    }

    .links {
      display: none;
      flex-basis: 100%;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      padding-top: 0.5rem;
    }

    .links.open {
      display: flex;
    }

    .spacer {
      display: none;
    }
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
