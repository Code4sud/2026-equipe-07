<script>
  import ImportRapport from "#lib/components/ImportRapport.svelte";
  import Chat from "#lib/components/Chat.svelte";
  import { enhance } from "$app/forms";
  import { Trash2 } from "@lucide/svelte";

  // data.rapport = résumé du rapport importé (load de +page.server.js), ou null
  // form = résultat de la dernière action (importReport ou supprimer)
  let { data, form } = $props();

  /** Métier choisi par le jeune pour le chat : { id: "z1-m3", intitule: "Barista" } ou null */
  let metierChoisi = $state(/** @type {{ id: string, intitule: string } | null} */ (null));

  // Le choix n'est valable que s'il existe dans le rapport affiché (sinon : nouveau rapport ou suppression)
  const metierActif = $derived(
    data.rapport?.zones.some((z) => z.metiers.some((m) => m.id === metierChoisi?.id)) ? metierChoisi : null
  );
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

<section class="flex flex-col mx-8 border border-none rounded-lg bg-neutral-100 gap-4 px-4 py-4">
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

<!-- Résultat de l'import : visible seulement si un rapport est en session -->
{#if data.rapport}
  <section class="flex flex-col gap-4 mx-8">
    <p class="font-semibold text-lg">
      Ton rapport est importé : {data.rapport.nbMetiers} métiers dans {data.rapport.zones.length} zones.
    </p>
    <p>Choisis un métier pour poser tes questions à l'assistant.</p>

    {#each data.rapport.zones as zone (zone.numero)}
      <div class="flex flex-col gap-2">
        <p class="font-semibold">Zone {zone.numero} — {zone.titre}</p>
        {#if zone.metiers.length === 0}
          <p class="text-sm">Aucun métier dans cette zone.</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each zone.metiers as metier (metier.id)}
              <!-- aria-pressed : indique aux lecteurs d'écran le métier sélectionné -->
              <button
                type="button"
                class="rounded-2xl border border-emerald-900 px-3 py-1 {metierActif?.id === metier.id ? 'bg-emerald-900 text-neutral-50' : ''}"
                aria-pressed={metierActif?.id === metier.id}
                onclick={() => (metierChoisi = metier)}
              >
                {metier.intitule}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

  <!-- Droit à l'oubli : efface la session et le cookie (action "supprimer" de +page.server.js) -->
    <form method="POST" action="?/supprimer" use:enhance>
      <!-- Bouton contour (secondaire), même forme que "Importer" -->
      <button
        type="submit"

        class="flex cursor-pointer gap-2 items-center rounded-2xl h-8 px-4 border border-emerald-900 text-emerald-900 hover:bg-emerald-900 hover:text-neutral-50">

        <Trash2 size={16} />
        <span>Supprimer mes données</span>
      </button>
    </form>
  </section>
{/if}

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

<!-- Zone du chat (composant de Denys). Il reçoit le métier choisi et appelle POST /api/chat { id, question }. -->
<section class="flex flex-col gap-2 mx-8 mb-8">
  <p class="font-semibold text-lg">Pose ta question</p>
  {#if !data.rapport}
    <p>
      Pose ta question librement, ou importe ton rapport ci-dessus pour des
      réponses personnalisées.
    </p>
  {:else if !metierActif}
    <p>
      Choisis un métier ci-dessus pour des réponses ciblées, ou pose une
      question libre (ton rapport est pris en compte).
    </p>
  {:else}
    <p>Tu parles de : <strong>{metierActif.intitule}</strong></p>
  {/if}
  <Chat metier={metierActif} />
</section>

<!-- <pre>{JSON.stringify(data, null, 4)}</pre> -->