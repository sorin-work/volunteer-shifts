<script lang="ts">
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import { formatDate, formatDateTime, formatTimeRange } from '$lib/format';
  import type { Attendance, Roster, RosterEntry } from '$lib/types';

  let roster = $state<Roster | null>(null);
  let error = $state('');
  let busy = $state<number | null>(null);

  async function load() {
    try {
      roster = await api.get<Roster>(`/shifts/${page.params.id}/roster`);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load the roster.';
    }
  }

  async function mark(entry: RosterEntry, attendance: Attendance) {
    busy = entry.signupId;
    error = '';
    try {
      await api.post(`/signups/${entry.signupId}/attendance`, { attendance });
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not update attendance.';
    } finally {
      busy = null;
    }
  }

  const present = $derived(roster?.confirmed.filter((e) => e.attendance === 'present').length ?? 0);

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>Roster · Volunteer Shifts</title></svelte:head>

{#if roster}
  <p><a href="/events/{roster.event.id}/manage">← {roster.event.name}</a></p>
  <h1>{roster.role.name}</h1>
  <p class="muted">
    {formatDate(roster.shift.date)} · {formatTimeRange(roster.shift)} ({roster.event.timezone}) ·
    {present} of {roster.confirmed.length} checked in
  </p>
{/if}
{#if error}<p class="alert" role="alert">{error}</p>{/if}

{#if roster}
  <section>
    <h2>Confirmed ({roster.confirmed.length}/{roster.shift.capacity})</h2>
    {#if roster.confirmed.length === 0}
      <div class="card"><p class="muted">Nobody has signed up yet.</p></div>
    {:else}
      <table class="card">
        <thead>
          <tr><th>Volunteer</th><th>Contact</th><th>Attendance</th><th></th></tr>
        </thead>
        <tbody>
          {#each roster.confirmed as entry (entry.signupId)}
            <tr class={entry.attendance}>
              <td>{entry.volunteer.name}</td>
              <td>
                <a href="mailto:{entry.volunteer.email}">{entry.volunteer.email}</a>
                {#if entry.volunteer.phone}<br /><span class="muted">{entry.volunteer.phone}</span
                  >{/if}
              </td>
              <td>
                {#if entry.attendance === 'present' && entry.checkedInAt}
                  Checked in {formatDateTime(entry.checkedInAt, roster.event.timezone)}
                {:else if entry.attendance === 'no_show'}
                  No-show
                {:else}
                  <span class="muted">Not checked in</span>
                {/if}
              </td>
              <td class="actions">
                {#if entry.attendance === 'pending'}
                  <button disabled={busy === entry.signupId} onclick={() => mark(entry, 'present')}>
                    Check in
                  </button>
                  <button
                    class="secondary"
                    disabled={busy === entry.signupId}
                    onclick={() => mark(entry, 'no_show')}>No-show</button
                  >
                {:else}
                  <button
                    class="secondary"
                    disabled={busy === entry.signupId}
                    onclick={() => mark(entry, 'pending')}>Undo</button
                  >
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  {#if roster.waitlist.length}
    <section>
      <h2>Waitlist</h2>
      <ol class="card">
        {#each roster.waitlist as entry (entry.signupId)}
          <li>{entry.volunteer.name} <span class="muted">· {entry.volunteer.email}</span></li>
        {/each}
      </ol>
    </section>
  {/if}
{:else if !error}
  <p class="muted">Loading…</p>
{/if}

<style>
  section {
    margin-top: 1.5rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    padding: 0;
  }

  th,
  td {
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  tr.present td:first-child {
    border-left: 3px solid var(--primary);
  }

  tr.no_show td:first-child {
    border-left: 3px solid var(--danger);
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    justify-content: flex-end;
  }

  ol {
    padding-left: 2rem;
  }
</style>
