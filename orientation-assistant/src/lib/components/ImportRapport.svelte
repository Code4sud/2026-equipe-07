
<script>
  import { enhance } from '$app/forms';

  // form = résultat de l'action (ex. { error: "..." } en cas d'échec), transmis par la page
  let { form } = $props();
</script>

<!-- enctype multipart : obligatoire pour envoyer un fichier -->
<form
  method="POST"
  enctype="multipart/form-data"
  use:enhance
  action="?/importReport"
>
  <input type="file" name="rapport-pdf" accept="application/pdf" required />
  <button type="submit">Importer mon rapport</button>
</form>

<!-- Message d'erreur en texte simple (pas de {@html}) -->
{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}


