<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ApiError } from '$lib/api';
  import { signIn } from '$lib/session.svelte';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let submitting = $state(false);

  function nextPath(): string {
    const next = page.url.searchParams.get('next');
    // Only follow local paths so the link can't bounce people to another site.
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    submitting = true;
    try {
      await signIn(email, password);
      await goto(nextPath(), { replaceState: true });
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not sign in.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>Sign in · Volunteer Shifts</title></svelte:head>

<div class="card stack">
  <h1>Sign in</h1>
  <form onsubmit={submit}>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="email" required bind:value={email} />
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        autocomplete="current-password"
        required
        bind:value={password}
      />
    </div>
    {#if error}<p class="alert" role="alert">{error}</p>{/if}
    <p><button type="submit" disabled={submitting}>Sign in</button></p>
  </form>
  <p class="muted">New here? <a href="/register">Create a volunteer account</a></p>
</div>
