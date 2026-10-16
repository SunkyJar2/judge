<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const standings = $derived(data.standings);
  const modules = $derived(data.modules);
  const currentUser = $derived(data.currentUser);

  let activeModule = $state(data.selectedModule);
  let friendsOnly = $state(data.friendsOnly);

  function updateFilter(mod: string | null, friends: boolean) {
    const url = new URL(window.location.href);
    if (mod) {
      url.searchParams.set('module', mod);
    } else {
      url.searchParams.delete('module');
    }
    if (friends) {
      url.searchParams.set('friends', 'true');
    } else {
      url.searchParams.delete('friends');
    }
    window.location.href = url.toString();
  }
</script>

<div class="space-y-8">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-white tracking-tight">Leaderboard & Standings</h1>
      <p class="text-sm text-slate-400 mt-1">Global rankings and Codeforces-style tiers based on accepted problem points.</p>
    </div>

    <!-- Friends Toggle -->
    {#if currentUser}
      <button
        onclick={() => updateFilter(activeModule, !friendsOnly)}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all {friendsOnly ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        {friendsOnly ? 'Showing Friends Only' : 'Filter by Friends'}
      </button>
    {/if}
  </div>

  <!-- Module Filter Tabs -->
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
    <button
      onclick={() => updateFilter(null, friendsOnly)}
      class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeModule === null ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
    >
      Global Standings
    </button>
    {#each modules as mod}
      <button
        onclick={() => updateFilter(mod, friendsOnly)}
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeModule === mod ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
      >
        {mod}
      </button>
    {/each}
  </div>

  <!-- Standings Table -->
  {#if standings.length === 0}
    <div class="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 font-medium">
      No competitors found in this ranking category.
    </div>
  {:else}
    <div class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-850/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th class="py-3.5 px-4 w-16 text-center">Rank</th>
              <th class="py-3.5 px-4">Contestant</th>
              <th class="py-3.5 px-4">Tier</th>
              <th class="py-3.5 px-4">Solved</th>
              <th class="py-3.5 px-4 text-right">Points</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            {#each standings as row}
              <tr class="hover:bg-slate-800/40 transition-colors {currentUser?.id === row.userId ? 'bg-indigo-500/5' : ''}">
                <!-- Rank -->
                <td class="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                  {#if row.rank === 1}
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-extrabold">1</span>
                  {:else if row.rank === 2}
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 font-extrabold">2</span>
                  {:else if row.rank === 3}
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-500 font-extrabold">3</span>
                  {:else}
                    #{row.rank}
                  {/if}
                </td>

                <!-- Contestant -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden border border-slate-700">
                      {#if row.image}
                        <img src={row.image} alt={row.name} class="w-full h-full object-cover" />
                      {:else}
                        {row.name[0]?.toUpperCase() || 'U'}
                      {/if}
                    </div>
                    <div>
                      <p class="font-semibold text-white leading-tight">{row.name}</p>
                      <p class="text-xs text-slate-500 font-mono">{row.email}</p>
                    </div>
                  </div>
                </td>

                <!-- Tier -->
                <td class="py-3.5 px-4">
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border {row.tier.badgeClass}">
                    {row.tier.name}
                  </span>
                </td>

                <!-- Solved Count -->
                <td class="py-3.5 px-4 font-mono text-slate-300">
                  {row.solvedCount} problems
                </td>

                <!-- Points -->
                <td class="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-base">
                  {row.points}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
