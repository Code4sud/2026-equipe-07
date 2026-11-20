<script>
  import { Send, Trash2 } from "@lucide/svelte";

  /** @type {{ metier?: { id: string, intitule: string } | null }} */
  let { metier = null } = $props();

  /** @type {{ role: 'user' | 'assistant' | 'erreur', content: string }[]} */
  let messages = $state([]);
  let saisie = $state("");
  let chargement = $state(false);

  const suggestions = ["C'est quoi, concrètement ?", "Il faut quel diplôme ?", "Je peux le faire sans le bac ?"];

  // Nouveau métier choisi : on repart d'une conversation vide
  let dernierId = metier?.id ?? null;
  $effect(() => {
    const id = metier?.id ?? null;
    if (id !== dernierId) {
      dernierId = id;
      messages = [];
    }
  });

  /** @param {string} question */
  async function envoyer(question) {
    const texte = question.trim();
    if (!texte || chargement) return;

    messages.push({ role: "user", content: texte });
    saisie = "";
    chargement = true;

    try {
      const historique = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map(({ role, content }) => ({ role, content }));

      // Le métier choisi voyage à part : le serveur analyse la question avant d'appeler le modèle
      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: historique, metierId: metier?.id ?? null }),
      });
      const data = await res.json();
      messages.push(
        res.ok
          ? { role: "assistant", content: data.reponse }
          : { role: "erreur", content: data.reponse ?? "Une erreur est survenue." },
      );
    } catch {
      messages.push({ role: "erreur", content: "Le serveur ne répond pas." });
    } finally {
      chargement = false;
    }
  }

  /** @param {SubmitEvent} event */
  function soumettre(event) {
    event.preventDefault();
    envoyer(saisie);
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-2" aria-live="polite" aria-label="Conversation">
    {#each messages as m, i (i)}
      <div
        class="max-w-[85%] rounded-2xl px-4 py-2 whitespace-pre-wrap {m.role === 'user'
          ? 'self-end bg-emerald-900 text-neutral-50'
          : m.role === 'assistant'
            ? 'self-start bg-neutral-100'
            : 'self-start border border-red-800 text-red-800'}"
      >
        {m.content}
      </div>
    {/each}
    {#if chargement}
      <div class="self-start rounded-2xl bg-neutral-100 px-4 py-2 text-sm">
        L'assistant réfléchit…
      </div>
    {/if}
  </div>

  {#if metier && messages.length === 0}
    <div class="flex flex-wrap gap-2">
      {#each suggestions as s (s)}
        <button
          type="button"
          class="cursor-pointer rounded-2xl border border-emerald-900 px-3 py-1 text-emerald-900 hover:bg-emerald-900 hover:text-neutral-50"
          onclick={() => envoyer(s)}
        >
          {s}
        </button>
      {/each}
    </div>
  {/if}

  <form onsubmit={soumettre} class="flex gap-2">
    <label for="question" class="sr-only">Ta question</label>
    <input
      id="question"
      bind:value={saisie}
      maxlength="400"
      autocomplete="off"
      disabled={chargement}
      placeholder={metier ? "Pose ta question sur ce métier" : "Pose ta question sur un métier ou une formation"}
      class="h-10 flex-1 rounded-2xl border border-neutral-900 px-4"
    />
    <button
      type="submit"
      disabled={chargement || !saisie.trim()}
      class="flex h-10 cursor-pointer items-center gap-2 rounded-2xl bg-emerald-900 px-4 text-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Send size={16} />
      <span>Envoyer</span>
    </button>
    <button
      type="button"
      onclick={() => (messages = [])}
      disabled={chargement || messages.length === 0}
      aria-label="Effacer la conversation"
      class="flex h-10 cursor-pointer items-center rounded-2xl border border-emerald-900 px-3 text-emerald-900 hover:bg-emerald-900 hover:text-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  </form>
</div>
