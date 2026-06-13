<script lang="ts">
  import { api } from '$lib/api';
  import { describeSignupError } from '$lib/signup-errors';
  import type { Paged, VolunteerListItem } from '$lib/types';

  let { shiftId, onadded }: { shiftId: number; onadded: () => Promise<void> } = $props();

  let query = $state('');
  let matches: VolunteerListItem[] = $state([]);
  let error = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function search() {
    clearTimeout(timer);
    const q = query.trim();
    if (q.length < 2) {
      matches = [];
      return;
    }
    timer = setTimeout(async () => {
      const res = await api.get<Paged & { volunteers: VolunteerListItem[] }>(
        `/volunteers?pageSize=8&search=${encodeURIComponent(q)}`,
      );
      matches = res.volunteers;
    }, 250);
  }

  async function add(volunteer: VolunteerListItem) {
    error = '';
    try {
      await api.post(`/shifts/${shiftId}/signups`, { userId: volunteer.id });
      query = '';
      matches = [];
      await onadded();
    } catch (err) {
      error = `${volunteer.name}: ${describeSignupError(err)}`;
    }
  }
</script>

<div class="card stack">
  <label for="add-volunteer">Add a volunteer</label>
  <input
    id="add-volunteer"
    type="search"
    placeholder="Start typing a name or email"
    bind:value={query}
    oninput={search}
    autocomplete="off"
  />
  {#if matches.length}
    <ul class="matches">
      {#each matches as v (v.id)}
        <li>
          <span>{v.name} <span class="muted">{v.email}</span></span>
          <button class="secondary" onclick={() => add(v)}>Add</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}<p class="alert" role="alert">{error}</p>{/if}
</div>

<style>
  .matches {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .matches li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0;
  }
</style>
