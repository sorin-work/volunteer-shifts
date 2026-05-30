<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import type { SkillRef } from '$lib/types';

  let skills: SkillRef[] = $state([]);
  let name = $state('');
  let error = $state('');

  async function load() {
    skills = (await api.get<{ skills: SkillRef[] }>('/skills')).skills;
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    try {
      await api.post('/skills', { name });
      name = '';
      await load();
    } catch (err) {
      error =
        err instanceof ApiError ? (err.fields.name ?? err.message) : 'Could not add the skill.';
    }
  }

  async function remove(skill: SkillRef) {
    if (!confirm(`Remove "${skill.name}"? It will be taken off every volunteer and role.`)) return;
    try {
      await api.delete(`/skills/${skill.id}`);
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not remove the skill.';
    }
  }

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>Skills · Volunteer Shifts</title></svelte:head>

<h1>Skills and certificates</h1>
<p class="muted">
  Skills you confirm for volunteers, like a food hygiene certificate. Roles can require them.
</p>

<div class="card stack">
  {#if skills.length === 0}
    <p class="muted">No skills yet.</p>
  {:else}
    <ul class="skills">
      {#each skills as skill (skill.id)}
        <li>
          {skill.name}
          <button class="secondary" onclick={() => remove(skill)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
  <form class="add" onsubmit={add}>
    <input aria-label="New skill" placeholder="e.g. Forklift licence" bind:value={name} />
    <button type="submit">Add</button>
  </form>
  {#if error}<p class="alert">{error}</p>{/if}
</div>

<style>
  .skills {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .skills li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
  }

  .add {
    display: flex;
    gap: 0.5rem;
  }
</style>
