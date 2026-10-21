<script lang="ts">
  import type { PageProps } from './$types';
  import { getProblemHref } from '#lib/utils';

  let { data }: PageProps = $props();
  const profile = $derived(data.profile);
  const solvedProblems = $derived(data.solvedProblems);
  let acceptedFriends = $state<any[]>([]);
  let incomingRequests = $state<any[]>([]);

  $effect(() => {
    acceptedFriends = [...data.acceptedFriends];
    incomingRequests = [...data.incomingRequests];
  });

  let targetIdentifier = $state('');
  let friendActionMessage = $state<string | null>(null);
  let isSendingRequest = $state(false);

  async function handleSendFriendRequest(e: SubmitEvent) {
    e.preventDefault();
    if (!targetIdentifier.trim()) return;

    isSendingRequest = true;
    friendActionMessage = null;

    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: targetIdentifier.trim() }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to send request.');

      friendActionMessage = `Friend request sent to ${targetIdentifier}!`;
      targetIdentifier = '';
    } catch (err: any) {
      friendActionMessage = `Error: ${err.message}`;
    } finally {
      isSendingRequest = false;
    }
  }

  async function handleRespond(targetUserId: string, action: 'accept' | 'decline') {
    try {
      const res = await fetch('/api/friends', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action }),
      });

      if (res.ok) {
        incomingRequests = incomingRequests.filter((r) => r.targetUserId !== targetUserId);
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to respond to friend request:', err);
    }
  }
</script>

<div class="space-y-8 max-w-5xl mx-auto">
  <!-- Profile Header Card -->
  <div class="glass-panel p-6 sm:p-7 rounded-2xl space-y-6 shadow-2xl">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-[#0e111a] flex items-center justify-center text-xl font-display font-bold text-slate-200 overflow-hidden border border-white/10 shadow-lg">
          {#if profile.image}
            <img src={profile.image} alt={profile.name} class="w-full h-full object-cover" />
          {:else}
            {profile.name[0]?.toUpperCase() || 'U'}
          {/if}
        </div>
        <div>
          <div class="flex items-center gap-3">
            <h1 class="font-display text-2xl font-bold text-white">{profile.name}</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border {profile.tier.badgeClass}">
              {profile.tier.name}
            </span>
          </div>
          <p class="text-xs text-slate-400 font-mono mt-0.5">{profile.email}</p>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="flex items-center gap-3 font-mono text-center">
        <div class="px-4 py-2.5 bg-[#05060a] rounded-xl border border-white/[0.06]">
          <span class="text-slate-500 text-[10px] block uppercase tracking-wider">Total Points</span>
          <span class="text-lg font-black text-emerald-400 tabular-nums">{profile.totalPoints}</span>
        </div>
        <div class="px-4 py-2.5 bg-[#05060a] rounded-xl border border-white/[0.06]">
          <span class="text-slate-500 text-[10px] block uppercase tracking-wider">Problems Solved</span>
          <span class="text-lg font-black text-indigo-400 tabular-nums">{profile.solvedCount}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Two-Column Grid: Friends + Solved Problems -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Friends Management Column -->
    <div class="lg:col-span-5 space-y-6">
      <div class="glass-panel rounded-2xl p-6 space-y-6 shadow-2xl">
        <h2 class="font-display text-base font-bold text-white">Friends Network</h2>

        <!-- Send Request Form -->
        <form onsubmit={handleSendFriendRequest} class="space-y-2">
          <label for="targetIdentifier" class="block text-xs font-mono text-slate-400">Add Friend by Email or Handle</label>
          <div class="flex gap-2">
            <input
              id="targetIdentifier"
              type="text"
              bind:value={targetIdentifier}
              placeholder="friend@example.com"
              class="flex-1 bg-[#05060a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 font-mono"
            />
            <button
              type="submit"
              disabled={isSendingRequest}
              class="px-4 py-2 rounded-xl text-xs font-display font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 border border-indigo-400/20"
            >
              Add
            </button>
          </div>
          {#if friendActionMessage}
            <p class="text-xs text-indigo-400 font-mono mt-1">{friendActionMessage}</p>
          {/if}
        </form>

        <!-- Incoming Requests -->
        {#if incomingRequests.length > 0}
          <div class="space-y-3 pt-3 border-t border-white/[0.06]">
            <span class="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">Pending Requests</span>
            <div class="space-y-2">
              {#each incomingRequests as req}
                <div class="p-3 bg-[#05060a] rounded-xl border border-white/[0.06] flex items-center justify-between">
                  <div class="text-xs">
                    <p class="font-semibold text-white font-sans">{req.fromUser.name}</p>
                    <p class="text-[10px] text-slate-500 font-mono">{req.fromUser.email}</p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      onclick={() => handleRespond(req.targetUserId, 'accept')}
                      class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      Accept
                    </button>
                    <button
                      onclick={() => handleRespond(req.targetUserId, 'decline')}
                      class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-white/[0.06] text-slate-400 hover:text-white"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Accepted Friends List -->
        <div class="space-y-3 pt-3 border-t border-white/[0.06]">
          <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Your Friends ({acceptedFriends.length})</span>
          {#if acceptedFriends.length === 0}
            <p class="text-xs text-slate-500 italic font-sans">No friends added yet. Add peers to see their standings!</p>
          {:else}
            <div class="space-y-2">
              {#each acceptedFriends as friend}
                <div class="p-3 bg-[#05060a] rounded-xl border border-white/[0.06] flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs text-white overflow-hidden border border-white/10">
                      {#if friend.image}
                        <img src={friend.image} alt={friend.name} class="w-full h-full object-cover" />
                      {:else}
                        {friend.name[0]?.toUpperCase()}
                      {/if}
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-white font-sans">{friend.name}</p>
                      <p class="text-[10px] text-slate-500 font-mono">{friend.email}</p>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border {friend.tier.badgeClass}">
                    {friend.tier.name} ({friend.totalPoints} pts)
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Solved Problems Column -->
    <div class="lg:col-span-7 space-y-6">
      <div class="glass-panel rounded-2xl p-6 space-y-4 shadow-2xl">
        <h2 class="font-display text-base font-bold text-white">Solved Problems ({solvedProblems.length})</h2>

        {#if solvedProblems.length === 0}
          <div class="text-center py-12 text-slate-500 text-xs italic font-sans">
            You haven't solved any problems yet. Head over to the <a href="/problems" class="text-indigo-400 hover:underline">problemset</a>!
          </div>
        {:else}
          <div class="space-y-2">
            {#each solvedProblems as sp}
              <div class="p-3.5 bg-[#05060a] rounded-xl border border-white/[0.06] flex items-center justify-between hover:border-white/20 transition-colors">
                <div>
                  <a href={getProblemHref(sp.problemId)} class="text-xs font-display font-semibold text-white hover:text-indigo-300">
                    {sp.title}
                  </a>
                  <p class="text-[10px] text-slate-500 font-mono mt-0.5">
                    {sp.module} &bull; {sp.group} &bull; Solved on {new Date(sp.awardedAt).toLocaleDateString()}
                  </p>
                </div>
                <span class="font-mono font-bold text-xs text-emerald-400 tabular-nums">
                  +{sp.points} pts
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

