<script lang="ts">
  import { formatDescription } from '$lib/text';

  let { text }: { text: string } = $props();
</script>

<!-- formatDescription escapes the text before adding links and line breaks. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<p class="description">{@html formatDescription(text)}</p>

<style>
  .description {
    max-width: 65ch;
  }
</style>
