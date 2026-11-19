<script>
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import ZoneMetiers from '#lib/components/ZoneMetiers.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ZoneMetiers form={page.form} />

{@render children()}
