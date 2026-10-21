<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const languages = $derived(data.languages);
  const currentUser = $derived(data.currentUser);

  let selectedLangId = $state(71); // Default to Python 3
  let sourceCode = $state('import sys\n\n# Read all tokens from standard input\ntokens = sys.stdin.read().split()\nprint("Read", len(tokens), "tokens:", tokens)\n');
  let stdinInput = $state('42 Hello Judge0\n100 200\n');
  let isExecuting = $state(false);
  let executionError = $state<string | null>(null);
  let result = $state<any | null>(null);

  function getStarterTemplate(langId: number): string {
    switch (langId) {
      case 71: // Python
        return 'import sys\n\ndef main():\n    data = sys.stdin.read()\n    print("Hello from Python 3! Input was:")\n    print(data)\n\nif __name__ == "__main__":\n    main()\n';
      case 54: // C++
        return '#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    string line;\n    cout << "Hello from C++!\\n";\n    while (getline(cin, line)) {\n        cout << "Echo: " << line << "\\n";\n    }\n    return 0;\n}\n';
      case 50: // C
        return '#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    char buffer[256];\n    while (fgets(buffer, sizeof(buffer), stdin)) {\n        printf("Echo: %s", buffer);\n    }\n    return 0;\n}\n';
      case 62: // Java
        return 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner s = new Scanner(System.in);\n        System.out.println("Hello from Java!");\n        while (s.hasNextLine()) {\n            System.out.println("Echo: " + s.nextLine());\n        }\n    }\n}\n';
      case 73: // Rust
        return 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    println!("Hello from Rust! Input length: {}", input.len());\n}\n';
      case 60: // Go
        return 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go!")\n}\n';
      default:
        return '';
    }
  }

  function handleLanguageChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newId = parseInt(target.value, 10);
    selectedLangId = newId;
    sourceCode = getStarterTemplate(newId);
  }

  async function handleRun() {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }

    if (!sourceCode.trim()) {
      executionError = 'Source code cannot be empty.';
      return;
    }

    isExecuting = true;
    executionError = null;
    result = null;

    try {
      const res = await fetch('/api/playground/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageId: selectedLangId,
          sourceCode,
          stdin: stdinInput,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Execution failed.');
      }

      result = body;
    } catch (err: any) {
      executionError = err.message || 'Execution request failed.';
    } finally {
      isExecuting = false;
    }
  }

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
      handleRun();
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="font-display text-3xl font-bold text-white tracking-tight">Interactive Playground</h1>
      <p class="text-sm text-slate-400 mt-1 font-sans">Instant isolated sandboxed code execution with custom standard input.</p>
    </div>

    <!-- Language Selector & Run Button -->
    <div class="flex items-center gap-3">
      <select
        value={selectedLangId}
        onchange={handleLanguageChange}
        class="bg-[#05060a] border border-white/[0.08] text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 font-mono"
      >
        {#each languages as lang}
          <option value={lang.id}>{lang.name}</option>
        {/each}
      </select>

      <button
        type="button"
        onclick={handleRun}
        disabled={isExecuting}
        class="px-5 py-2 rounded-xl text-xs font-display font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center gap-2 border border-indigo-400/20"
      >
        {#if isExecuting}
          <span class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
          Running...
        {:else}
          <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
          Run Code
        {/if}
      </button>
    </div>
  </div>

  {#if executionError}
    <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
      {executionError}
    </div>
  {/if}

  <!-- Split View: Source Code + (Stdin / Output) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Code Editor Column -->
    <div class="lg:col-span-7 glass-panel rounded-2xl p-5 space-y-3 shadow-2xl">
      <div class="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/[0.06] pb-2.5">
        <span class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-400"></span> Source Code (max 128 KB)
        </span>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-slate-500 font-mono">(Tab = 4 spaces)</span>
          <button
            onclick={() => navigator.clipboard.writeText(sourceCode)}
            class="text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]"
          >
            Copy
          </button>
        </div>
      </div>

      <textarea
        bind:value={sourceCode}
        onkeydown={handleKeyDown}
        rows={22}
        spellcheck={false}
        class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-400 resize-y selection:bg-indigo-600"
        placeholder="Type or paste code here..."
      ></textarea>

      <div class="flex justify-between text-[11px] font-mono text-slate-500 pt-1">
        <span>{sourceCode.split('\n').length} lines</span>
        <span><kbd class="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300">Ctrl</kbd> + <kbd class="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300">Enter</kbd> to run</span>
      </div>
    </div>

    <!-- Input / Output Column -->
    <div class="lg:col-span-5 space-y-6">
      <!-- Standard Input -->
      <div class="glass-panel rounded-2xl p-5 space-y-3 shadow-2xl">
        <div class="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/[0.06] pb-2.5">
          <span>Standard Input (stdin)</span>
          <button onclick={() => stdinInput = ''} class="text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">Clear</button>
        </div>
        <textarea
          bind:value={stdinInput}
          rows={6}
          spellcheck={false}
          class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-400 resize-y"
          placeholder="Custom stdin..."
        ></textarea>
      </div>

      <!-- Execution Output -->
      <div class="glass-panel rounded-2xl p-5 space-y-3 shadow-2xl">
        <div class="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/[0.06] pb-2.5">
          <span>Execution Telemetry</span>
          {#if result}
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border {result.status.id === 3 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}">
              {result.status.description}
            </span>
          {/if}
        </div>

        {#if !result && !isExecuting}
          <div class="py-12 text-center text-xs font-mono text-slate-500">
            Click "Run Code" or press Ctrl+Enter to test in sandbox.
          </div>
        {:else if isExecuting}
          <div class="py-12 text-center text-xs font-mono text-slate-400 flex flex-col items-center gap-3">
            <span class="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
            Evaluating code inside container...
          </div>
        {:else if result}
          <div class="space-y-3 font-mono text-xs">
            {#if result.stdout}
              <div>
                <span class="text-slate-500 block mb-1 text-[11px]">Standard Output:</span>
                <pre class="p-3 bg-[#05060a] rounded-xl text-emerald-300 overflow-x-auto border border-emerald-500/20 max-h-48 leading-relaxed">{result.stdout}</pre>
              </div>
            {/if}

            {#if result.stderr}
              <div>
                <span class="text-slate-500 block mb-1 text-[11px]">Standard Error:</span>
                <pre class="p-3 bg-[#05060a] rounded-xl text-rose-300 overflow-x-auto border border-rose-500/20 max-h-48 leading-relaxed">{result.stderr}</pre>
              </div>
            {/if}

            {#if result.compile_output}
              <div>
                <span class="text-slate-500 block mb-1 text-[11px]">Compiler Diagnostics:</span>
                <pre class="p-3 bg-[#05060a] rounded-xl text-amber-300 overflow-x-auto border border-amber-500/20 max-h-48 leading-relaxed">{result.compile_output}</pre>
              </div>
            {/if}

            <div class="pt-2 border-t border-white/[0.06] text-[11px] text-slate-400 flex justify-between tabular-nums">
              <span>Time: {result.time || '0'}s</span>
              <span>Memory: {result.memory || 0} KB</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

