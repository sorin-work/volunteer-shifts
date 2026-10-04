<script lang="ts">
  const today = new Date().toISOString().slice(0, 10);
  import { goto } from '$app/navigation';
  import { ApiError } from '$lib/api';
  import { register } from '$lib/session.svelte';

  let form = $state({ name: '', email: '', password: '', phone: '', birthDate: '' });
  let fields: Record<string, string> = $state({});
  let error = $state('');
  let submitting = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    fields = {};
    submitting = true;
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        birthDate: form.birthDate || undefined,
      });
      await goto('/events', { replaceState: true });
    } catch (err) {
      if (err instanceof ApiError) {
        fields = err.fields;
        error = Object.keys(fields).length ? '' : err.message;
      } else {
        error = 'Could not create the account.';
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>Create account · Volunteer Shifts</title></svelte:head>

<div class="card stack">
  <h1>Create a volunteer account</h1>
  <form onsubmit={submit} novalidate>
    <div class="field">
      <label for="name">Full name</label>
      <input id="name" autocomplete="name" bind:value={form.name} />
      {#if fields.name}<p class="field-error">{fields.name}</p>{/if}
    </div>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="email" bind:value={form.email} />
      {#if fields.email}<p class="field-error">{fields.email}</p>{/if}
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="new-password" bind:value={form.password} />
      {#if fields.password}<p class="field-error">{fields.password}</p>{/if}
    </div>
    <div class="field">
      <label for="phone">Phone <span class="muted">(optional)</span></label>
      <input id="phone" type="tel" autocomplete="tel" bind:value={form.phone} />
    </div>
    <div class="field">
      <label for="birthDate">Date of birth <span class="muted">(needed for some roles)</span></label
      >
      <input id="birthDate" type="date" max={today} bind:value={form.birthDate} />
      {#if fields.birthDate}<p class="field-error">{fields.birthDate}</p>{/if}
    </div>
    {#if error}<p class="alert" role="alert">{error}</p>{/if}
    <p><button type="submit" disabled={submitting}>Create account</button></p>
  </form>
  <p class="muted">Already registered? <a href="/login">Sign in</a></p>
</div>
