<script lang="ts">
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import AddHoursForm from '$lib/components/AddHoursForm.svelte';
  import HoursLogView from '$lib/components/HoursLog.svelte';
  import { formatHours } from '$lib/format';
  import type { HoursLog, SkillRef, VolunteerProfile } from '$lib/types';

  let profile = $state<VolunteerProfile | null>(null);
  let log = $state<HoursLog | null>(null);
  let allSkills: SkillRef[] = $state([]);
  let selectedSkills: number[] = $state([]);
  let error = $state('');
  let skillsSaved = $state(false);

  async function load() {
    try {
      const id = page.params.id;
      const [p, h, s] = await Promise.all([
        api.get<VolunteerProfile>(`/volunteers/${id}`),
        api.get<HoursLog>(`/volunteers/${id}/hours`),
        api.get<{ skills: SkillRef[] }>('/skills'),
      ]);
      profile = p;
      log = h;
      allSkills = s.skills;
      selectedSkills = p.volunteer.skills.map((x) => x.id);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load this volunteer.';
    }
  }

  async function removeEntry(id: number) {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.delete(`/hours/${id}`);
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete the entry.';
    }
  }

  async function saveSkills() {
    skillsSaved = false;
    try {
      await api.put(`/volunteers/${page.params.id}/skills`, { skillIds: selectedSkills });
      skillsSaved = true;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not save skills.';
    }
  }

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>{profile?.volunteer.name ?? 'Volunteer'} · Volunteer Shifts</title></svelte:head
>

<p><a href="/volunteers">← Volunteers</a></p>
{#if error}<p class="alert">{error}</p>{/if}

{#if profile}
  {@const v = profile.volunteer}
  <h1>{v.name}</h1>
  <p class="muted">
    <a href="mailto:{v.email}">{v.email}</a>
    {#if v.phone}· {v.phone}{/if}
    {#if v.birthDate}· born {v.birthDate}{/if}
  </p>

  <div class="stats">
    <div class="card">
      <span class="muted">Upcoming</span><strong>{profile.stats.upcomingShifts}</strong>
    </div>
    <div class="card">
      <span class="muted">Attended</span><strong>{profile.stats.attended}</strong>
    </div>
    <div class="card">
      <span class="muted">No-shows</span><strong>{profile.stats.noShows}</strong>
    </div>
    <div class="card">
      <span class="muted">Hours this year</span><strong
        >{formatHours(profile.stats.hoursThisYear)}</strong
      >
    </div>
  </div>

  <section>
    <h2>Skills</h2>
    <div class="card">
      {#if allSkills.length === 0}
        <p class="muted">No skills have been set up yet.</p>
      {:else}
        {#each allSkills as skill (skill.id)}
          <label class="check">
            <input type="checkbox" value={skill.id} bind:group={selectedSkills} />
            {skill.name}
          </label>
        {/each}
        <p>
          <button onclick={saveSkills}>Save skills</button>
          {#if skillsSaved}<span class="muted" role="status">Saved.</span>{/if}
        </p>
      {/if}
    </div>
  </section>

  {#if log}
    <section>
      <h2>Hours</h2>
      <HoursLogView {log}>
        {#snippet entryActions(entry)}
          {#if entry.source === 'manual'}
            <button class="secondary" onclick={() => removeEntry(entry.id)}>Delete</button>
          {/if}
        {/snippet}
      </HoursLogView>
      <AddHoursForm volunteerId={profile.volunteer.id} onadded={load} />
    </section>
  {/if}
{:else if !error}
  <p class="muted">Loading…</p>
{/if}

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0;
  }

  .stats .card {
    display: grid;
  }

  .stats strong {
    font-size: 1.5rem;
  }

  section {
    margin-top: 1.5rem;
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
