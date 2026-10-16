<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const initial = data.submission;

  let verdict = $state(initial.verdict);
  let passedTests = $state(initial.passedTests);
  let totalTests = $state(initial.totalTests);
  let maxExecutionMs = $state(initial.maxExecutionMs);
  let maxMemoryUsedKb = $state(initial.maxMemoryUsedKb);
  let testResults = $state(initial.testResults);

  let eventSource: EventSource | null = null;

  const isTerminal = (v: string) =>
    v !== 'IN_QUEUE' && v !== 'COMPILING' && v !== 'RUNNING';

  onMount(() => {
    if (!isTerminal(verdict)) {
      eventSource = new EventSource(`/api/submissions/${initial.id}/stream`);

      eventSource.addEventListener('state', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.verdict) verdict = payload.verdict;
          if (payload.passedTests !== undefined) passedTests = payload.passedTests;
          if (payload.totalTests !== undefined) totalTests = payload.totalTests;
          if (payload.maxExecutionMs !== undefined) maxExecutionMs = payload.maxExecutionMs;
          if (payload.maxMemoryUsedKb !== undefined) maxMemoryUsedKb = payload.maxMemoryUsedKb;

          if (isTerminal(payload.verdict)) {
            eventSource?.close();
            // Refetch fresh test results list
            fetchFreshDetails();
          }
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
      };
    }
  });

  onDestroy(() => {
    eventSource?.close();
  });

  async function fetchFreshDetails() {
    try {
      const res = await fetch(`/api/submissions/${initial.id}`);
      if (res.ok) {
        const body = await res.json();
        testResults = body.submission.testResults;
      }
    } catch {
      // Ignore
    }
  }

  function getVerdictBadge(v: string) {
    switch (v) {
      case 'AC':
        return { text: 'Accepted', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'WA':
        return { text: 'Wrong Answer', class: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'TLE':
        return { text: 'Time Limit Exceeded', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'MLE':
        return { text: 'Memory Limit Exceeded', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'CE':
        return { text: 'Compilation Error', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'RTE':
        return { text: 'Runtime Error', class: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'COMPILING':
        return { text: 'Compiling...', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse' };
      case 'RUNNING':
        return { text: `Running (${passedTests}/${totalTests})`, class: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse' };
      case 'IN_QUEUE':
      default:
        return { text: 'In Queue', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20 animate-pulse' };
    }
  }

  const badge = $derived(getVerdictBadge(verdict));
</script>

<div class="space-y-8 max-w-5xl mx-auto">
  <!-- Header Card -->
  <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6 shadow-xl">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <span class="text-xs font-mono text-slate-500">Submission #{initial.id.slice(-8)}</span>
        <h1 class="text-2xl font-black text-white">
          <a href={`/problems/${encodeURIComponent(initial.problem.id)}`} class="hover:underline">
            {initial.problem.title}
          </a>
        </h1>
        <p class="text-xs text-slate-400">
          Submitted by <span class="font-semibold text-slate-300">{initial.user.name || initial.user.email}</span>
          &bull; {new Date(initial.createdAt).toLocaleString()}
        </p>
      </div>

      <!-- Verdict Large Badge -->
      <div class="flex items-center">
        <span class="px-5 py-2.5 rounded-xl text-sm font-extrabold border {badge.class} tracking-wide">
          {badge.text}
        </span>
      </div>
    </div>

    <!-- Telemetry Stats Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800 font-mono text-xs">
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
        <span class="text-slate-500 block mb-1">Passed Tests</span>
        <span class="text-base font-bold text-white">{passedTests} / {totalTests}</span>
      </div>
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
        <span class="text-slate-500 block mb-1">Max Execution Time</span>
        <span class="text-base font-bold text-white">{maxExecutionMs} ms</span>
      </div>
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
        <span class="text-slate-500 block mb-1">Max Memory Used</span>
        <span class="text-base font-bold text-white">{Math.round(maxMemoryUsedKb / 1024)} MB</span>
      </div>
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
        <span class="text-slate-500 block mb-1">Language ID</span>
        <span class="text-base font-bold text-white">#{initial.languageId}</span>
      </div>
    </div>
  </div>

  <!-- Compiler Output (if CE or warnings) -->
  {#if initial.compilerOutput}
    <div class="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
      <h3 class="text-sm font-bold text-amber-400">Compiler Diagnostics</h3>
      <pre class="bg-slate-950 p-4 rounded-xl text-xs font-mono text-amber-200 overflow-x-auto border border-amber-500/10 leading-relaxed">{initial.compilerOutput}</pre>
    </div>
  {/if}

  <!-- Testcase Breakdown Table -->
  <div class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
    <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
      <h2 class="text-base font-bold text-white">Test Cases Breakdown</h2>
      <span class="text-xs text-slate-400 font-mono">{testResults.length} Test Cases Total</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs font-mono">
        <thead class="bg-slate-850/80 text-slate-400 border-b border-slate-800 uppercase">
          <tr>
            <th class="py-3 px-4 w-16">#</th>
            <th class="py-3 px-4">Type</th>
            <th class="py-3 px-4">Verdict</th>
            <th class="py-3 px-4">Time</th>
            <th class="py-3 px-4">Memory</th>
            <th class="py-3 px-4">Diagnostics</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          {#each testResults as tc, idx}
            {@const tcBadge = getVerdictBadge(tc.verdict)}
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>
              <td class="py-3 px-4">
                {#if tc.isSample}
                  <span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Sample</span>
                {:else}
                  <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400">Secret</span>
                {/if}
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold border {tcBadge.class}">
                  {tcBadge.text}
                </span>
              </td>
              <td class="py-3 px-4 text-slate-300">{tc.executionTimeMs} ms</td>
              <td class="py-3 px-4 text-slate-300">{Math.round(tc.memoryUsedKb / 1024)} MB</td>
              <td class="py-3 px-4 text-slate-400">
                {tc.errorSignal || '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Source Code Card (if visible) -->
  {#if initial.sourceCode}
    <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-white">Submitted Source Code</h2>
        <button
          onclick={() => navigator.clipboard.writeText(initial.sourceCode || '')}
          class="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
        >
          Copy Code
        </button>
      </div>

      <pre class="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto border border-slate-800 leading-relaxed max-h-96">{initial.sourceCode}</pre>
    </div>
  {/if}
</div>

