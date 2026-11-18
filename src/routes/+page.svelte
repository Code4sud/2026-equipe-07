<script lang="ts">
	import { enhance } from '$app/forms';
    import type { PageProps } from './$types';

    let { data, form }: PageProps = $props();
</script>

<form method="POST" enctype="multipart/form-data" use:enhance action="?/importReport">
    <input
        type="file"
        name="pdf"
        accept="application/pdf"
        required
    />
    <button type="submit">Importer</button>
</form>

{#if form?.error}
    <p>{form.error}</p>
{/if}

{#if form?.text}
    <pre>{form.text}</pre>
{/if}

<hr/>
<pre>{JSON.stringify(data, null, 4)}</pre>

<style>
    pre {
        background-color: #f4f4f4;
        padding: 10px;
    }
</style>