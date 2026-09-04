<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import Pager from '$lib/components/Pager.svelte';
  import { plural } from '$lib/format';
  import type { Paged, VolunteerListItem } from '$lib/types';

  const current = $derived(Number(page.url.searchParams.get('page') ?? '1') || 1);
  const search = $derived(page.url.searchParams.get('search') ?? '');

  let result = $state<(Paged & { volunteers: VolunteerListItem[] }) | null>(null);
  let error = $state('');
  // svelte-ignore state_referenced_locally
  let query = $state(search);

  $effect(() => {
    const params = new URLSearchParams({ page: String(current), ...(search ? { search } : {}) });
    api
      .get<Paged & { volunteers: VolunteerListItem[] }>(`/volunteers?${params}`)
      .then((res) => (result = res))
      .catch(
        (err) => (error = err instanceof ApiError ? err.message : 'Could not load volunteers.'),
      );
  });

  function go(nextPage: number, nextSearch = search) {
    const qs = new URLSearchParams({
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
      ...(nextSearch ? { search: nextSearch } : {}),
    }).toString();
    goto(`/volunteers${qs ? `?${qs}` : ''}`, { keepFocus: true });
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    go(1, query.trim());
  }
</script>

<svelte:head><title>Volunteers · Volunteer Shifts</title></svelte:head>

<h1>Volunteers</h1>

<form class="search" onsubmit={submit} role="search">
  <input
    type="search"
    placeholder="Search by name or email"
    bind:value={query}
    aria-label="Search"
  />
  <button type="submit">Search</button>
</form>

{#if error}<p class="alert">{error}</p>{/if}

{#if result}
  <p class="muted">{plural(result.total, 'person', 'people')}</p>
  {#if result.volunteers.length === 0}
    <div class="card"><p>Nobody matches “{search}”.</p></div>
  {:else}
    <table class="card">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
      <tbody>
        {#each result.volunteers as v (v.id)}
          <tr>
            <td>
              <a href="/volunteers/{v.id}">{v.name}</a>
              {#if v.role === 'coordinator'}<span class="badge">coordinator</span>{/if}
            </td>
            <td>{v.email}</td>
            <td>{v.phone ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <Pager page={result.page} totalPages={result.totalPages} onpage={(p) => go(p)} />
  {/if}
{/if}

<style>
  .search {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
    max-width: 520px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    padding: 0;
  }

  th,
  td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }
</style>
