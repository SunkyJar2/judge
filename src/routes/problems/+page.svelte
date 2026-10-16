<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const problems = $derived(data.problems);
  const modules = $derived(data.modules);

  let searchInput = $state(data.searchQuery);
  let activeModule = $state(data.selectedModule);

  function applyFilter(mod: string | null) {
    activeModule = mod;
    const url = new URL(window.location.href);
    if (mod) {
      url.searchParams.set('module', mod);
    } else {
      url.searchParams.delete('module');
    }
    window.location.href = url.toString();
  }

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (searchInput.trim()) {
      url.searchParams.set('q', searchInput.trim());
    } else {
      url.searchParams.delete('q');
    }
    window.location.href = url.toString();
  }
</script>

<div class="space-y-8">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-white tracking-tight">Problemset</h1>
      <p class="text-sm text-slate-400 mt-1">Select a challenge to solve and submit your code.</p>
    </div>

    <!-- Search Form -->
    <form onsubmit={handleSearch} class="flex items-center gap-2">
      <div class="relative">
        <input
          type="text"
          bind:value={searchInput}
          placeholder="Search problems..."
          class="w-64 bg-slate-900 border border-slate-750 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
      </div>
      <button
        type="submit"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        Search
      </button>
    </form>
  </div>

  <!-- Module Filter Pills -->
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
    <button
      onclick={() => applyFilter(null)}
      class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeModule === null ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
    >
      All Modules
    </button>
    {#each modules as mod}
      <button
        onclick={() => applyFilter(mod)}
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeModule === mod ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
      >
        {mod}
      </button>
    {/each}
  </div>

  <!-- Problems Table / List -->
  {#if problems.length === 0}
    <div class="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
      <p class="text-slate-400 font-medium">No problems found matching the criteria.</p>
      {#if activeModule || searchInput}
        <button onclick={() => applyFilter(null)} class="text-xs text-indigo-400 hover:underline">Clear filters</button>
      {/if}
    </div>
  {:else}
    <div class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
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
              <tr class="hover:bg-slate-800/40 transition-colors">
                <!-- Status icon -->
                <td class="py-3 px-4 text-center">
                  {#if prob.isSolved}
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold" title="Solved">
                      ✓
                    </span>
                  {:else}
                    <span class="inline-block w-2 h-2 rounded-full bg-slate-700"></span>
                  {/if}
                </td>

                <!-- Code -->
                <td class="py-3 px-4 font-mono font-medium text-indigo-400">
                  {prob.code}
                </td>

                <!-- Title -->
                <td class="py-3 px-4 font-medium text-white">
                  <a href={`/problems/${encodeURIComponent(prob.id)}`} class="hover:text-indigo-400 hover:underline">
                    {prob.title}
                  </a>
                </td>

                <!-- Module & Group -->
                <td class="py-3 px-4 text-slate-400 text-xs font-mono">
                  <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {prob.module} &bull; {prob.group}
                  </span>
                </td>

                <!-- Points -->
                <td class="py-3 px-4 font-semibold text-emerald-400">
                  {prob.points} pts
                </td>

                <!-- Limits -->
                <td class="py-3 px-4 text-slate-400 text-xs font-mono">
                  {prob.timeLimit}s / {prob.memoryLimit}MB
                </td>

                <!-- Solve Button -->
                <td class="py-3 px-4 text-right">
                  <a
                    href={`/problems/${encodeURIComponent(prob.id)}`}
                    class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all"
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

