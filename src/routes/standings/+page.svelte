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
        <h1 class="font-display text-3xl font-bold text-white tracking-tight">Leaderboard & Standings</h1>
        <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          Top {standings.length} Contestants
        </span>
      </div>
      <p class="text-sm text-slate-400 mt-1 font-sans">Global rankings and competitive tiers calculated from verified Kattis/DOMjudge points.</p>
    </div>

    <!-- Friends Toggle -->
    {#if currentUser}
      <button
        onclick={() => updateFilter(activeModule, !friendsOnly)}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium border transition-all {friendsOnly ? 'bg-indigo-600 text-white border-indigo-400/30 shadow-lg shadow-indigo-600/30' : 'bg-[#0f111a]/80 text-slate-300 border-white/[0.08] hover:text-white hover:border-white/20'}"
      >
        <svg class="w-3.5 h-3.5 {friendsOnly ? 'text-white' : 'text-indigo-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        {friendsOnly ? 'Showing Friends' : 'Filter Friends'}
      </button>
    {/if}
  </div>

  <!-- Module Filter Tabs -->
  <div class="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-4">
    <button
      onclick={() => updateFilter(null, friendsOnly)}
      class="px-3.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all {activeModule === null ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/30' : 'bg-[#0f111a]/80 text-slate-400 hover:text-white border border-white/[0.06]'}"
    >
      Global Standings
    </button>
    {#each modules as mod}
      <button
        onclick={() => updateFilter(mod, friendsOnly)}
        class="px-3.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all {activeModule === mod ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/30' : 'bg-[#0f111a]/80 text-slate-400 hover:text-white border border-white/[0.06]'}"
      >
        {mod}
      </button>
    {/each}
  </div>

  <!-- Top 3 Podium Showcase (if at least 3 contestants exist) -->
  {#if standings.length >= 3 && !friendsOnly}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
      <!-- 2nd Place -->
      <div class="glass-panel p-5 rounded-2xl border-slate-400/20 text-center space-y-3 order-2 sm:order-1 relative">
        <div class="w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/30 font-mono font-bold text-xs flex items-center justify-center mx-auto shadow-sm">
          🥈
        </div>
        <div class="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-400/30 mx-auto flex items-center justify-center text-sm font-bold text-white overflow-hidden shadow-md">
          {#if standings[1].image}
            <img src={standings[1].image} alt={standings[1].name} class="w-full h-full object-cover" />
          {:else}
            {standings[1].name[0]?.toUpperCase() || '2'}
          {/if}
        </div>
        <div>
          <h3 class="font-display font-bold text-white text-sm truncate">{standings[1].name}</h3>
          <span class="text-[11px] font-mono text-slate-400">{standings[1].solvedCount} solved</span>
        </div>
        <div class="font-mono text-lg font-black text-slate-200 tabular-nums">
          {standings[1].points} <span class="text-xs text-slate-500">pts</span>
        </div>
      </div>

      <!-- 1st Place (Center, Elevated) -->
      <div class="glass-panel p-6 rounded-2xl border-amber-400/30 text-center space-y-3.5 order-1 sm:order-2 sm:-translate-y-2 relative shadow-[0_0_30px_rgba(245,158,11,0.12)] bg-gradient-to-b from-amber-500/10 via-[#0f121b]/80 to-[#0c0e16]/80">
        <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-mono font-bold text-sm flex items-center justify-center mx-auto shadow-md">
          👑
        </div>
        <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 mx-auto flex items-center justify-center text-base font-bold text-amber-200 overflow-hidden shadow-lg">
          {#if standings[0].image}
            <img src={standings[0].image} alt={standings[0].name} class="w-full h-full object-cover" />
          {:else}
            {standings[0].name[0]?.toUpperCase() || '1'}
          {/if}
        </div>
        <div>
          <h3 class="font-display font-bold text-white text-base truncate">{standings[0].name}</h3>
          <span class="text-xs font-mono text-amber-400/90">{standings[0].solvedCount} solved</span>
        </div>
        <div class="font-mono text-xl font-black text-amber-300 tabular-nums">
          {standings[0].points} <span class="text-xs text-amber-500/70">pts</span>
        </div>
      </div>

      <!-- 3rd Place -->
      <div class="glass-panel p-5 rounded-2xl border-amber-700/20 text-center space-y-3 order-3 sm:order-3 relative">
        <div class="w-7 h-7 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/30 font-mono font-bold text-xs flex items-center justify-center mx-auto shadow-sm">
          🥉
        </div>
        <div class="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-amber-700/30 mx-auto flex items-center justify-center text-sm font-bold text-white overflow-hidden shadow-md">
          {#if standings[2].image}
            <img src={standings[2].image} alt={standings[2].name} class="w-full h-full object-cover" />
          {:else}
            {standings[2].name[0]?.toUpperCase() || '3'}
          {/if}
        </div>
        <div>
          <h3 class="font-display font-bold text-white text-sm truncate">{standings[2].name}</h3>
          <span class="text-[11px] font-mono text-slate-400">{standings[2].solvedCount} solved</span>
        </div>
        <div class="font-mono text-lg font-black text-amber-500 tabular-nums">
          {standings[2].points} <span class="text-xs text-slate-500">pts</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Standings Table -->
  {#if standings.length === 0}
    <div class="text-center py-16 glass-panel rounded-2xl space-y-3">
      <div class="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-slate-400 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <p class="text-white font-display font-bold">No competitors in this view</p>
      <p class="text-xs text-slate-400 font-sans">Switch to Global Standings or disable friends filter to view rankings.</p>
    </div>
  {:else}
    <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-[#07090e]/80 border-b border-white/[0.06] text-slate-400 text-[11px] font-mono uppercase tracking-wider">
            <tr>
              <th class="py-3.5 px-4 w-16 text-center">Rank</th>
              <th class="py-3.5 px-4">Contestant</th>
              <th class="py-3.5 px-4">Tier</th>
              <th class="py-3.5 px-4">Solved</th>
              <th class="py-3.5 px-4 text-right">Points</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.04]">
            {#each standings as row}
              <tr class="hover:bg-white/[0.03] transition-colors {currentUser?.id === row.userId ? 'bg-indigo-500/10' : ''}">
                <!-- Rank -->
                <td class="py-3.5 px-4 text-center font-mono font-bold text-slate-400 text-xs">
                  {#if row.rank === 1}
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">1</span>
                  {:else if row.rank === 2}
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 font-extrabold border border-slate-400/30">2</span>
                  {:else if row.rank === 3}
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-500 font-extrabold border border-amber-700/30">3</span>
                  {:else}
                    <span class="text-slate-500">#{row.rank}</span>
                  {/if}
                </td>

                <!-- Contestant -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden border border-white/10 shadow-sm">
                      {#if row.image}
                        <img src={row.image} alt={row.name} class="w-full h-full object-cover" />
                      {:else}
                        {row.name[0]?.toUpperCase() || 'U'}
                      {/if}
                    </div>
                    <div>
                      <p class="font-display font-semibold text-white leading-tight flex items-center gap-2">
                        {row.name}
                        {#if currentUser?.id === row.userId}
                          <span class="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-normal border border-indigo-500/30">You</span>
                        {/if}
                      </p>
                      <p class="text-[11px] text-slate-500 font-mono mt-0.5">{row.email}</p>
                    </div>
                  </div>
                </td>

                <!-- Tier -->
                <td class="py-3.5 px-4">
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border {row.tier.badgeClass} shadow-sm">
                    {row.tier.name}
                  </span>
                </td>

                <!-- Solved Count -->
                <td class="py-3.5 px-4 font-mono text-slate-300 text-xs">
                  <span class="font-bold text-white">{row.solvedCount}</span> solved
                </td>

                <!-- Points -->
                <td class="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-sm tabular-nums">
                  {row.points} <span class="text-[11px] font-normal text-emerald-500/70">pts</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
