
<script>
  import { enhance } from '$app/forms';
  import { Download, Plus } from '@lucide/svelte';

  // form = résultat de l'action (ex. { error: "..." } en cas d'échec), transmis par la page
  let { form } = $props();
  let selectedFileName = $state('Aucun fichier sélectionné');

  // true pendant l'envoi et l'analyse du PDF (1 à 2 s) : bouton désactivé + message
  let envoi = $state(false);
</script>

<!-- enctype multipart : obligatoire pour envoyer un fichier -->
<form class="flex flex-col gap-2"
  method="POST"
  enctype="multipart/form-data"
  action="?/importReport"
  use:enhance={() => {
    envoi = true; // au clic => début de l'envoi
    return async ({ update }) => {
      await update(); // résultat reçu : SvelteKit met à jour form et relance load() (liste des métiers)
      envoi = false;
      selectedFileName = 'Aucun fichier sélectionné'; // le champ fichier est vidé par update()
    };
  }}
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
   <!-- disabled:opacity-50 : bouton grisé pendant l'analyse -->
  <button class="flex cursor-pointer gap-2 items-center rounded-2xl h-8 px-4 bg-emerald-900 text-neutral-50 mr-auto disabled:opacity-50" type="submit" disabled={envoi}>
    <Download size=16 />
    <span>{envoi ? 'Analyse de ton rapport…' : 'Importer'}</span>
  </button>
</form>

<!-- Message d'erreur en texte simple (pas de {@html}) -->
{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}


