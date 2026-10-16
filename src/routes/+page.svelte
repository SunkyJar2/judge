<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const user = $derived(data.user);
</script>

<div class="space-y-16 py-6">
  <!-- Hero Section -->
  <section class="text-center max-w-3xl mx-auto space-y-6 pt-8">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-medium">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      Judge0 Sandboxed Execution Online
    </div>

    <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
      High Performance <span class="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Automated Judge</span> for Competitive Programming
    </h1>

    <p class="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
      Fully compatible with Kattis and DOMjudge package specifications. Instant token-based output validation, floating point tolerances, compile-once evaluation, and real-time SSE execution telemetry.
    </p>

    <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
      <a
        href="/problems"
        class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
      >
        Browse Problemset &rarr;
      </a>
      <a
        href="/playground"
        class="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all hover:scale-105"
      >
        Open Playground
      </a>
    </div>
  </section>

  <!-- Key Architecture Features -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
    <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3">
      <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-white">Judge0 Isolated Sandbox</h3>
      <p class="text-sm text-slate-400">
        Multi-language containerized isolation supporting C, C++, Python 3, Java, Rust, and Go with microsecond precision limits.
      </p>
    </div>

    <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3">
      <div class="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-white">Real-Time SSE Streaming</h3>
      <p class="text-sm text-slate-400">
        Live testcase transitions streamed directly via Redis Pub/Sub and Server-Sent Events with zero polling overhead.
      </p>
    </div>

    <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-white">DOMjudge & Kattis Packages</h3>
      <p class="text-sm text-slate-400">
        Hardened ZIP import engine defending against Zip-Slip and symlink attacks with content-addressed testcase deduplication.
      </p>
    </div>
  </section>
</div>
