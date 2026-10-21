<script lang="ts">
  import { authClient } from '#lib/auth-client';

  let email = $state('');
  let password = $state('');
  let errorMsg = $state<string | null>(null);
  let isLoading = $state(false);

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    errorMsg = null;
    isLoading = true;

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        errorMsg = error.message || 'Login failed. Please check credentials.';
      } else {
        window.location.href = '/problems';
      }
    } catch (err: any) {
      errorMsg = err.message || 'An error occurred during sign in.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="max-w-md mx-auto py-12">
  <div class="glass-panel rounded-2xl p-8 space-y-6 shadow-2xl">
    <div class="text-center space-y-2">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center mx-auto text-white font-display font-black text-sm border border-white/20 shadow-lg shadow-indigo-500/20">
        DJ
      </div>
      <h1 class="font-display text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
      <p class="text-xs text-slate-400 font-sans">Sign in to submit code and track your competitive ratings.</p>
    </div>

    {#if errorMsg}
      <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
        {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleLogin} class="space-y-4">
      <div>
        <label for="email" class="block text-xs font-mono text-slate-300 mb-1.5">Email Address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 font-sans"
          placeholder="contender@example.com"
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-mono text-slate-300 mb-1.5">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 font-sans"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full py-3 rounded-xl text-xs font-display font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 border border-indigo-400/20"
      >
        {isLoading ? 'Signing In...' : 'Sign In'}
      </button>
    </form>

    <div class="text-center text-xs text-slate-400 pt-3 border-t border-white/[0.06] font-sans">
      Don't have an account?
      <a href="/register" class="text-indigo-400 hover:text-indigo-300 font-semibold ml-1">Sign Up</a>
    </div>
  </div>
</div>

