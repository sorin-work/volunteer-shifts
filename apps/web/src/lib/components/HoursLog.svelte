<script lang="ts">
  import { formatDate, formatHours, plural } from '$lib/format';
  import type { HoursLog } from '$lib/types';
  import type { Snippet } from 'svelte';

  let {
    log,
    entryActions,
  }: { log: HoursLog; entryActions?: Snippet<[HoursLog['entries'][number]]> } = $props();

  const certificateUrl = (year: number) =>
    `/api/volunteers/${log.volunteer.id}/certificates/${year}`;
</script>

{#if log.totals.length === 0}
  <div class="card">
    <p>No hours logged yet. Hours are added when a coordinator checks you in at a shift.</p>
  </div>
{:else}
  <div class="totals">
    {#each log.totals as total (total.year)}
      <div class="card total">
        <span class="muted">{total.year}</span>
        <strong>{formatHours(total.hours)}</strong>
        <span class="muted">{plural(total.entries, 'entry', 'entries')}</span>
        <a href={certificateUrl(total.year)} download>Certificate (PDF)</a>
      </div>
    {/each}
  </div>

  <table class="card">
    <thead><tr><th>Date</th><th>What</th><th class="num">Hours</th><th></th></tr></thead>
    <tbody>
      {#each log.entries as entry (entry.id)}
        <tr>
          <td>{formatDate(entry.workedOn)}</td>
          <td>
            {entry.description}
            {#if entry.source === 'manual'}<span class="badge muted">added by coordinator</span
              >{/if}
          </td>
          <td class="num">{formatHours(entry.hours)}</td>
          <td
            >{#if entryActions}{@render entryActions(entry)}{/if}</td
          >
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .total {
    display: grid;
    min-width: 140px;
  }

  .total strong {
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
    white-space: nowrap;
  }
</style>
