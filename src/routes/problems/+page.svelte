<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageProps } from './$types';
  import { getProblemHref } from '#lib/utils';

  let { data }: PageProps = $props();
  const problems = $derived(data.problems);
  const modules = $derived(data.modules);

  let searchInput = $state('');
  let searchEl: HTMLInputElement | null = null;

  $effect(() => {
    searchInput = data.searchQuery;
  });

  const activeModule = $derived(data.selectedModule);

  function applyFilter(mod: string | null) {
    const url = new URL(page.url.href);
    if (mod) {
      url.searchParams.set('module', mod);
    } else {
      url.searchParams.delete('module');
    }
    goto(url.toString(), { reset: false });
  }

  function handleSearch(e?: SubmitEvent) {
    if (e) e.preventDefault();
    const url = new URL(page.url.href);
    if (searchInput.trim()) {
      url.searchParams.set('q', searchInput.trim());
    } else {
      url.searchParams.delete('q');
    }
    goto(url.toString(), { reset: false });
  }

  function clearSearch() {
    searchInput = '';
    handleSearch();
  }

  function handleGlobalKey(e: KeyboardEvent) {
    if (e.key === '/' && document.activeElement !== searchEl && !['INPUT', 'TEXTAREA'].includes((document.activeElement?.tagName || ''))) {
      e.preventDefault();
      searchEl?.focus();
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKey} />

<svelte:head>
  <title>Problemset &bull; DOMjudge Next</title>
</svelte:head>

<div class="space-y-8">
  <!-- Header & Search -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-black text-white tracking-tight">Problemset</h1>
        <span class="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
          {problems.length} Available
        </span>
      </div>
      <p class="text-sm text-slate-400 mt-1">Select a challenge to solve and submit your code.</p>
    </div>

    <!-- Search Form -->
    <form onsubmit={handleSearch} class="flex items-center gap-2">
      <div class="relative flex items-center">
        <div class="absolute left-3.5 text-slate-500 pointer-events-none">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          bind:this={searchEl}
          type="text"
          bind:value={searchInput}
          placeholder="Search by code or title... (Press / to focus)"
          class="w-72 sm:w-80 bg-slate-900 border border-slate-750 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
        />

        {#if searchInput}
          <button
            type="button"
            onclick={clearSearch}
            class="absolute right-2.5 text-slate-500 hover:text-white p-1"
            title="Clear search"
          >
            ✕
          </button>
        {/if}
      </div>

      <button
        type="submit"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/30"
      >
        Search
      </button>
    </form>
  </div>

  <!-- Module Filter Pills -->
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
    <button
      onclick={() => applyFilter(null)}
      class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all {activeModule === null ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
    >
      All Modules
    </button>
    {#each modules as mod}
      <button
        onclick={() => applyFilter(mod)}
        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all {activeModule === mod ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
      >
        {mod}
      </button>
    {/each}
  </div>

  <!-- Problems Table / List -->
  {#if problems.length === 0}
    <div class="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
      <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="space-y-1">
        <p class="text-white font-semibold">No problems match your current filter</p>
        <p class="text-xs text-slate-400">Try clearing your search query or selecting a different module.</p>
      </div>
      {#if activeModule || searchInput}
        <button
          onclick={() => { searchInput = ''; applyFilter(null); }}
          class="px-4 py-2 rounded-xl text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
        >
          Reset All Filters
        </button>
      {/if}
    </div>
  {:else}
    <div class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-md">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-850/80 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <tr>
              <th class="py-3.5 px-4 w-12 text-center">Status</th>
              <th class="py-3.5 px-4">Code</th>
              <th class="py-3.5 px-4">Problem Title</th>
              <th class="py-3.5 px-4">Module / Set</th>
              <th class="py-3.5 px-4">Points</th>
              <th class="py-3.5 px-4">Time Limit</th>
              <th class="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            {#each problems as prob}
              <tr class="hover:bg-slate-800/40 transition-colors group">
                <!-- Status icon -->
                <td class="py-3.5 px-4 text-center">
                  {#if prob.isSolved}
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30" title="Solved">
                      ✓
                    </span>
                  {:else}
                    <span class="inline-block w-2 h-2 rounded-full bg-slate-700"></span>
                  {/if}
                </td>

                <!-- Code -->
                <td class="py-3.5 px-4 font-mono font-bold text-indigo-400">
                  <a href={getProblemHref(prob.id)} class="hover:underline">
                    {prob.code}
                  </a>
                </td>

                <!-- Title -->
                <td class="py-3.5 px-4 font-semibold text-white">
                  <a href={getProblemHref(prob.id)} class="hover:text-indigo-400 transition-colors">
                    {prob.title}
                  </a>
                </td>

                <!-- Module & Group -->
                <td class="py-3.5 px-4 text-slate-400 text-xs font-mono">
                  <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    {prob.module} &bull; {prob.group}
                  </span>
                </td>

                <!-- Points -->
                <td class="py-3.5 px-4 font-bold text-emerald-400 font-mono">
                  {prob.points} pts
                </td>

                <!-- Limits -->
                <td class="py-3.5 px-4 text-slate-400 text-xs font-mono">
                  {prob.timeLimit}s / {prob.memoryLimit}MB
                </td>

                <!-- Solve Button -->
                <td class="py-3.5 px-4 text-right">
                  <a
                    href={getProblemHref(prob.id)}
                    class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group-hover:scale-105"
                  >
                    Solve &rarr;
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
