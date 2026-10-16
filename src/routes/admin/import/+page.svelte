<script lang="ts">
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
  <div class="space-y-1">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
      Instructor / Staff Portal
    </div>
    <h1 class="text-3xl font-black text-white tracking-tight">Import DOMjudge Package</h1>
    <p class="text-sm text-slate-400">
      Upload a standard DOMjudge or Kattis `.zip` package. The platform extracts testcases into Content-Addressed Storage and indexes problem limits automatically.
    </p>
  </div>

  {#if uploadError}
    <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
      {uploadError}
    </div>
  {/if}

  {#if importSuccess}
    <div class="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
      <div class="flex items-center gap-2 text-emerald-400 font-bold">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Problem Successfully Ingested!
      </div>
      <p class="text-xs text-slate-300">
        Created <span class="font-bold text-white">{importSuccess.problem.title}</span> ({importSuccess.problem.id}) with {importSuccess.testcaseCount} testcases ({importSuccess.sampleCount} samples).
      </p>
      <div class="pt-2">
        <a
          href={`/problems/${encodeURIComponent(importSuccess.problem.id)}`}
          class="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
        >
          View Problem &rarr;
        </a>
      </div>
    </div>
  {/if}

  <form onsubmit={handleImport} class="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
    <!-- File Input -->
    <div>
      <label for="zipInput" class="block text-xs font-semibold text-slate-300 mb-2">ZIP Archive Package (max 100 MB)</label>
      <input
        id="zipInput"
        type="file"
        accept=".zip,application/zip"
        onchange={handleFileChange}
        required
        class="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-2 focus:outline-none"
      />
    </div>

    <!-- Optional Overrides -->
    <div class="space-y-4 pt-2 border-t border-slate-800">
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Hierarchy Overrides (Optional)</span>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label for="moduleOverride" class="block text-xs text-slate-400 mb-1">Module</label>
          <input
            id="moduleOverride"
            type="text"
            bind:value={moduleOverride}
            placeholder="Modul-1"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div>
          <label for="groupOverride" class="block text-xs text-slate-400 mb-1">Group / Set</label>
          <input
            id="groupOverride"
            type="text"
            bind:value={groupOverride}
            placeholder="A"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div>
          <label for="codeOverride" class="block text-xs text-slate-400 mb-1">Problem Code</label>
          <input
            id="codeOverride"
            type="text"
            bind:value={codeOverride}
            placeholder="ProblemA1"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>
      </div>
    </div>

    <button
      type="submit"
      disabled={isUploading}
      class="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
