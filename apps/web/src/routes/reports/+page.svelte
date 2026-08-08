<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import { formatHours } from '$lib/format';

  interface HoursReport {
    year: number;
    volunteers: { id: number; name: string; email: string; hours: number; shifts: number }[];
    totals: { volunteers: number; hours: number; shifts: number };
  }

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);
  let year = $state(thisYear);
  let report = $state<HoursReport | null>(null);
  let error = $state('');

  $effect(() => {
    const y = year;
    error = '';
    api
      .get<HoursReport>(`/reports/hours?year=${y}`)
      .then((res) => (report = res))
      .catch(
        (err) => (error = err instanceof ApiError ? err.message : 'Could not load the report.'),
      );
  });
</script>

<svelte:head><title>Reports · Volunteer Shifts</title></svelte:head>

<div class="header">
  <h1>Volunteer hours</h1>
  <div class="controls">
    <select bind:value={year} aria-label="Year">
      {#each years as y (y)}<option value={y}>{y}</option>{/each}
    </select>
    <a class="button secondary" href="/api/reports/hours.csv?year={year}" download>Download CSV</a>
  </div>
</div>

{#if error}<p class="alert">{error}</p>{/if}

{#if report}
  <div class="stats">
    <div class="card">
      <span class="muted">Volunteers</span><strong>{report.totals.volunteers}</strong>
    </div>
    <div class="card">
      <span class="muted">Hours</span><strong>{formatHours(report.totals.hours)}</strong>
    </div>
    <div class="card">
      <span class="muted">Shifts worked</span><strong>{report.totals.shifts}</strong>
    </div>
  </div>

  {#if report.volunteers.length === 0}
    <div class="card"><p>No hours were logged in {report.year}.</p></div>
  {:else}
    <table class="card">
      <thead><tr><th>Volunteer</th><th class="num">Shifts</th><th class="num">Hours</th></tr></thead
      >
      <tbody>
        {#each report.volunteers as v (v.id)}
          <tr>
            <td><a href="/volunteers/{v.id}">{v.name}</a> <span class="muted">{v.email}</span></td>
            <td class="num">{v.shifts}</td>
            <td class="num">{formatHours(v.hours)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  .header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
  }

  .controls select {
    width: auto;
  }

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

  .num {
    text-align: right;
  }
</style>
