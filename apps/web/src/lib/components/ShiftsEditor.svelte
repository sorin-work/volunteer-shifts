<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import { formatDate, formatTimeRange, groupByDate } from '$lib/format';
  import type { EventRole, EventShift } from '$lib/types';

  let {
    eventId,
    timezone,
    roles,
    shifts,
    onchange,
  }: {
    eventId: number;
    timezone: string;
    roles: EventRole[];
    shifts: EventShift[];
    onchange: () => Promise<void>;
  } = $props();

  const emptyForm = () => ({
    roleId: roles[0]?.id ?? 0,
    date: '',
    startTime: '09:00',
    endTime: '12:00',
    capacity: 4,
    notes: '',
  });

  let editingId = $state<number | null>(null);
  let form = $state(emptyForm());
  let fields: Record<string, string> = $state({});
  let error = $state('');

  const roleName = (id: number) => roles.find((r) => r.id === id)?.name ?? 'Unknown role';
  const days = $derived(groupByDate<EventShift>(shifts));

  function reset() {
    editingId = null;
    form = emptyForm();
    fields = {};
    error = '';
  }

  function edit(shift: EventShift) {
    editingId = shift.id;
    form = {
      roleId: shift.roleId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      capacity: shift.capacity,
      notes: shift.notes,
    };
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    fields = {};
    error = '';
    const body = { ...form, roleId: Number(form.roleId), capacity: Number(form.capacity) };
    try {
      if (editingId) await api.patch(`/shifts/${editingId}`, body);
      else await api.post(`/events/${eventId}/shifts`, body);
      // Keep role and times so the next shift on another day is quick to add.
      const keep = { ...form, date: '' };
      reset();
      form = keep;
      await onchange();
    } catch (err) {
      if (err instanceof ApiError) {
        fields = err.fields;
        if (!Object.keys(fields).length) error = err.message;
      } else error = 'Could not save the shift.';
    }
  }

  let copyFrom = $state<string | null>(null);
  let copyTo = $state('');

  async function copyDay(event: SubmitEvent) {
    event.preventDefault();
    if (!copyFrom || !copyTo) return;
    error = '';
    try {
      await api.post(`/events/${eventId}/shifts/copy`, { fromDate: copyFrom, toDate: copyTo });
      copyFrom = null;
      copyTo = '';
      await onchange();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not copy the shifts.';
    }
  }

  async function remove(shift: EventShift) {
    const taken = shift.confirmedCount + shift.waitlistCount;
    const warning = taken ? ` ${taken} volunteer(s) are signed up.` : '';
    if (!confirm(`Delete this shift?${warning}`)) return;
    try {
      await api.delete(`/shifts/${shift.id}`);
      await onchange();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete the shift.';
    }
  }
</script>

<div class="card stack">
  {#if roles.length === 0}
    <p class="muted">Add at least one role before creating shifts.</p>
  {:else}
    {#each days as day (day.date)}
      <div>
        <div class="day-header">
          <h3>{formatDate(day.date)}</h3>
          <button class="secondary small" onclick={() => (copyFrom = day.date)}>Copy day…</button>
        </div>
        {#if copyFrom === day.date}
          <form class="copy" onsubmit={copyDay}>
            <label for="copy-to">Copy these shifts to</label>
            <input id="copy-to" type="date" bind:value={copyTo} required />
            <button type="submit">Copy</button>
            <button type="button" class="secondary" onclick={() => (copyFrom = null)}>Cancel</button
            >
          </form>
        {/if}
        <ul class="shifts">
          {#each day.shifts as shift (shift.id)}
            <li>
              <span>
                <strong>{roleName(shift.roleId)}</strong>
                {formatTimeRange(shift)} · {shift.confirmedCount}/{shift.capacity}
                {#if shift.waitlistCount}· {shift.waitlistCount} waiting{/if}
              </span>
              <span class="row-actions">
                <a class="button secondary" href="/shifts/{shift.id}">Roster</a>
                <button class="secondary" onclick={() => edit(shift)}>Edit</button>
                <button class="secondary" onclick={() => remove(shift)}>Delete</button>
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}

    <form onsubmit={submit} novalidate>
      <h3>{editingId ? 'Edit shift' : 'Add a shift'}</h3>
      <p class="muted">
        Times are in {timezone}. An end time before the start means the shift ends the next day.
      </p>
      <div class="grid">
        <div class="field">
          <label for="shift-role">Role</label>
          <select id="shift-role" bind:value={form.roleId}>
            {#each roles as role (role.id)}<option value={role.id}>{role.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="shift-date">Date</label>
          <input id="shift-date" type="date" bind:value={form.date} />
          {#if fields.date}<p class="field-error">{fields.date}</p>{/if}
        </div>
        <div class="field">
          <label for="shift-start">Start</label>
          <input id="shift-start" type="time" bind:value={form.startTime} />
          {#if fields.startTime}<p class="field-error">{fields.startTime}</p>{/if}
        </div>
        <div class="field">
          <label for="shift-end">End</label>
          <input id="shift-end" type="time" bind:value={form.endTime} />
          {#if fields.endTime}<p class="field-error">{fields.endTime}</p>{/if}
        </div>
        <div class="field">
          <label for="shift-capacity">Volunteers needed</label>
          <input id="shift-capacity" type="number" min="1" bind:value={form.capacity} />
          {#if fields.capacity}<p class="field-error">{fields.capacity}</p>{/if}
        </div>
      </div>
      <div class="field">
        <label for="shift-notes">Notes for volunteers</label>
        <input id="shift-notes" bind:value={form.notes} placeholder="Closed-toe shoes please" />
      </div>
      {#if error}<p class="alert">{error}</p>{/if}
      <p class="row-actions">
        <button type="submit">{editingId ? 'Save shift' : 'Add shift'}</button>
        {#if editingId}<button type="button" class="secondary" onclick={reset}>Cancel</button>{/if}
      </p>
    </form>
  {/if}
</div>

<style>
  .shifts {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }

  .shifts li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
  }

  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .small {
    padding: 0.2rem 0.6rem;
    font-size: 0.85rem;
  }

  .copy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .copy label {
    margin: 0;
  }

  .copy input {
    width: auto;
  }

  .row-actions {
    display: flex;
    gap: 0.5rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }
</style>
