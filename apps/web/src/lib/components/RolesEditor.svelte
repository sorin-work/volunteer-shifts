<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import type { EventRole, SkillRef } from '$lib/types';

  let {
    eventId,
    roles,
    onchange,
  }: { eventId: number; roles: EventRole[]; onchange: () => Promise<void> } = $props();

  let skills: SkillRef[] = $state([]);
  let editingId = $state<number | null>(null);
  let form = $state({ name: '', description: '', minAge: '', skillIds: [] as number[] });
  let fields: Record<string, string> = $state({});
  let error = $state('');

  $effect(() => {
    api.get<{ skills: SkillRef[] }>('/skills').then((res) => (skills = res.skills));
  });

  function reset() {
    editingId = null;
    form = { name: '', description: '', minAge: '', skillIds: [] };
    fields = {};
    error = '';
  }

  function edit(role: EventRole) {
    editingId = role.id;
    form = {
      name: role.name,
      description: role.description,
      minAge: role.minAge === null ? '' : String(role.minAge),
      skillIds: role.requiredSkills.map((s) => s.id),
    };
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    fields = {};
    error = '';
    const body = {
      name: form.name,
      description: form.description,
      minAge: form.minAge === '' ? null : Number(form.minAge),
      skillIds: form.skillIds,
    };
    try {
      if (editingId) await api.patch(`/roles/${editingId}`, body);
      else await api.post(`/events/${eventId}/roles`, body);
      reset();
      await onchange();
    } catch (err) {
      if (err instanceof ApiError) {
        fields = err.fields;
        if (!Object.keys(fields).length) error = err.message;
      } else error = 'Could not save the role.';
    }
  }

  async function remove(role: EventRole) {
    if (!confirm(`Delete the ${role.name} role?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      await onchange();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete the role.';
    }
  }
</script>

<div class="card stack">
  {#if roles.length === 0}
    <p class="muted">
      No roles yet. Add the kinds of jobs volunteers will do, like "Sorting" or "Driver".
    </p>
  {:else}
    <ul class="roles">
      {#each roles as role (role.id)}
        <li>
          <div>
            <strong>{role.name}</strong>
            {#if role.minAge !== null}<span class="badge muted">{role.minAge}+</span>{/if}
            {#each role.requiredSkills as skill (skill.id)}<span class="badge muted"
                >{skill.name}</span
              >{/each}
            {#if role.description}<p class="muted">{role.description}</p>{/if}
          </div>
          <div class="row-actions">
            <button class="secondary" onclick={() => edit(role)}>Edit</button>
            <button class="secondary" onclick={() => remove(role)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <form onsubmit={submit} novalidate>
    <h3>{editingId ? 'Edit role' : 'Add a role'}</h3>
    <div class="grid">
      <div class="field">
        <label for="role-name">Name</label>
        <input id="role-name" bind:value={form.name} />
        {#if fields.name}<p class="field-error">{fields.name}</p>{/if}
      </div>
      <div class="field">
        <label for="role-age">Minimum age</label>
        <input id="role-age" type="number" min="0" max="120" bind:value={form.minAge} />
        {#if fields.minAge}<p class="field-error">{fields.minAge}</p>{/if}
      </div>
    </div>
    <div class="field">
      <label for="role-description">Description</label>
      <input id="role-description" bind:value={form.description} />
    </div>
    {#if skills.length}
      <fieldset class="field">
        <legend>Required skills</legend>
        {#each skills as skill (skill.id)}
          <label class="check">
            <input type="checkbox" value={skill.id} bind:group={form.skillIds} />
            {skill.name}
          </label>
        {/each}
      </fieldset>
    {/if}
    {#if error}<p class="alert">{error}</p>{/if}
    <p class="row-actions">
      <button type="submit">{editingId ? 'Save role' : 'Add role'}</button>
      {#if editingId}<button type="button" class="secondary" onclick={reset}>Cancel</button>{/if}
    </p>
  </form>
</div>

<style>
  .roles {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .roles li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  .roles p {
    margin: 0.2rem 0 0;
  }

  .row-actions {
    display: flex;
    gap: 0.5rem;
  }

  .grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 0.75rem;
  }

  fieldset {
    border: none;
    padding: 0;
  }

  legend {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 400;
    margin-right: 1rem;
  }

  .check input {
    width: auto;
  }
</style>
