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
  <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-6 shadow-2xl">
    <div class="text-center space-y-2">
      <h1 class="text-2xl font-black text-white">Welcome Back</h1>
      <p class="text-xs text-slate-400">Log in to submit code and track your competitive progress.</p>
    </div>

    {#if errorMsg}
      <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
        {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleLogin} class="space-y-4">
      <div>
        <label for="email" class="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          placeholder="contender@example.com"
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-semibold text-slate-300 mb-1">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
      >
        {isLoading ? 'Signing In...' : 'Sign In'}
      </button>
    </form>

    <div class="text-center text-xs text-slate-500 pt-2 border-t border-slate-800/80">
      Don't have an account?
      <a href="/register" class="text-indigo-400 hover:underline font-semibold ml-1">Sign Up</a>
    </div>
  </div>
</div>

