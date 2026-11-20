<script>
	import favicon from '#lib/assets/favicon.svg';
	import "../app.css";
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>OrienTi</title>
</svelte:head>

<header class="bg-neutral-50 flex flex-row p-6 border-b border-b-neutral-950">
	<div class="flex flex-col">
		<h1 class="text-2xl font-semibold text-emerald-900">OrienTi</h1>
		<p class="font-semibold">L'explorateur des métiers</p>
		<p>Des métiers aux formations, à ton rythme</p>
	</div>
</header>
<main class="grow flex flex-col gap-8">
	{@render children()}
</main>






