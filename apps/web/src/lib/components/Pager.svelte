<script lang="ts">
  let {
    page,
    totalPages,
    onpage,
  }: { page: number; totalPages: number; onpage: (page: number) => void } = $props();
</script>

{#if totalPages > 1}
  <nav class="pager" aria-label="Pagination">
    <button class="secondary" disabled={page <= 1} onclick={() => onpage(page - 1)}>Previous</button
    >
    <span class="muted">Page {page} of {totalPages}</span>
    <button class="secondary" disabled={page >= totalPages} onclick={() => onpage(page + 1)}
      >Next</button
    >
  </nav>
{/if}

<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1rem;
  }
</style>
