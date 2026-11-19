<script>
  import ImportRapport from '#lib/components/ImportRapport.svelte';

  // form = résultat de l'action importReport (+page.server.js)=> fourni par SvelteKit
  let { form } = $props();
</script>

<h1>Explore les métiers de ton Rapport des Possibles</h1>
<p>Importe ton rapport (PDF) : tu pourras poser tes questions sur chaque métier.</p>

<ImportRapport {form} />
