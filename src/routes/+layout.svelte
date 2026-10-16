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

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
  <!-- Top Navigation Bar -->
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo & Brand -->
        <div class="flex items-center gap-8">
          <a href="/" class="flex items-center gap-3 group">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span class="font-black text-white text-lg">DJ</span>
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-white text-base leading-tight tracking-tight">DOMjudge <span class="text-indigo-400 font-normal">Next</span></span>
              <span class="text-[10px] text-slate-400 font-mono">Modern Judge Platform</span>
            </div>
          </a>

          <!-- Main Nav Links -->
          <nav class="hidden md:flex items-center gap-1">
            <a href="/problems" class="px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Problems</a>
            <a href="/submissions" class="px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Submissions</a>
            <a href="/standings" class="px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Standings</a>
            <a href="/playground" class="px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Playground</a>
            {#if user && (user.role === 'teacher' || user.role === 'admin')}
              <a href="/admin/import" class="px-3 py-2 rounded-md text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors">Import ZIP</a>
            {/if}
          </nav>
        </div>

        <!-- Right Side: User Menu / Auth -->
        <div class="hidden md:flex items-center gap-4">
          {#if user}
            <div class="flex items-center gap-3 bg-slate-850 px-3 py-1.5 rounded-full border border-slate-800">
              {#if tier}
                <span class="px-2 py-0.5 text-xs font-semibold rounded-full border {tier.badgeClass}">
                  {tier.name}
                </span>
              {/if}
              <div class="flex flex-col text-right">
                <span class="text-xs font-semibold text-white leading-none">{user.name || user.email}</span>
                <span class="text-[10px] font-mono text-indigo-400 leading-tight mt-0.5">{(user as any).totalPoints || 0} pts</span>
              </div>
              <a href="/account" class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors">
                {#if user.image}
                  <img src={user.image} alt={user.name || ''} class="w-full h-full object-cover" />
                {:else}
                  <span class="text-xs font-bold text-slate-300">{(user.name || user.email || 'U')[0].toUpperCase()}</span>
                {/if}
              </a>
              <button
                onclick={handleLogout}
                class="text-xs text-slate-400 hover:text-rose-400 transition-colors p-1"
                title="Sign out"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          {:else}
            <div class="flex items-center gap-2">
              <a href="/login" class="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">Log In</a>
              <a href="/register" class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all">Sign Up</a>
            </div>
          {/if}
        </div>

        <!-- Mobile Menu Toggle Button -->
        <div class="flex md:hidden">
          <button
            onclick={() => mobileMenuOpen = !mobileMenuOpen}
            class="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Toggle navigation"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div class="md:hidden border-b border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-1">
        <a href="/problems" class="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800">Problems</a>
        <a href="/submissions" class="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800">Submissions</a>
        <a href="/standings" class="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800">Standings</a>
        <a href="/playground" class="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800">Playground</a>
        {#if user}
          <a href="/account" class="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800">My Account ({(user as any).totalPoints || 0} pts)</a>
          <button onclick={handleLogout} class="w-full text-left px-3 py-2 rounded-md text-base font-medium text-rose-400 hover:bg-slate-800">Sign Out</button>
        {:else}
          <div class="pt-3 border-t border-slate-800 flex gap-2">
            <a href="/login" class="flex-1 text-center py-2 rounded-lg bg-slate-800 text-white font-medium">Log In</a>
            <a href="/register" class="flex-1 text-center py-2 rounded-lg bg-indigo-600 text-white font-medium">Sign Up</a>
          </div>
        {/if}
      </div>
    {/if}
  </header>

  <!-- Page Main Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-850 bg-slate-950 py-6 text-center text-xs text-slate-500">
    <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p>DOMjudge Next Rewrite &bull; Powered by SvelteKit, Bun, Prisma & Judge0</p>
      <div class="flex items-center gap-4 text-slate-400">
        <a href="/api/system/health" class="hover:underline">System Status</a>
        <span>&bull;</span>
        <span>Isolated Sandboxes</span>
      </div>
    </div>
  </footer>
</div>
