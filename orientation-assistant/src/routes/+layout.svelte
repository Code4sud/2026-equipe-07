<script>
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import ImportRapport from '#lib/components/ImportRapport.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ImportRapport form={page.form} />

{@render children()}
