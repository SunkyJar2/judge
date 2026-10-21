<script lang="ts">
  import '../app.css';
  import favicon from '#lib/assets/favicon.svg';
  import type { LayoutProps } from './$types';
  import { getTierForPoints } from '#lib/tiers';
  import { authClient } from '#lib/auth-client';

  let { data, children }: LayoutProps = $props();
  const user = $derived(data.user);
  const tier = $derived(user ? getTierForPoints((user as any).totalPoints || 0) : null);

  let mobileMenuOpen = $state(false);

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = '/';
  }
</script>

<svelte:head>
  <title>DOMjudge Rewrite - Advanced Automated Judge</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white">
  <!-- Top Navigation Bar -->
  <header class="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07080c]/80 backdrop-blur-2xl transition-all">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo & Brand -->
        <div class="flex items-center gap-8">
          <a href="/" class="flex items-center gap-3.5 group">
            <div class="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-300 border border-white/20">
              <span class="font-display font-black text-white text-base tracking-tighter">DJ</span>
              <div class="absolute -inset-0.5 rounded-xl bg-indigo-500/30 blur-sm -z-10 group-hover:opacity-100 opacity-60 transition-opacity"></div>
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="font-display font-bold text-white text-base tracking-tight">DOMJUDGE</span>
                <span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">NEXT</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono tracking-wide">CP Engine &bull; Zero-Trust Sandbox</span>
            </div>
          </a>

          <!-- Main Nav Links -->
          <nav class="hidden md:flex items-center gap-1">
            <a href="/problems" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all">Problems</a>
            <a href="/submissions" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all">Submissions</a>
            <a href="/standings" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all">Standings</a>
            <a href="/playground" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all">Playground</a>
            {#if user && (user.role === 'teacher' || user.role === 'admin')}
              <a href="/admin/import" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all border border-amber-500/20">Import ZIP</a>
            {/if}
          </nav>
        </div>

        <!-- Right Side: Status Pill + User Menu / Auth -->
        <div class="hidden md:flex items-center gap-3.5">
          <!-- Live Operational Status Indicator -->
          <a
            href="/api/system/health"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 text-[11px] font-mono text-emerald-300 transition-colors"
            title="System Health & Sandboxes Online"
          >
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Judge0 Online</span>
          </a>

          {#if user}
            <div class="flex items-center gap-2.5 bg-[#10131d]/90 px-3 py-1.5 rounded-full border border-white/[0.08] shadow-sm">
              {#if tier}
                <span class="px-2 py-0.5 text-[10px] font-bold rounded-full border {tier.badgeClass}">
                  {tier.name}
                </span>
              {/if}
              <div class="flex flex-col text-right">
                <span class="text-xs font-semibold text-white leading-none">{user.name || user.email}</span>
                <span class="text-[10px] font-mono text-indigo-400 leading-tight mt-0.5">{(user as any).totalPoints || 0} pts</span>
              </div>
              <a href="/account" class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/20 hover:border-indigo-400 transition-colors">
                {#if user.image}
                  <img src={user.image} alt={user.name || ''} class="w-full h-full object-cover" />
                {:else}
                  <span class="text-[11px] font-bold text-slate-300">{(user.name || user.email || 'U')[0].toUpperCase()}</span>
                {/if}
              </a>
              <button
                onclick={handleLogout}
                class="text-xs text-slate-400 hover:text-rose-400 transition-colors p-1"
                title="Sign out"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          {:else}
            <div class="flex items-center gap-2">
              <a href="/login" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all">Log In</a>
              <a href="/register" class="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all border border-indigo-400/20">Sign Up</a>
            </div>
          {/if}
        </div>

        <!-- Mobile Menu Toggle Button -->
        <div class="flex md:hidden">
          <button
            onclick={() => mobileMenuOpen = !mobileMenuOpen}
            class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06]"
            aria-label="Toggle navigation"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {#if mobileMenuOpen}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              {:else}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              {/if}
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu Dropdown -->
    {#if mobileMenuOpen}
      <div class="md:hidden border-b border-white/[0.08] bg-[#0c0e15] px-4 pt-3 pb-5 space-y-2">
        <a href="/problems" class="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06]">Problems</a>
        <a href="/submissions" class="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06]">Submissions</a>
        <a href="/standings" class="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06]">Standings</a>
        <a href="/playground" class="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06]">Playground</a>
        {#if user}
          <a href="/account" class="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06]">My Account ({(user as any).totalPoints || 0} pts)</a>
          <button onclick={handleLogout} class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-white/[0.06]">Sign Out</button>
        {:else}
          <div class="pt-3 border-t border-white/[0.08] flex gap-2">
            <a href="/login" class="flex-1 text-center py-2 rounded-xl bg-white/[0.08] text-white text-xs font-semibold">Log In</a>
            <a href="/register" class="flex-1 text-center py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/30">Sign Up</a>
          </div>
        {/if}
      </div>
    {/if}
  </header>

  <!-- Page Main Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    {@render children()}
  </main>

  <!-- High-Craft Technical Footer -->
  <footer class="border-t border-white/[0.06] bg-[#050609]/90 py-8 text-xs text-slate-500">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
      <div class="flex items-center gap-3">
        <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
        <p class="text-slate-400">DOMjudge Next &bull; Kattis Package Spec Compliant &bull; Zero-Trust Sandbox</p>
      </div>
      <div class="flex items-center gap-4 text-slate-400 text-[11px]">
        <a href="/api/system/health" class="hover:text-indigo-400 transition-colors">System Telemetry</a>
        <span class="text-slate-700">&bull;</span>
        <a href="/problems" class="hover:text-indigo-400 transition-colors">Problemset</a>
        <span class="text-slate-700">&bull;</span>
        <a href="/playground" class="hover:text-indigo-400 transition-colors">Code Sandbox</a>
      </div>
    </div>
  </footer>
</div>
