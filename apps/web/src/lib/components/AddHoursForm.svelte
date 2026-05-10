<script lang="ts">
  import { api, ApiError } from '$lib/api';

  let { volunteerId, onadded }: { volunteerId: number; onadded: () => Promise<void> } = $props();

  const today = new Date().toISOString().slice(0, 10);
  let form = $state({ workedOn: today, hours: 1, description: '' });
  let fields: Record<string, string> = $state({});
  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    fields = {};
    error = '';
    try {
      await api.post(`/volunteers/${volunteerId}/hours`, { ...form, hours: Number(form.hours) });
      form = { workedOn: today, hours: 1, description: '' };
      await onadded();
    } catch (err) {
      if (err instanceof ApiError) {
        fields = err.fields;
        if (!Object.keys(fields).length) error = err.message;
      } else error = 'Could not add the hours.';
    }
  }
</script>

<form class="card" onsubmit={submit} novalidate>
  <h3>Log hours outside a shift</h3>
  <div class="grid">
    <div class="field">
      <label for="hours-date">Date</label>
      <input id="hours-date" type="date" max={today} bind:value={form.workedOn} />
      {#if fields.workedOn}<p class="field-error">{fields.workedOn}</p>{/if}
    </div>
    <div class="field">
      <label for="hours-hours">Hours</label>
      <input
        id="hours-hours"
        type="number"
        min="0.25"
        max="24"
        step="0.25"
        bind:value={form.hours}
      />
      {#if fields.hours}<p class="field-error">{fields.hours}</p>{/if}
    </div>
  </div>
  <div class="field">
    <label for="hours-description">What for</label>
    <input id="hours-description" bind:value={form.description} placeholder="Training session" />
    {#if fields.description}<p class="field-error">{fields.description}</p>{/if}
  </div>
  {#if error}<p class="alert">{error}</p>{/if}
  <p><button type="submit">Add hours</button></p>
</form>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
</style>
