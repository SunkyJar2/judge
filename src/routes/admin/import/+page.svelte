<script lang="ts">
  import { getProblemHref } from '#lib/utils';

  let selectedFile = $state<File | null>(null);
  let moduleOverride = $state('');
  let groupOverride = $state('');
  let codeOverride = $state('');

  let isUploading = $state(false);
  let uploadError = $state<string | null>(null);
  let importSuccess = $state<any | null>(null);

  function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      selectedFile = target.files[0];
    }
  }

  async function handleImport(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedFile) {
      uploadError = 'Please select a .zip package to import.';
      return;
    }

    isUploading = true;
    uploadError = null;
    importSuccess = null;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (moduleOverride.trim()) formData.append('module', moduleOverride.trim());
      if (groupOverride.trim()) formData.append('group', groupOverride.trim());
      if (codeOverride.trim()) formData.append('code', codeOverride.trim());

      const res = await fetch('/api/problems/import', {
        method: 'POST',
        body: formData,
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Import failed.');
      }

      importSuccess = body;
      selectedFile = null;
    } catch (err: any) {
      uploadError = err.message || 'Failed to upload problem package.';
    } finally {
      isUploading = false;
    }
  }
</script>

<div class="max-w-2xl mx-auto space-y-8 py-6">
  <div class="space-y-1.5">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-mono font-semibold border border-amber-500/20 shadow-sm">
      Instructor / Staff Portal
    </div>
    <h1 class="font-display text-3xl font-bold text-white tracking-tight">Import Problem Package</h1>
    <p class="text-sm text-slate-400 font-sans">
      Upload standard DOMjudge or Kattis <code class="text-indigo-300">.zip</code> packages. Testcases are verified and deduplicated into Content-Addressed Storage.
    </p>
  </div>

  {#if uploadError}
    <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
      {uploadError}
    </div>
  {/if}

  {#if importSuccess}
    <div class="p-6 rounded-2xl glass-panel border-emerald-500/30 bg-emerald-500/5 space-y-3 shadow-xl">
      <div class="flex items-center gap-2 text-emerald-400 font-display font-bold text-base">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Problem Successfully Ingested!
      </div>
      <p class="text-xs text-slate-300 font-sans">
        Created <span class="font-bold text-white font-display">{importSuccess.problem.title}</span> ({importSuccess.problem.id}) with {importSuccess.testcaseCount} testcases ({importSuccess.sampleCount} samples).
      </p>
      <div class="pt-2">
        <a
          href={getProblemHref(importSuccess.problem.id)}
          class="inline-flex items-center px-4 py-2 rounded-xl text-xs font-display font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-600/30"
        >
          View Problem &rarr;
        </a>
      </div>
    </div>
  {/if}

  <form onsubmit={handleImport} class="glass-panel rounded-2xl p-6 space-y-6 shadow-2xl">
    <!-- File Input -->
    <div>
      <label for="zipInput" class="block text-xs font-mono text-slate-300 mb-2">ZIP Archive Package (max 100 MB)</label>
      <input
        id="zipInput"
        type="file"
        accept=".zip,application/zip"
        onchange={handleFileChange}
        required
        class="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-[#05060a] border border-white/[0.08] rounded-xl p-2 focus:outline-none"
      />
    </div>

    <!-- Optional Overrides -->
    <div class="space-y-4 pt-2 border-t border-white/[0.06]">
      <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Hierarchy Overrides (Optional)</span>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label for="moduleOverride" class="block text-xs font-mono text-slate-400 mb-1">Module</label>
          <input
            id="moduleOverride"
            type="text"
            bind:value={moduleOverride}
            placeholder="Modul-1"
            class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 font-mono"
          />
        </div>

        <div>
          <label for="groupOverride" class="block text-xs font-mono text-slate-400 mb-1">Group / Set</label>
          <input
            id="groupOverride"
            type="text"
            bind:value={groupOverride}
            placeholder="A"
            class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 font-mono"
          />
        </div>

        <div>
          <label for="codeOverride" class="block text-xs font-mono text-slate-400 mb-1">Problem Code</label>
          <input
            id="codeOverride"
            type="text"
            bind:value={codeOverride}
            placeholder="ProblemA1"
            class="w-full bg-[#05060a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 font-mono"
          />
        </div>
      </div>
    </div>

    <button
      type="submit"
      disabled={isUploading}
      class="w-full py-3 rounded-xl text-xs font-display font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-indigo-400/20"
    >
      {#if isUploading}
        <span class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
        Ingesting & Verifying Package...
      {:else}
        Ingest Problem Package &rarr;
      {/if}
    </button>
  </form>
</div>
