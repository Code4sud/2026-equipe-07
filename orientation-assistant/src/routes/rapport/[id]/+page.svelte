<script>
    /** @type {import('./$types').PageProps} */
    let { data } = $props();

    // Pour chaque zone, ses métiers (affichage simple : le front complet sera fait par Dev C)
    const zones = $derived(
        data.rapport.zones.map((zone) => ({
            ...zone,
            metiers: data.rapport.metiers.filter((m) => m.zone === zone.numero)
        }))
    );
</script>

<h1>Ton champ des possibles</h1>

{#each zones as zone (zone.numero)}
    <section>
        <h2>Zone {zone.numero} — {zone.titre}</h2>
        {#if zone.metiers.length === 0}
            <p>Aucun métier dans cette zone.</p>
        {:else}
            <ul>
                {#each zone.metiers as metier (metier.id)}
                    <li>{metier.intitule}</li>
                {/each}
            </ul>
        {/if}
    </section>
{/each}

<!-- Droit à l'oubli : efface le rapport de la mémoire du serveur -->
<form method="POST" action="?/supprimer">
    <button type="submit">Supprimer mes données</button>
</form>