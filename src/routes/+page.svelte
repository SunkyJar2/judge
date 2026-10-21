<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const user = $derived(data.user);
</script>

<div class="space-y-16 py-4">
  <!-- Hero Section -->
  <section class="text-center max-w-4xl mx-auto space-y-6 pt-6 sm:pt-10">
    <!-- Shimmer Badge -->
    <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-xs font-mono shadow-sm">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span>ZERO-TRUST SANDBOX // ENGINE v2.4</span>
    </div>

    <!-- Editorial Space Grotesk Headline -->
    <h1 class="font-display text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.08] text-balance">
      Architected for Speed. Built for <span class="bg-gradient-to-r from-indigo-300 via-indigo-100 to-violet-300 bg-clip-text text-transparent">Competitive Programming</span>.
    </h1>

    <p class="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed text-pretty font-sans">
      Full fidelity compatibility with Kattis and DOMjudge package specs. Instant token output validation, microsecond isolation limits, and real-time SSE execution telemetry.
    </p>

    <!-- CTAs -->
    <div class="flex flex-wrap items-center justify-center gap-4 pt-3">
      <a
        href="/problems"
        class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-display font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all hover:-translate-y-0.5 border border-indigo-400/20"
      >
        Explore Problemset &rarr;
      </a>
      <a
        href="/playground"
        class="px-6 py-3 rounded-xl bg-[#111420]/80 hover:bg-[#181c2b] text-slate-200 font-display font-semibold text-sm border border-white/[0.08] shadow-lg transition-all hover:-translate-y-0.5"
      >
        Launch Playground
      </a>
    </div>

    <!-- Key Metrics Strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-8 max-w-3xl mx-auto">
      <div class="p-3.5 rounded-xl glass-panel text-center">
        <span class="block font-mono text-xl font-bold text-white tabular-nums">&lt;10ms</span>
        <span class="text-[11px] font-mono text-slate-400">Validator Jitter</span>
      </div>
      <div class="p-3.5 rounded-xl glass-panel text-center">
        <span class="block font-mono text-xl font-bold text-indigo-400 tabular-nums">100%</span>
        <span class="text-[11px] font-mono text-slate-400">Kattis Spec Parity</span>
      </div>
      <div class="p-3.5 rounded-xl glass-panel text-center">
        <span class="block font-mono text-xl font-bold text-emerald-400 tabular-nums">6+</span>
        <span class="text-[11px] font-mono text-slate-400">Supported Languages</span>
      </div>
      <div class="p-3.5 rounded-xl glass-panel text-center">
        <span class="block font-mono text-xl font-bold text-violet-400 tabular-nums">0ms</span>
        <span class="text-[11px] font-mono text-slate-400">Polling Overhead</span>
      </div>
    </div>
  </section>

  <!-- Bento Grid Architecture Showcase -->
  <section class="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
    <!-- Bento 1: Terminal Execution Simulation (Large 7-col) -->
    <div class="md:col-span-7 glass-panel rounded-2xl p-6 sm:p-7 space-y-4 relative overflow-hidden">
      <div class="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-rose-500/80"></span>
          <span class="w-3 h-3 rounded-full bg-amber-500/80"></span>
          <span class="w-3 h-3 rounded-full bg-emerald-500/80"></span>
          <span class="text-xs font-mono text-slate-400 ml-2">sandbox-telemetry.log</span>
        </div>
        <span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE STREAM</span>
      </div>

      <!-- Simulated Terminal Output -->
      <div class="bg-[#05060a] p-4 rounded-xl border border-white/[0.05] font-mono text-xs space-y-1.5 overflow-x-auto text-slate-300">
        <p class="text-slate-500">// Dispatching submission to isolated worker pool</p>
        <p><span class="text-indigo-400">[00.001s]</span> <span class="text-slate-400">Ingest:</span> sub_401a8 (C++20 -O3 -Wall)</p>
        <p><span class="text-indigo-400">[00.004s]</span> <span class="text-slate-400">Sandbox:</span> cgroup2 limits applied [RAM: 256MB, CPU: 1.000s]</p>
        <p><span class="text-emerald-400">[00.012s]</span> Test #01 (sample_01) ... <span class="text-emerald-400 font-bold">AC</span> (3ms, 12.4MB)</p>
        <p><span class="text-emerald-400">[00.019s]</span> Test #02 (sample_02) ... <span class="text-emerald-400 font-bold">AC</span> (5ms, 13.1MB)</p>
        <p><span class="text-emerald-400">[00.026s]</span> Test #03 (stress_max) ... <span class="text-emerald-400 font-bold">AC</span> (74ms, 38.2MB)</p>
        <p class="text-emerald-300 font-bold pt-1 border-t border-white/[0.08]">
          &gt;&gt; VERDICT: ACCEPTED [100.0 pts] Token Diff: Exact Match
        </p>
      </div>

      <div class="space-y-1">
        <h3 class="font-display text-lg font-bold text-white">Microsecond Sandboxed Isolation</h3>
        <p class="text-xs text-slate-400 leading-relaxed font-sans">
          Built-in containerized cgroup and seccomp limits isolate CPU and memory usage, with protection against fork bombs and malicious system calls.
        </p>
      </div>
    </div>

    <!-- Bento 2: SSE Telemetry (5-col) -->
    <div class="md:col-span-5 glass-panel rounded-2xl p-6 sm:p-7 space-y-5 flex flex-col justify-between">
      <div class="space-y-3">
        <div class="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="font-display text-lg font-bold text-white">Zero-Polling SSE Telemetry</h3>
        <p class="text-xs text-slate-400 leading-relaxed font-sans">
          Eliminate client polling. Test transitions, compile logs, and time benchmarks stream seamlessly over Server-Sent Events with Redis Pub/Sub backplane.
        </p>
      </div>

      <!-- Live progress meter mock -->
      <div class="bg-[#05060a] p-4 rounded-xl border border-white/[0.05] space-y-2 font-mono text-xs">
        <div class="flex justify-between text-slate-400">
          <span>Batch Execution</span>
          <span class="text-indigo-400 font-bold">28 / 28 Tests</span>
        </div>
        <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/[0.05]">
          <div class="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full w-full"></div>
        </div>
        <span class="text-[10px] text-emerald-400 flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Stream finalized in 118ms
        </span>
      </div>
    </div>

    <!-- Bento 3: Kattis & DOMjudge Packaging Spec (6-col) -->
    <div class="md:col-span-6 glass-panel rounded-2xl p-6 space-y-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <h3 class="font-display text-lg font-bold text-white">Full Spec Parity</h3>
      <p class="text-xs text-slate-400 leading-relaxed font-sans">
        Native ingestion of Kattis and DOMjudge problem packages. Automatic parsing of <code class="text-indigo-300">problem.yaml</code>, markdown specifications, embedded contest PDFs, and sample testcases.
      </p>
    </div>

    <!-- Bento 4: Hardened Security Architecture (6-col) -->
    <div class="md:col-span-6 glass-panel rounded-2xl p-6 space-y-3">
      <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 class="font-display text-lg font-bold text-white">Zip-Slip & Symlink Defense</h3>
      <p class="text-xs text-slate-400 leading-relaxed font-sans">
        Hardened package extraction with canonical path validation prevents directory traversal attacks, symlink exploits, and memory exhaust bombs before evaluation begins.
      </p>
    </div>
  </section>
</div>
