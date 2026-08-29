<script lang="ts">
  import { goto } from '$app/navigation';
  import { api, ApiError } from '$lib/api';
  import { session } from '$lib/session.svelte';
  import type { User } from '$lib/types';

  let profile = $state({
    name: session.user?.name ?? '',
    phone: session.user?.phone ?? '',
    birthDate: session.user?.birthDate ?? '',
  });
  let profileFields: Record<string, string> = $state({});
  let profileMessage = $state('');

  let passwords = $state({ currentPassword: '', newPassword: '' });
  let passwordFields: Record<string, string> = $state({});
  let passwordMessage = $state('');

  async function saveProfile(event: SubmitEvent) {
    event.preventDefault();
    profileFields = {};
    profileMessage = '';
    try {
      const { user } = await api.patch<{ user: User }>('/me/profile', {
        name: profile.name,
        phone: profile.phone || null,
        birthDate: profile.birthDate || null,
      });
      session.user = { ...session.user, ...user };
      profileMessage = 'Profile saved.';
    } catch (err) {
      if (err instanceof ApiError) {
        profileFields = err.fields;
        if (!Object.keys(profileFields).length) profileMessage = err.message;
      }
    }
  }

  let deletePassword = $state('');
  let deleteError = $state('');

  async function deleteAccount(event: SubmitEvent) {
    event.preventDefault();
    deleteError = '';
    if (!confirm('Delete your account and your hours history? This cannot be undone.')) return;
    try {
      await api.delete('/me/profile', { body: { password: deletePassword } });
      session.user = null;
      await goto('/login', { replaceState: true });
    } catch (err) {
      if (err instanceof ApiError) deleteError = err.fields.password ?? err.message;
    }
  }

  async function changePassword(event: SubmitEvent) {
    event.preventDefault();
    passwordFields = {};
    passwordMessage = '';
    try {
      await api.post('/me/profile/password', passwords);
      passwords = { currentPassword: '', newPassword: '' };
      passwordMessage = 'Password changed. Other devices have been signed out.';
    } catch (err) {
      if (err instanceof ApiError) {
        passwordFields = err.fields;
        if (!Object.keys(passwordFields).length) passwordMessage = err.message;
      }
    }
  }
</script>

<svelte:head><title>Settings · Volunteer Shifts</title></svelte:head>

<h1>Settings</h1>

<div class="columns">
  <form class="card" onsubmit={saveProfile} novalidate>
    <h2>Profile</h2>
    <div class="field">
      <label for="name">Name</label>
      <input id="name" bind:value={profile.name} />
      {#if profileFields.name}<p class="field-error">{profileFields.name}</p>{/if}
    </div>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" value={session.user?.email} disabled />
    </div>
    <div class="field">
      <label for="phone">Phone</label>
      <input id="phone" type="tel" bind:value={profile.phone} />
    </div>
    <div class="field">
      <label for="birthDate">Date of birth</label>
      <input id="birthDate" type="date" bind:value={profile.birthDate} />
      {#if profileFields.birthDate}<p class="field-error">{profileFields.birthDate}</p>{/if}
    </div>
    {#if profileMessage}<p class="muted" role="status">{profileMessage}</p>{/if}
    <p><button type="submit">Save profile</button></p>
  </form>

  <form class="card" onsubmit={changePassword} novalidate>
    <h2>Password</h2>
    <div class="field">
      <label for="current">Current password</label>
      <input
        id="current"
        type="password"
        autocomplete="current-password"
        bind:value={passwords.currentPassword}
      />
      {#if passwordFields.currentPassword}<p class="field-error">
          {passwordFields.currentPassword}
        </p>{/if}
    </div>
    <div class="field">
      <label for="new">New password</label>
      <input
        id="new"
        type="password"
        autocomplete="new-password"
        bind:value={passwords.newPassword}
      />
      {#if passwordFields.newPassword}<p class="field-error">{passwordFields.newPassword}</p>{/if}
    </div>
    {#if passwordMessage}<p class="muted" role="status">{passwordMessage}</p>{/if}
    <p><button type="submit">Change password</button></p>
  </form>

  <form class="card danger-zone" onsubmit={deleteAccount} novalidate>
    <h2>Delete account</h2>
    <p class="muted">
      This removes your profile, sign-ups and logged hours. Download your certificates first if you
      need them.
    </p>
    <div class="field">
      <label for="delete-password">Password</label>
      <input
        id="delete-password"
        type="password"
        autocomplete="current-password"
        bind:value={deletePassword}
      />
    </div>
    {#if deleteError}<p class="field-error">{deleteError}</p>{/if}
    <p><button type="submit" class="danger">Delete my account</button></p>
  </form>
</div>

<style>
  .danger-zone {
    border-color: var(--danger);
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    align-items: start;
  }
</style>
