<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} &bull; DOMjudge Next</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center py-12 px-4">
  <div class="max-w-lg w-full text-center space-y-6 bg-slate-900/60 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-md">
    <!-- Status Icon / Code -->
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-3xl font-black shadow-lg shadow-indigo-500/10">
      {page.status}
    </div>

    <!-- Title & Description -->
    <div class="space-y-2">
      <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
        {#if page.status === 404}
          Resource Not Found
        {:else if page.status === 401}
          Authentication Required
        {:else if page.status === 403}
          Access Denied
        {:else}
          Encountered System Error
        {/if}
      </h1>

      <p class="text-sm text-slate-400 leading-relaxed">
        {page.error?.message || 'The requested resource could not be found or an unexpected condition occurred.'}
      </p>
    </div>

    <!-- Navigation Buttons -->
    <div class="pt-4 flex flex-wrap items-center justify-center gap-3">
      <a
        href="/problems"
        class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
      >
        Browse Problemset &rarr;
      </a>
      <a
        href="/"
        class="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all hover:scale-105"
      >
        Return Home
      </a>
    </div>

    <!-- Footer link -->
    <div class="pt-4 border-t border-slate-800/60 text-xs text-slate-500">
      Need assistance? Check <a href="/api/system/health" class="text-indigo-400 hover:underline">System Status</a>
    </div>
  </div>
</div>
