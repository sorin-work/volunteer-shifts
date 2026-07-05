<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head
  ><title>{page.status === 404 ? 'Not found' : 'Error'} · Volunteer Shifts</title></svelte:head
>

<div class="container">
  <div class="card stack">
    {#if page.status === 404}
      <h1>Page not found</h1>
      <p>We couldn't find <code>{page.url.pathname}</code>.</p>
    {:else}
      <h1>Something went wrong</h1>
      <p class="muted">{page.error?.message ?? 'Unexpected error.'}</p>
    {/if}
    <p><a class="button" href="/">Go to the home page</a></p>
  </div>
</div>
