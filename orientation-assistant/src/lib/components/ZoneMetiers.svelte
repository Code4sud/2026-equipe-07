<script>
  import { enhance } from "$app/forms";

  let { form } = $props();
</script>

<form
  method="POST"
  enctype="multipart/form-data"
  use:enhance
  action="?/importReport"
>
  <input type="file" name="rapport-pdf" accept="application/pdf" required />
  <button type="submit">Upload</button>
</form>

<pre>
  {#if form?.error}
    {JSON.stringify(form, null, 4)}
  {/if}
</pre>

{#if form?.text}
  <pre>{form.text}</pre>
{/if}
