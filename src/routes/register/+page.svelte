<script lang="ts">
  import { authClient } from '#lib/auth-client';

  let name = $state('');
  let username = $state('');
  let email = $state('');
  let password = $state('');
  let errorMsg = $state<string | null>(null);
  let isLoading = $state(false);
  let isGoogleLoading = $state(false);

  async function handleGoogleSignIn() {
    errorMsg = null;
    isGoogleLoading = true;
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/problems',
      });
    } catch (err: any) {
      errorMsg = err.message || 'Google sign up failed.';
      isGoogleLoading = false;
    }
  }

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
  <div class="glass-panel rounded-2xl p-8 space-y-6 shadow-2xl">
    <div class="text-center space-y-2">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center mx-auto text-white font-display font-black text-sm border border-white/20 shadow-lg shadow-indigo-500/20">
        DJ
      </div>
      <h1 class="font-display text-2xl font-bold text-white tracking-tight">Create Contender Account</h1>
      <p class="text-xs text-slate-400 font-sans">Join the rankings, evaluate submissions, and track competitive tiers.</p>
    </div>

    {#if errorMsg}
      <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
        {errorMsg}
      </div>
    {/if}

    <!-- Google OAuth Button -->
    <button
      type="button"
      onclick={handleGoogleSignIn}
      disabled={isLoading || isGoogleLoading}
      class="w-full py-2.5 rounded-xl text-xs font-sans font-semibold text-slate-200 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50 hover:-translate-y-0.5"
    >
      {#if isGoogleLoading}
        <span class="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
        <span>Connecting to Google...</span>
      {:else}
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
          <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z" />
          <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
        </svg>
        <span>Sign up with Google</span>
      {/if}
    </button>

    <div class="relative flex items-center justify-center my-1">
      <div class="border-t border-white/[0.08] w-full"></div>
      <span class="bg-[#0b0e17] px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest shrink-0">or continue with email</span>
      <div class="border-t border-white/[0.08] w-full"></div>
    </div>

    <form onsubmit={handleRegister} class="space-y-4">
      <div>
        <label for="name" class="block text-xs font-mono text-slate-300 mb-1.5">Full Name</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          required
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 font-sans"
          placeholder="Linus Torvalds"
        />
      </div>

      <div>
        <label for="username" class="block text-xs font-mono text-slate-300 mb-1.5">Handle / Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 font-mono"
          placeholder="torvalds"
        />
      </div>

      <div>
        <label for="email" class="block text-xs font-mono text-slate-300 mb-1.5">Email Address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 font-sans"
          placeholder="linus@example.com"
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-mono text-slate-300 mb-1.5">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength={8}
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 font-sans"
          placeholder="Minimum 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full py-3 rounded-xl text-xs font-display font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 border border-indigo-400/20"
      >
        {isLoading ? 'Creating Account...' : 'Complete Sign Up'}
      </button>
    </form>

    <div class="text-center text-xs text-slate-400 pt-3 border-t border-white/[0.06] font-sans">
      Already have an account?
      <a href="/login" class="text-indigo-400 hover:text-indigo-300 font-semibold ml-1">Log In</a>
    </div>
  </div>
</div>
