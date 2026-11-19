<script>
    /** @type {import('./$types').PageServerLoad} */
    let { data } = $props();
</script>

<pre>{JSON.stringify(data, null, 4)}</pre>