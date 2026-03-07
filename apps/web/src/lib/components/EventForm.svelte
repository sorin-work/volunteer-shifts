<script lang="ts">
  import { ApiError } from '$lib/api';

  export interface EventFormValues {
    name: string;
    description: string;
    location: string;
    timezone: string;
  }

  let {
    initial,
    submitLabel = 'Save',
    onsubmit,
  }: {
    initial?: Partial<EventFormValues>;
    submitLabel?: string;
    onsubmit: (values: EventFormValues) => Promise<void>;
  } = $props();

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones: string[] =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [browserZone];

  // svelte-ignore state_referenced_locally
  let values = $state<EventFormValues>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    timezone: initial?.timezone ?? browserZone,
  });
  let fields: Record<string, string> = $state({});
  let error = $state('');
  let saving = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    fields = {};
    error = '';
    saving = true;
    try {
      await onsubmit({ ...values });
    } catch (err) {
      if (err instanceof ApiError) {
        fields = err.fields;
        if (!Object.keys(fields).length) error = err.message;
      } else {
        error = 'Could not save the event.';
      }
    } finally {
      saving = false;
    }
  }
</script>

<form class="card" onsubmit={submit} novalidate>
  <div class="field">
    <label for="event-name">Name</label>
    <input id="event-name" bind:value={values.name} placeholder="Saturday food distribution" />
    {#if fields.name}<p class="field-error">{fields.name}</p>{/if}
  </div>
  <div class="field">
    <label for="event-location">Location</label>
    <input
      id="event-location"
      bind:value={values.location}
      placeholder="Riverside Community Hall"
    />
  </div>
  <div class="field">
    <label for="event-timezone">Time zone</label>
    <select id="event-timezone" bind:value={values.timezone}>
      {#each zones as zone (zone)}<option value={zone}>{zone}</option>{/each}
    </select>
    {#if fields.timezone}<p class="field-error">{fields.timezone}</p>{/if}
  </div>
  <div class="field">
    <label for="event-description">Description</label>
    <textarea id="event-description" rows="5" bind:value={values.description}></textarea>
    {#if fields.description}<p class="field-error">{fields.description}</p>{/if}
  </div>
  {#if error}<p class="alert">{error}</p>{/if}
  <p><button type="submit" disabled={saving}>{submitLabel}</button></p>
</form>
