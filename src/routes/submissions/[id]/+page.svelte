<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageProps } from './$types';
  import { getProblemHref } from '#lib/utils';
  import CodeEditor from '#lib/components/CodeEditor.svelte';

  let { data }: PageProps = $props();
  const initial = $derived(data.submission);

  let verdict = $state('IN_QUEUE');
  let passedTests = $state(0);
  let totalTests = $state(0);
  let maxExecutionMs = $state(0);
  let maxMemoryUsedKb = $state(0);
  let testResults = $state<any[]>([]);

  $effect(() => {
    verdict = data.submission.verdict;
    passedTests = data.submission.passedTests;
    totalTests = data.submission.totalTests;
    maxExecutionMs = data.submission.maxExecutionMs;
    maxMemoryUsedKb = data.submission.maxMemoryUsedKb;
    testResults = data.submission.testResults;
  });

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
  <!-- Header Telemetry Card -->
  <div class="glass-panel p-6 sm:p-7 rounded-2xl space-y-6 shadow-2xl">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1.5">
        <span class="text-xs font-mono text-slate-500">Submission #{initial.id.slice(-8)}</span>
        <h1 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          <a href={getProblemHref(initial.problem.id)} class="hover:underline hover:text-indigo-400 transition-colors">
            {initial.problem.title}
          </a>
        </h1>
        <p class="text-xs text-slate-400 font-sans">
          Submitted by <span class="font-semibold text-slate-300">{initial.user.name || initial.user.email}</span>
          &bull; <span class="font-mono text-slate-500">{new Date(initial.createdAt).toLocaleString()}</span>
        </p>
      </div>

      <!-- Verdict Large Badge -->
      <div class="flex items-center">
        <span class="px-5 py-2.5 rounded-xl text-sm font-mono font-extrabold border {badge.class} tracking-wide shadow-sm">
          {badge.text}
        </span>
      </div>
    </div>

    <!-- Telemetry Stats Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.06] font-mono text-xs">
      <div class="p-3.5 bg-[#07090e]/80 rounded-xl border border-white/[0.05]">
        <span class="text-slate-500 block mb-1 text-[11px]">Passed Tests</span>
        <span class="text-base font-bold text-white tabular-nums">{passedTests} / {totalTests}</span>
      </div>
      <div class="p-3.5 bg-[#07090e]/80 rounded-xl border border-white/[0.05]">
        <span class="text-slate-500 block mb-1 text-[11px]">Max Execution Time</span>
        <span class="text-base font-bold text-white tabular-nums">{maxExecutionMs} ms</span>
      </div>
      <div class="p-3.5 bg-[#07090e]/80 rounded-xl border border-white/[0.05]">
        <span class="text-slate-500 block mb-1 text-[11px]">Max Memory Used</span>
        <span class="text-base font-bold text-white tabular-nums">{Math.round(maxMemoryUsedKb / 1024)} MB</span>
      </div>
      <div class="p-3.5 bg-[#07090e]/80 rounded-xl border border-white/[0.05]">
        <span class="text-slate-500 block mb-1 text-[11px]">Judge Runtime</span>
        <span class="text-base font-bold text-indigo-400">Piston/Judge0</span>
      </div>
    </div>
  </div>

  <!-- Compiler Output (if CE or warnings) -->
  {#if initial.compilerOutput}
    <div class="glass-panel p-6 rounded-2xl border-amber-500/20 bg-amber-500/5 space-y-3">
      <h3 class="text-sm font-mono font-bold text-amber-400 flex items-center gap-2">
        <span>⚠</span> Compiler Diagnostics
      </h3>
      <pre class="bg-[#05060a] p-4 rounded-xl text-xs font-mono text-amber-200 overflow-x-auto border border-amber-500/15 leading-relaxed">{initial.compilerOutput}</pre>
    </div>
  {/if}

  <!-- Testcase Breakdown Table -->
  <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl">
    <div class="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
      <h2 class="font-display text-base font-bold text-white">Test Cases Breakdown</h2>
      <span class="text-xs text-slate-400 font-mono">{testResults.length} Cases Evaluated</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs font-mono">
        <thead class="bg-[#07090e]/80 text-slate-400 border-b border-white/[0.06] uppercase text-[11px]">
          <tr>
            <th class="py-3 px-4 w-16">#</th>
            <th class="py-3 px-4">Type</th>
            <th class="py-3 px-4">Verdict</th>
            <th class="py-3 px-4">Time</th>
            <th class="py-3 px-4">Memory</th>
            <th class="py-3 px-4">Diagnostics</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/[0.04]">
          {#each testResults as tc, idx}
            {@const tcBadge = getVerdictBadge(tc.verdict)}
            <tr class="hover:bg-white/[0.03] transition-colors">
              <td class="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>
              <td class="py-3 px-4">
                {#if tc.isSample}
                  <span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">Sample</span>
                {:else}
                  <span class="px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/[0.08] text-[10px]">Secret</span>
                {/if}
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold border {tcBadge.class}">
                  {tcBadge.text}
                </span>
              </td>
              <td class="py-3 px-4 text-slate-300 tabular-nums">{tc.executionTimeMs} ms</td>
              <td class="py-3 px-4 text-slate-300 tabular-nums">{Math.round(tc.memoryUsedKb / 1024)} MB</td>
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
    <div class="glass-panel rounded-2xl p-6 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-base font-bold text-white">Submitted Source Code</h2>
        <button
          onclick={() => navigator.clipboard.writeText(initial.sourceCode || '')}
          class="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] transition-colors"
        >
          Copy Code
        </button>
      </div>

      <CodeEditor
        readonly={true}
        value={initial.sourceCode}
        languageId={initial.languageId}
        minHeight="260px"
      />
    </div>
  {/if}
</div>

