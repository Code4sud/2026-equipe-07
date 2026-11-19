<script>
    /** @type {import('./$types').PageProps} */
    let { data } = $props();
</script>

<pre>
    {#if data.rapport}
        {JSON.stringify(data.rapport, null, 4)}
    {/if}
</pre>