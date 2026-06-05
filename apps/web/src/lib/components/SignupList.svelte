<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { formatDate, formatTimeRange } from '$lib/format';
  import type { MySignup } from '$lib/types';
  import type { Snippet } from 'svelte';

  let { signups, actions }: { signups: MySignup[]; actions?: Snippet<[MySignup]> } = $props();
</script>

<ul class="signups">
  {#each signups as signup (signup.id)}
    <li class="card">
      <div>
        <a href="/events/{signup.event.id}"><strong>{signup.event.name}</strong></a>
        <StatusBadge status={signup.status} />
        {#if signup.waitlistPosition}<span class="muted">#{signup.waitlistPosition} in line</span
          >{/if}
        <p class="muted">
          {signup.role.name} · {formatDate(signup.shift.date)} · {formatTimeRange(signup.shift)}
          {#if signup.event.location}· {signup.event.location}{/if}
        </p>
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
</style>
