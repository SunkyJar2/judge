<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const standings = $derived(data.standings);
  const modules = $derived(data.modules);
  const currentUser = $derived(data.currentUser);

  const activeModule = $derived(data.selectedModule);
  const friendsOnly = $derived(data.friendsOnly);

  function updateFilter(mod: string | null, friends: boolean) {
    const url = new URL(page.url.href);
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
    goto(url.toString(), { reset: false });
  }
</script>

<svelte:head>
  <title>Leaderboard & Standings &bull; DOMjudge Next</title>
</svelte:head>

<div class="space-y-8">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-black text-white tracking-tight">Leaderboard & Standings</h1>
        <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          Top {standings.length}
        </span>
      </div>
      <p class="text-sm text-slate-400 mt-1">Global rankings and competitive tiers based on accepted problem points.</p>
    </div>

    <!-- Friends Toggle -->
    {#if currentUser}
      <button
        onclick={() => updateFilter(activeModule, !friendsOnly)}
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all {friendsOnly ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'}"
      >
        <svg class="w-4 h-4 {friendsOnly ? 'text-white' : 'text-indigo-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeModule === null ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
    >
      Global Standings
    </button>
    {#each modules as mod}
      <button
        onclick={() => updateFilter(mod, friendsOnly)}
        class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeModule === mod ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
      >
        {mod}
      </button>
    {/each}
  </div>

  <!-- Standings Table -->
  {#if standings.length === 0}
    <div class="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3 shadow-xl backdrop-blur-md">
      <div class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <p class="text-white font-semibold">No competitors found in this ranking category</p>
      <p class="text-xs text-slate-400">Try switching to Global Standings or disabling friends filter.</p>
    </div>
  {:else}
    <div class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-md">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-850/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
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
              <tr class="hover:bg-slate-800/40 transition-colors {currentUser?.id === row.userId ? 'bg-indigo-500/10' : ''}">
                <!-- Rank -->
                <td class="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                  {#if row.rank === 1}
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 shadow-md shadow-amber-500/10">🥇 1</span>
                  {:else if row.rank === 2}
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20 text-slate-200 font-extrabold border border-slate-400/30">🥈 2</span>
                  {:else if row.rank === 3}
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-500 font-extrabold border border-amber-700/30">🥉 3</span>
                  {:else}
                    <span class="text-slate-400">#{row.rank}</span>
                  {/if}
                </td>

                <!-- Contestant -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden border border-slate-700 shadow-sm">
                      {#if row.image}
                        <img src={row.image} alt={row.name} class="w-full h-full object-cover" />
                      {:else}
                        {row.name[0]?.toUpperCase() || 'U'}
                      {/if}
                    </div>
                    <div>
                      <p class="font-bold text-white leading-tight flex items-center gap-2">
                        {row.name}
                        {#if currentUser?.id === row.userId}
                          <span class="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-normal">You</span>
                        {/if}
                      </p>
                      <p class="text-xs text-slate-500 font-mono mt-0.5">{row.email}</p>
                    </div>
                  </div>
                </td>

                <!-- Tier -->
                <td class="py-3.5 px-4">
                  <span class="px-3 py-1 rounded-full text-xs font-bold border {row.tier.badgeClass} shadow-sm">
                    {row.tier.name}
                  </span>
                </td>

                <!-- Solved Count -->
                <td class="py-3.5 px-4 font-mono text-slate-300">
                  <span class="font-bold text-white">{row.solvedCount}</span> solved
                </td>

                <!-- Points -->
                <td class="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-base">
                  {row.points} <span class="text-xs font-normal text-emerald-500/70">pts</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
