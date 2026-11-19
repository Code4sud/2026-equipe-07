
<script>
  import { enhance } from '$app/forms';
  import { Download, Plus } from '@lucide/svelte';


  // form = résultat de l'action (ex. { error: "..." } en cas d'échec), transmis par la page
  let { form } = $props();
  let selectedFileName = $state('Aucun fichier sélectionné');
</script>

<!-- enctype multipart : obligatoire pour envoyer un fichier -->
<form class="flex flex-col gap-2"
  method="POST"
  enctype="multipart/form-data"
  use:enhance
  action="?/importReport"
>
  <div class="flex gap-2 items-center">
    <input
      id="import-pdf"
      class="sr-only"
      type="file"
      name="rapport-pdf"
      accept="application/pdf"
      required
      onchange={(event) => {
        selectedFileName = event.currentTarget.files?.[0]?.name ?? 'Aucun fichier sélectionné';
      }}
    />
    <label
      for="import-pdf"
      class="flex cursor-pointer items-center justify-center rounded-2xl w-8 h-8 text-emerald-900 border border-emerald-900"
    >
      <Plus class="stroke-emerald-900" size={16} />
    </label>
    <span>{selectedFileName}</span>
  </div>
  <button class="flex cursor-pointer gap-2 items-center rounded-2xl h-8 px-4 bg-emerald-900 text-neutral-50 mr-auto" type="submit">
    <Download size=16 />
    <span>Importer</span>
  </button>
</form>

<!-- Message d'erreur en texte simple (pas de {@html}) -->
{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}


