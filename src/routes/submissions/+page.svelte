<script lang="ts">
  import type { PageProps } from './$types';
  import { getProblemHref } from '#lib/utils';

  let { data }: PageProps = $props();
  const submissions = $derived(data.submissions);

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
      case 'RUNNING':
        return { text: v, class: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse' };
      default:
        return { text: v, class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-black text-white tracking-tight">Recent Submissions</h1>
      <p class="text-sm text-slate-400 mt-1">Live stream of judging evaluations across the platform.</p>
    </div>
  </div>

  {#if submissions.length === 0}
    <div class="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 font-medium">
      No submissions recorded yet. Be the first to solve a problem!
    </div>
  {:else}
    <div class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs font-mono">
          <thead class="bg-slate-850/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4"># ID</th>
              <th class="py-3 px-4">User</th>
              <th class="py-3 px-4">Problem</th>
              <th class="py-3 px-4">Verdict</th>
              <th class="py-3 px-4">Tests</th>
              <th class="py-3 px-4">Time</th>
              <th class="py-3 px-4">Memory</th>
              <th class="py-3 px-4 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            {#each submissions as sub}
              {@const badge = getVerdictBadge(sub.verdict)}
              <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4">
                  <a href={`/submissions/${sub.id}`} class="text-indigo-400 hover:underline font-bold">
                    #{sub.id.slice(-6)}
                  </a>
                </td>

                <td class="py-3 px-4 font-sans text-sm text-slate-200">
                  <span class="font-medium">{sub.user.name || sub.user.email}</span>
                </td>

                <td class="py-3 px-4 font-sans text-sm font-semibold text-white">
                  <a href={getProblemHref(sub.problem.id)} class="hover:underline hover:text-indigo-400 transition-colors">
                    {sub.problem.title}
                  </a>
                </td>

                <td class="py-3 px-4">
                  <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold border {badge.class}">
                    {badge.text}
                  </span>
                </td>

                <td class="py-3 px-4 text-slate-300">
                  {sub.passedTests} / {sub.totalTests}
                </td>

                <td class="py-3 px-4 text-slate-300">
                  {sub.maxExecutionMs} ms
                </td>

                <td class="py-3 px-4 text-slate-300">
                  {Math.round(sub.maxMemoryUsedKb / 1024)} MB
                </td>

                <td class="py-3 px-4 text-slate-500 text-right">
                  {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

