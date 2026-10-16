<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const problem = $derived(data.problem);
  const languages = $derived(data.languages);
  const currentUser = $derived(data.currentUser);

  let selectedLangId = $state(languages[0]?.id || 54);
  let sourceCode = $state(getStarterTemplate(languages[0]?.id || 54));
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  // Playground state
  let isRunningPlayground = $state(false);
  let playgroundResult = $state<any | null>(null);

  function getStarterTemplate(langId: number): string {
    switch (langId) {
      case 54: // C++
        return `#include <iostream>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Write your solution here\n    \n    return 0;\n}\n`;
      case 50: // C
        return `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}\n`;
      case 71: // Python 3
        return `import sys\n\ndef main():\n    # Read input from standard input\n    pass\n\nif __name__ == '__main__':\n    main()\n`;
      case 62: // Java
        return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n`;
      case 73: // Rust
        return `use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    // Write your solution here\n}\n`;
      case 60: // Go
        return `package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your solution here\n}\n`;
      default:
        return '';
    }
  }

  function handleLanguageChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newId = parseInt(target.value, 10);
    selectedLangId = newId;
    if (!sourceCode.trim() || sourceCode.includes('Write your solution here')) {
      sourceCode = getStarterTemplate(newId);
    }
  }

  async function handleSubmit() {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }

    if (!sourceCode.trim()) {
      submitError = 'Source code cannot be empty.';
      return;
    }

    isSubmitting = true;
    submitError = null;

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          languageId: selectedLangId,
          sourceCode,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Submission failed.');
      }

      // Redirect directly to live submission tracker
      window.location.href = `/submissions/${body.submissionId}`;
    } catch (err: any) {
      submitError = err.message || 'Error creating submission.';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleTestSample() {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }

    const firstSample = problem.samples[0];
    const sampleInput = firstSample?.sampleInputPreview || '';

    isRunningPlayground = true;
    playgroundResult = null;

    try {
      const res = await fetch('/api/playground/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageId: selectedLangId,
          sourceCode,
          stdin: sampleInput,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Playground execution failed.');
      }

      playgroundResult = body;
    } catch (err: any) {
      submitError = err.message;
    } finally {
      isRunningPlayground = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Breadcrumb & Title Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
    <div class="space-y-1">
      <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
        <a href="/problems" class="hover:underline">Problems</a>
        <span>/</span>
        <span>{problem.module}</span>
        <span>/</span>
        <span>{problem.group}</span>
      </div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl sm:text-3xl font-black text-white">{problem.title}</h1>
        {#if problem.isSolved}
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Solved ✓
          </span>
        {/if}
      </div>
    </div>

    <!-- Metadata Badges -->
    <div class="flex flex-wrap items-center gap-2 text-xs font-mono">
      <span class="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
        {problem.points} Points
      </span>
      <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800">
        CPU: {problem.timeLimit}s
      </span>
      <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800">
        Mem: {problem.memoryLimit}MB
      </span>
    </div>
  </div>

  <!-- Two-Column Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Left Column: Statement & Samples -->
    <div class="lg:col-span-6 space-y-6">
      {#if problem.hasPdf}
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div>
              <p class="text-sm font-semibold text-white">Official Statement PDF</p>
              <p class="text-xs text-slate-400">View or download the official contest specification.</p>
            </div>
          </div>
          <a
            href={`/api/problems/${encodeURIComponent(problem.id)}/statement.pdf`}
            target="_blank"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
          >
            Open PDF &rarr;
          </a>
        </div>
      {/if}

      <!-- Statement Body -->
      <div class="prose prose-invert max-w-none bg-slate-900/40 p-6 rounded-2xl border border-slate-800 text-slate-200 text-sm leading-relaxed">
        {#if problem.statementHtml}
          {@html problem.statementHtml}
        {:else}
          <p class="text-slate-400 italic">No markdown statement provided for this problem. Please refer to the PDF statement above.</p>
        {/if}
      </div>

      <!-- Sample Test Cases -->
      {#if problem.samples.length > 0}
        <div class="space-y-4">
          <h2 class="text-lg font-bold text-white tracking-tight">Sample Test Cases</h2>
          {#each problem.samples as sample, idx}
            <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <span class="text-xs font-bold text-indigo-400 font-mono">Sample #{idx + 1}</span>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span class="text-slate-400 font-semibold mb-1 block">Input:</span>
                  <pre class="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto text-slate-300">{sample.sampleInputPreview || '(empty)'}</pre>
                </div>
                <div>
                  <span class="text-slate-400 font-semibold mb-1 block">Expected Output:</span>
                  <pre class="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto text-slate-300">{sample.sampleOutputPreview || '(empty)'}</pre>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right Column: Code Editor & Submission -->
    <div class="lg:col-span-6 space-y-6">
      <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <!-- Editor Header -->
        <div class="flex items-center justify-between">
          <h2 class="text-base font-bold text-white">Submit Solution</h2>

          <!-- Language Selector -->
          <select
            value={selectedLangId}
            onchange={handleLanguageChange}
            class="bg-slate-950 border border-slate-750 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            {#each languages as lang}
              <option value={lang.id}>{lang.name}</option>
            {/each}
          </select>
        </div>

        <!-- Code Textarea -->
        <div class="relative">
          <textarea
            bind:value={sourceCode}
            rows={18}
            spellcheck={false}
            class="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
            placeholder="Write or paste your solution here..."
          ></textarea>
        </div>

        {#if submitError}
          <div class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {submitError}
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onclick={handleTestSample}
            disabled={isRunningPlayground || isSubmitting}
            class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isRunningPlayground ? 'Testing...' : 'Test on Sample'}
          </button>

          <button
            type="button"
            onclick={handleSubmit}
            disabled={isSubmitting || isRunningPlayground}
            class="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Dispatching...' : 'Submit Solution &rarr;'}
          </button>
        </div>
      </div>

      <!-- Playground Fast Run Result Card -->
      {#if playgroundResult}
        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 font-mono text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-300">Playground Test Output</span>
            <span class="px-2 py-0.5 rounded text-[10px] {playgroundResult.status.id === 3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
              {playgroundResult.status.description}
            </span>
          </div>

          {#if playgroundResult.stdout}
            <div>
              <span class="text-slate-500 block mb-1">Standard Output:</span>
              <pre class="p-3 bg-slate-950 rounded-lg text-emerald-300 overflow-x-auto">{playgroundResult.stdout}</pre>
            </div>
          {/if}

          {#if playgroundResult.stderr}
            <div>
              <span class="text-slate-500 block mb-1">Standard Error:</span>
              <pre class="p-3 bg-slate-950 rounded-lg text-rose-300 overflow-x-auto">{playgroundResult.stderr}</pre>
            </div>
          {/if}

          {#if playgroundResult.compile_output}
            <div>
              <span class="text-slate-500 block mb-1">Compile Output:</span>
              <pre class="p-3 bg-slate-950 rounded-lg text-amber-300 overflow-x-auto">{playgroundResult.compile_output}</pre>
            </div>
          {/if}

          <div class="text-[10px] text-slate-500 flex gap-4">
            <span>Time: {playgroundResult.time || '0'}s</span>
            <span>Memory: {playgroundResult.memory || 0} KB</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

