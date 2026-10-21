<script lang="ts">
  import type { PageProps } from './$types';
  import { getProblemApiHref } from '#lib/utils';

  let { data }: PageProps = $props();
  const problem = $derived(data.problem);
  const languages = $derived(data.languages);
  const currentUser = $derived(data.currentUser);

  // Editor State
  let selectedLangId = $state(54);
  let sourceCode = $state(getStarterTemplate(54));

  $effect(() => {
    if (data.languages && data.languages[0] && selectedLangId === 54) {
      selectedLangId = data.languages[0].id;
      sourceCode = getStarterTemplate(data.languages[0].id);
    }
  });
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);
  let copyFeedback = $state(false);
  let activeTab = $state<'statement' | 'pdf'>('statement');
  let editorFontSize = $state<'text-xs' | 'text-sm' | 'text-base'>('text-xs');

  // Playground / Sample Testing state
  let isRunningPlayground = $state(false);
  let playgroundResult = $state<any | null>(null);

  function getStarterTemplate(langId: number): string {
    switch (langId) {
      case 54: // C++
        return `#include <iostream>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Write your solution here\n    \n    return 0;\n}\n`;
      case 50: // C
        return `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}\n`;
      case 71: // Python 3
        return `import sys\n\ndef main():\n    # Read all tokens or lines from stdin\n    input_data = sys.stdin.read().split()\n    if not input_data:\n        return\n    \n    # Write your solution here\n\nif __name__ == '__main__':\n    main()\n`;
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

  function handleResetTemplate() {
    if (confirm('Reset editor to default starter template? Current edits will be replaced.')) {
      sourceCode = getStarterTemplate(selectedLangId);
    }
  }

  async function handleCopyCode() {
    if (!sourceCode) return;
    try {
      await navigator.clipboard.writeText(sourceCode);
      copyFeedback = true;
      setTimeout(() => {
        copyFeedback = false;
      }, 2000);
    } catch {
      // Fallback
    }
  }

  // Handle Tab key in textarea to insert 4 spaces instead of blurring
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      sourceCode = sourceCode.substring(0, start) + '    ' + sourceCode.substring(end);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
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
    submitError = null;

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

      playgroundResult = {
        ...body,
        expectedOutput: firstSample?.sampleOutputPreview || '',
        isSampleMatch: firstSample ? body.stdout?.trim() === firstSample.sampleOutputPreview?.trim() : false,
      };
    } catch (err: any) {
      submitError = err.message;
    } finally {
      isRunningPlayground = false;
    }
  }

  const pdfUrl = $derived(getProblemApiHref(problem.id, 'statement.pdf'));
</script>

<svelte:head>
  <title>{problem.code}: {problem.title} &bull; DOMjudge Next</title>
</svelte:head>

<div class="space-y-6">
  <!-- Breadcrumb & Title Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
    <div class="space-y-1.5">
      <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
        <a href="/problems" class="hover:text-indigo-400 transition-colors">Problems</a>
        <span class="text-slate-600">/</span>
        <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">{problem.module}</span>
        <span class="text-slate-600">/</span>
        <span class="text-slate-400">{problem.group}</span>
      </div>

      <div class="flex items-center gap-3">
        <span class="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
          {problem.code}
        </span>
        <h1 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">{problem.title}</h1>
        {#if problem.isSolved}
          <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Solved
          </span>
        {/if}
      </div>
    </div>

    <!-- Metadata Badges -->
    <div class="flex flex-wrap items-center gap-2 text-xs font-mono">
      <span class="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold shadow-sm">
        {problem.points} Points
      </span>
      <span class="px-3 py-1.5 rounded-xl bg-[#0e1017] text-slate-300 border border-white/[0.08]">
        CPU: {problem.timeLimit}s
      </span>
      <span class="px-3 py-1.5 rounded-xl bg-[#0e1017] text-slate-300 border border-white/[0.08]">
        Mem: {problem.memoryLimit}MB
      </span>
    </div>
  </div>

  <!-- Two-Column Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- Left Column: Statement, PDF Reader & Samples -->
    <div class="lg:col-span-6 space-y-6">
      <!-- Tabs Header: Statement vs PDF -->
      <div class="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div class="flex items-center gap-2">
          <button
            onclick={() => activeTab = 'statement'}
            class="px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all {activeTab === 'statement' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/30' : 'bg-[#0f111a]/80 text-slate-400 hover:text-white border border-white/[0.06]'}"
          >
            Specification
          </button>
          {#if problem.hasPdf}
            <button
              onclick={() => activeTab = 'pdf'}
              class="px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 {activeTab === 'pdf' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/30' : 'bg-[#0f111a]/80 text-slate-400 hover:text-white border border-white/[0.06]'}"
            >
              <svg class="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Contest PDF
            </button>
          {/if}
        </div>

        {#if problem.hasPdf}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 hover:underline"
          >
            Open in new tab &rarr;
          </a>
        {/if}
      </div>

      <!-- Tab 1: Statement Markdown -->
      {#if activeTab === 'statement'}
        <div class="space-y-6">
          <div class="prose max-w-none glass-panel p-6 sm:p-8 rounded-2xl shadow-xl">
            {#if problem.statementHtml}
              {@html problem.statementHtml}
            {:else}
              <div class="text-center py-8 space-y-3">
                <p class="text-slate-400 italic font-sans">No markdown statement provided for this problem.</p>
                {#if problem.hasPdf}
                  <button
                    onclick={() => activeTab = 'pdf'}
                    class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-mono font-bold hover:bg-indigo-500 transition-colors"
                  >
                    View Official PDF Specification &rarr;
                  </button>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Sample Test Cases -->
          {#if problem.samples && problem.samples.length > 0}
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 class="font-display text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                  Sample Test Cases ({problem.samples.length})
                </h2>
                <span class="text-[11px] text-slate-500 font-mono">Input / Expected Output</span>
              </div>

              {#each problem.samples as sample, idx}
                <div class="p-5 rounded-2xl glass-panel space-y-3 shadow-lg">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      Sample #{idx + 1}
                    </span>
                    {#if idx === 0}
                      <span class="text-[10px] text-slate-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded font-mono">Used for quick sample test</span>
                    {/if}
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span class="text-slate-400 font-semibold mb-1 block">Input:</span>
                      <pre class="bg-[#05060a] p-3.5 rounded-xl border border-white/[0.06] overflow-x-auto text-slate-200">{sample.sampleInputPreview || '(empty)'}</pre>
                    </div>
                    <div>
                      <span class="text-slate-400 font-semibold mb-1 block">Expected Output:</span>
                      <pre class="bg-[#05060a] p-3.5 rounded-xl border border-white/[0.06] overflow-x-auto text-emerald-300">{sample.sampleOutputPreview || '(empty)'}</pre>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Tab 2: Embedded PDF Viewer -->
        <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl space-y-2 p-2">
          <div class="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] text-xs font-mono">
            <span class="font-bold text-slate-300">Official Specification PDF</span>
            <a
              href={pdfUrl}
              download={`${problem.code}_${problem.title}.pdf`}
              class="px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] transition-colors font-semibold"
            >
              Download PDF
            </a>
          </div>
          <iframe
            src={pdfUrl}
            title={`${problem.title} PDF`}
            class="w-full h-[700px] rounded-xl border border-white/[0.06] bg-[#05060a]"
          ></iframe>
        </div>
      {/if}
    </div>

    <!-- Right Column: Code Editor & Submission -->
    <div class="lg:col-span-6 space-y-6 sticky top-20">
      <div class="glass-panel rounded-2xl p-6 space-y-4 shadow-2xl">
        <!-- Editor Header & Controls -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div class="flex items-center gap-2">
            <h2 class="font-display text-base font-bold text-white">Solution Editor</h2>
            <span class="text-[10px] text-slate-500 font-mono">(Tab = 4 spaces)</span>
          </div>

          <!-- Controls: Language, Reset, Copy -->
          <div class="flex items-center gap-2">
            <!-- Language Selector -->
            <select
              value={selectedLangId}
              onchange={handleLanguageChange}
              class="bg-[#05060a] border border-white/[0.08] text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-400 font-mono"
            >
              {#each languages as lang}
                <option value={lang.id}>{lang.name}</option>
              {/each}
            </select>

            <!-- Copy Code -->
            <button
              type="button"
              onclick={handleCopyCode}
              title="Copy code to clipboard"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
            >
              {#if copyFeedback}
                <span class="text-[10px] text-emerald-400 font-bold px-1">Copied!</span>
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              {/if}
            </button>

            <!-- Reset Template -->
            <button
              type="button"
              onclick={handleResetTemplate}
              title="Reset starter template"
              class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Code Textarea -->
        <div class="relative">
          <textarea
            bind:value={sourceCode}
            onkeydown={handleKeyDown}
            rows={19}
            spellcheck={false}
            class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl p-4 font-mono {editorFontSize} text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 resize-y selection:bg-indigo-600"
            placeholder="Write or paste your competitive solution here..."
          ></textarea>
        </div>

        <!-- Editor Footer Info -->
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>{sourceCode.split('\n').length} lines &bull; {sourceCode.length} characters</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300">Ctrl</kbd> + <kbd class="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300">Enter</kbd> to submit</span>
        </div>

        {#if submitError}
          <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            {submitError}
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onclick={handleTestSample}
            disabled={isRunningPlayground || isSubmitting}
            class="px-4 py-2.5 rounded-xl text-xs font-mono font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {#if isRunningPlayground}
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              Executing Sandbox...
            {:else}
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Test on Sample #1
            {/if}
          </button>

          <button
            type="button"
            onclick={handleSubmit}
            disabled={isSubmitting || isRunningPlayground}
            class="px-6 py-2.5 rounded-xl text-xs font-display font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2 border border-indigo-400/20"
          >
            {#if isSubmitting}
              <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
              Dispatching to Judge...
            {:else}
              Submit Solution &rarr;
            {/if}
          </button>
        </div>
      </div>

      <!-- Playground Fast Run Result Card -->
      {#if playgroundResult}
        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4 font-mono text-xs shadow-2xl backdrop-blur-md">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span class="font-bold text-slate-300">Sandbox Test Result</span>
            <div class="flex items-center gap-2">
              {#if playgroundResult.isSampleMatch}
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sample Matched ✓
                </span>
              {/if}
              <span class="px-2 py-0.5 rounded text-[10px] font-bold {playgroundResult.status.id === 3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                {playgroundResult.status.description}
              </span>
            </div>
          </div>

          {#if playgroundResult.stdout}
            <div>
              <span class="text-slate-400 block mb-1">Your Program Output:</span>
              <pre class="p-3.5 bg-slate-950 rounded-xl text-emerald-300 border border-slate-850 overflow-x-auto">{playgroundResult.stdout}</pre>
            </div>
          {/if}

          {#if playgroundResult.expectedOutput}
            <div>
              <span class="text-slate-400 block mb-1">Expected Sample Output:</span>
              <pre class="p-3.5 bg-slate-950 rounded-xl text-indigo-300 border border-slate-850 overflow-x-auto">{playgroundResult.expectedOutput}</pre>
            </div>
          {/if}

          {#if playgroundResult.stderr}
            <div>
              <span class="text-rose-400 block mb-1">Standard Error:</span>
              <pre class="p-3.5 bg-slate-950 rounded-xl text-rose-300 border border-rose-950/60 overflow-x-auto">{playgroundResult.stderr}</pre>
            </div>
          {/if}

          {#if playgroundResult.compile_output}
            <div>
              <span class="text-amber-400 block mb-1">Compilation Message:</span>
              <pre class="p-3.5 bg-slate-950 rounded-xl text-amber-300 border border-amber-950/60 overflow-x-auto">{playgroundResult.compile_output}</pre>
            </div>
          {/if}

          <div class="text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Execution Time: {playgroundResult.time || '0'}s</span>
            <span>Memory Peak: {playgroundResult.memory || 0} KB</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
