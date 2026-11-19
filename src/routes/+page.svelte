<script>
  import ImportRapport from "#lib/components/ImportRapport.svelte";

  // form = résultat de l'action importReport (+page.server.js)=> fourni par SvelteKit
  let { form } = $props();
</script>

<section class="mx-8 mt-8">
  <p class="uppercase text-emerald-900 font-semibold">
    Ton avenir, on en parle?
  </p>
  <h2 class="font-semibold text-2xl">Quel métier te donne envie?</h2>
  <p>
    Comprends les métiers, découvre et trouve des formations près de chez toi,
    avec ou sans le bac.
  </p>
</section>

<section
  class="flex flex-col mx-8 border border-none rounded-lg bg-neutral-100 gap-4 px-4 py-4"
>
  <p class="font-semibold text-lg">
    Pour commencer, donne-moi un point de départ
  </p>
  <div class="flex flex-col md:flex-row md:gap-16">
    <div class="flex flex-col gap-2 md:basis-1/2">
      <p class="font-semibold">Parle-moi de toi</p>
      <p>
        Tes envies, ton niveau d'études, ta ville ou un métier qui t'intrigue.
      </p>
      <p class="text-emerald-900">
        Ton rapport des possibles est fortement conseillé.
      </p>
    </div>
    <div class="md:basis-1/2 flex flex-col gap-2">
      <p class="font-semibold">Ajoute ton rapport des possibles</p>
      <ImportRapport {form} />
    </div>
  </div>
</section>

<section class="flex flex-col gap-4 mx-8">
  <p>Tu peux aussi commencer par...</p>
  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex flex-col basis-1/3 border border-neutral-900 rounded-lg p-4 gap-2">
      <p class="font-semibold">C'est quoi, ce métier ?</p>
      <p>Le quotidien, concrétement.</p>
    </div>
    <div class="flex flex-col basis-1/3 border border-neutral-900 rounded-lg p-4 gap-2">
      <p class="font-semibold">Et sans le bac ?</p>
      <p>Les parcours possibles</p>
    </div>
    <div class="flex flex-col basis-1/3 border border-neutral-900 rounded-lg p-4 gap-2">
      <p class="font-semibold">Me former prés de moi</p>
      <p>On présisera où tu habites</p>
    </div>
  </div>
  <p class="text-sm">Des réponses appuyées sur des sources publiques: ONISEP, ROME, Carif-Oref.</p>
</section>

