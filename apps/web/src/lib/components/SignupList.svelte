<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { formatDate, formatTimeRange, todayIn } from '$lib/format';
  import type { MySignup } from '$lib/types';
  import type { Snippet } from 'svelte';

  let { signups, actions }: { signups: MySignup[]; actions?: Snippet<[MySignup]> } = $props();
</script>

<ul class="signups">
  {#each signups as signup (signup.id)}
    {@const today = signup.shift.date === todayIn(signup.event.timezone)}
    <li class="card" class:today>
      <div>
        <a href="/events/{signup.event.id}"><strong>{signup.event.name}</strong></a>
        {#if today}<span class="badge">Today</span>{/if}
        <StatusBadge status={signup.status} />
        {#if signup.waitlistPosition}<span class="muted">#{signup.waitlistPosition} in line</span
          >{/if}
        <p class="muted">
          {signup.role.name} · {formatDate(signup.shift.date)} · {formatTimeRange(signup.shift)}
          {#if signup.event.location}· {signup.event.location}{/if}
        </p>
        {#if new Date(signup.shift.startsAt) > new Date()}
          <a class="calendar" href="/api/signups/{signup.id}/calendar.ics" download
            >Add to calendar</a
          >
        {/if}
      </div>
      {#if actions}<div>{@render actions(signup)}</div>{/if}
    </li>
  {/each}
</ul>

<style>
  .signups {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  p {
    margin: 0.2rem 0 0;
  }

  a {
    text-decoration: none;
    margin-right: 0.4rem;
  }

  .today {
    border-left: 4px solid var(--primary);
  }

  .calendar {
    font-size: 0.85rem;
  }
</style>
