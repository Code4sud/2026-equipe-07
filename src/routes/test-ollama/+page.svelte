<script>
	// Mini chat de test Ollama (dev uniquement) : vérifie la connexion et le modèle.
	// Texte brut partout (pas de {@html}).
	import { onMount } from 'svelte';

	let etat = $state(null); // réponse de GET /api/test-ollama
	let messages = $state([]); // { role: 'user' | 'assistant' | 'erreur', content, ms? }
	let saisie = $state('');
	let chargement = $state(false);

	async function verifier() {
		etat = null;
		try {
			const res = await fetch('/api/test-ollama');
			etat = res.ok ? await res.json() : { connecte: false, detail: `Route indisponible (${res.status}). Mode dev uniquement.` };
		} catch {
			etat = { connecte: false, detail: 'Le serveur SvelteKit ne répond pas.' };
		}
	}

	onMount(verifier);

	async function envoyer(event) {
		event.preventDefault();
		const texte = saisie.trim();
		if (!texte || chargement) return;

		messages.push({ role: 'user', content: texte });
		saisie = '';
		chargement = true;

		try {
			// On envoie l'historique (sans les erreurs) pour que le modèle garde le fil
			const historique = messages
				.filter((m) => m.role === 'user' || m.role === 'assistant')
				.map(({ role, content }) => ({ role, content }));

			const res = await fetch('/api/test-ollama', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messages: historique })
			});
			const data = await res.json();

			if (res.ok) messages.push({ role: 'assistant', content: data.reponse, ms: data.ms });
			else messages.push({ role: 'erreur', content: `${data.erreur ?? 'Erreur'} ${data.code ? `(${data.code})` : ''}`, ms: data.ms });
		} catch {
			messages.push({ role: 'erreur', content: 'Le serveur SvelteKit ne répond pas.' });
		} finally {
			chargement = false;
		}
	}

	function effacer() {
		messages = [];
	}

	let rapport = $state(null); // { fichier, zones, metiers[] }
	let erreurPdf = $state('');
	let envoiPdf = $state(false);

	async function importerPdf(event) {
		const fichier = event.currentTarget.files?.[0];
		if (!fichier) return;
		erreurPdf = '';
		envoiPdf = true;
		try {
			const fd = new FormData();
			fd.append('rapport-pdf', fichier);
			const res = await fetch('/api/test-ollama', { method: 'PUT', body: fd });
			const data = await res.json();
			if (res.ok) rapport = data.rapport;
			else erreurPdf = data.erreur ?? 'Erreur';
		} catch {
			erreurPdf = 'Le serveur SvelteKit ne répond pas.';
		} finally {
			envoiPdf = false;
		}
	}

	async function retirerPdf() {
		await fetch('/api/test-ollama', { method: 'DELETE' });
		rapport = null;
	}
</script>

<svelte:head>
	<title>Test Ollama</title>
</svelte:head>

<main>
	<h1>Test Ollama</h1>

	<section class="etat" aria-live="polite">
		{#if etat === null}
			<p>Vérification de la connexion…</p>
		{:else if !etat.connecte}
			<p class="ko">✗ Non connecté — {etat.detail}</p>
			<p class="petit">URL testée : <code>{etat.url}</code></p>
		{:else if !etat.modeleInstalle}
			<p class="ko">✗ Connecté, mais le modèle <code>{etat.modele}</code> n'est pas installé.</p>
			<p class="petit">Lance : <code>ollama pull {etat.modele}</code> — modèles présents : {etat.modeles.join(', ') || 'aucun'}</p>
		{:else}
			<p class="ok">✓ Connecté à <code>{etat.url}</code> — modèle <code>{etat.modele}</code> installé</p>
		{/if}
		<button type="button" onclick={verifier}>Revérifier</button>
	</section>

	<section class="etat">
		{#if rapport}
			<p class="ok">✓ Rapport « {rapport.fichier ?? 'PDF'} » : {rapport.metiers.length} métiers — {rapport.metiers.join(', ')}</p>
			<button type="button" onclick={retirerPdf}>Retirer</button>
		{:else}
			<label for="pdf">Rapport PDF (optionnel) :</label>
			<input id="pdf" type="file" accept="application/pdf" onchange={importerPdf} disabled={envoiPdf} />
			{#if envoiPdf}<p class="petit">Analyse du PDF…</p>{/if}
		{/if}
		{#if erreurPdf}<p class="ko">{erreurPdf}</p>{/if}
	</section>

	<section class="fil" aria-label="Conversation">
		{#each messages as m, i (i)}
			<div class="bulle {m.role}">
				<span class="role">{m.role === 'user' ? 'Toi' : m.role === 'assistant' ? 'Modèle' : 'Erreur'}{m.ms ? ` · ${(m.ms / 1000).toFixed(1)} s` : ''}</span>
				<p>{m.content}</p>
			</div>
		{:else}
			<p class="petit">Écris un message pour tester le modèle.</p>
		{/each}
		{#if chargement}
			<div class="bulle assistant"><p>Le modèle réfléchit… (le 1er appel charge le modèle en mémoire)</p></div>
		{/if}
	</section>

	<form onsubmit={envoyer}>
		<label for="saisie" class="sr">Message</label>
		<input id="saisie" bind:value={saisie} maxlength="1000" placeholder="Dis bonjour en une phrase" autocomplete="off" disabled={chargement} />
		<button type="submit" disabled={chargement || !saisie.trim()}>Envoyer</button>
		<button type="button" onclick={effacer} disabled={chargement || messages.length === 0}>Effacer</button>
	</form>
</main>

<style>
	main {
		max-width: 42rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	.etat {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.75rem 1rem;
		background: #f4f4f5;
		border-radius: 0.5rem;
	}
	.etat p {
		margin: 0;
	}
	.ok {
		color: #15803d;
	}
	.ko {
		color: #b91c1c;
	}
	.petit {
		color: #52525b;
		font-size: 0.875rem;
	}
	.fil {
		margin: 1rem 0;
		min-height: 10rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.bulle {
		max-width: 85%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
	}
	.bulle p {
		margin: 0;
		white-space: pre-wrap;
	}
	.role {
		font-size: 0.75rem;
		color: #52525b;
	}
	.user {
		align-self: flex-end;
		background: #dbeafe;
	}
	.assistant {
		align-self: flex-start;
		background: #f4f4f5;
	}
	.erreur {
		align-self: flex-start;
		background: #fee2e2;
		color: #7f1d1d;
	}
	form {
		display: flex;
		gap: 0.5rem;
	}
	input {
		flex: 1;
		padding: 0.5rem;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
