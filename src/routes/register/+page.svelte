<script lang="ts">
  import { authClient } from '#lib/auth-client';

  let name = $state('');
  let username = $state('');
  let email = $state('');
  let password = $state('');
  let errorMsg = $state<string | null>(null);
  let isLoading = $state(false);

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault();
    errorMsg = null;
    isLoading = true;

    try {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (error) {
        errorMsg = error.message || 'Registration failed.';
      } else {
        window.location.href = '/problems';
      }
    } catch (err: any) {
      errorMsg = err.message || 'An error occurred during sign up.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="max-w-md mx-auto py-12">
  <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-6 shadow-2xl">
    <div class="text-center space-y-2">
      <h1 class="text-2xl font-black text-white">Create Contender Account</h1>
      <p class="text-xs text-slate-400">Join the ranking board, solve problems and compete with friends.</p>
    </div>

    {#if errorMsg}
      <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
        {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleRegister} class="space-y-4">
      <div>
        <label for="name" class="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          required
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          placeholder="Linus Torvalds"
        />
      </div>

      <div>
        <label for="username" class="block text-xs font-semibold text-slate-300 mb-1">Handle / Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
          placeholder="torvalds"
        />
      </div>

      <div>
        <label for="email" class="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          placeholder="linus@example.com"
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-semibold text-slate-300 mb-1">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength={8}
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          placeholder="Minimum 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
      >
        {isLoading ? 'Creating Account...' : 'Complete Sign Up'}
      </button>
    </form>

    <div class="text-center text-xs text-slate-500 pt-2 border-t border-slate-800/80">
      Already have an account?
      <a href="/login" class="text-indigo-400 hover:underline font-semibold ml-1">Log In</a>
    </div>
  </div>
</div>
