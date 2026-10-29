<script lang="ts">
  import Prism from 'prismjs';
  import 'prismjs/components/prism-clike.js';
  import 'prismjs/components/prism-c.js';
  import 'prismjs/components/prism-cpp.js';
  import 'prismjs/components/prism-python.js';
  import 'prismjs/components/prism-java.js';
  import 'prismjs/components/prism-rust.js';
  import 'prismjs/components/prism-go.js';
  import 'prismjs/components/prism-javascript.js';
  import 'prismjs/components/prism-typescript.js';

  interface Props {
    value?: string;
    languageId?: number;
    language?: string;
    fontSize?: string;
    minHeight?: string;
    placeholder?: string;
    readonly?: boolean;
    onRunOrSubmit?: () => void;
  }

  let {
    value = $bindable(''),
    languageId = 54,
    language,
    fontSize = 'text-xs',
    minHeight = '420px',
    placeholder = 'Write or paste code here...',
    readonly = false,
    onRunOrSubmit,
  }: Props = $props();

  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let preEl: HTMLPreElement | null = $state(null);
  let gutterEl: HTMLDivElement | null = $state(null);

  // Map language ID or name to Prism grammar and language name
  const langConfig = $derived.by(() => {
    if (language) {
      const lower = language.toLowerCase();
      if (lower === 'c++' || lower === 'cpp') return { grammar: Prism.languages.cpp, name: 'cpp' };
      if (lower === 'c') return { grammar: Prism.languages.c, name: 'c' };
      if (lower === 'python' || lower === 'py') return { grammar: Prism.languages.python, name: 'python' };
      if (lower === 'java') return { grammar: Prism.languages.java, name: 'java' };
      if (lower === 'rust' || lower === 'rs') return { grammar: Prism.languages.rust, name: 'rust' };
      if (lower === 'go') return { grammar: Prism.languages.go, name: 'go' };
      if (lower === 'javascript' || lower === 'js') return { grammar: Prism.languages.javascript, name: 'javascript' };
      if (lower === 'typescript' || lower === 'ts') return { grammar: Prism.languages.typescript, name: 'typescript' };
    }
    switch (languageId) {
      case 54:
        return { grammar: Prism.languages.cpp, name: 'cpp' };
      case 50:
        return { grammar: Prism.languages.c, name: 'c' };
      case 71:
        return { grammar: Prism.languages.python, name: 'python' };
      case 62:
        return { grammar: Prism.languages.java, name: 'java' };
      case 73:
        return { grammar: Prism.languages.rust, name: 'rust' };
      case 60:
        return { grammar: Prism.languages.go, name: 'go' };
      case 63:
        return { grammar: Prism.languages.javascript, name: 'javascript' };
      case 74:
        return { grammar: Prism.languages.typescript, name: 'typescript' };
      default:
        return { grammar: Prism.languages.clike, name: 'clike' };
    }
  });

  const highlightedHtml = $derived.by(() => {
    const raw = value || '';
    if (!raw) return '';
    try {
      const grammar = langConfig.grammar || Prism.languages.clike;
      const html = Prism.highlight(raw, grammar, langConfig.name);
      return raw.endsWith('\n') ? html + ' ' : html;
    } catch {
      return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  });

  const lineCount = $derived((value || '').split('\n').length);
  const lineNumbers = $derived(Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1));

  function handleScroll() {
    if (!textareaEl) return;
    if (preEl) {
      preEl.scrollTop = textareaEl.scrollTop;
      preEl.scrollLeft = textareaEl.scrollLeft;
    }
    if (gutterEl) {
      gutterEl.scrollTop = textareaEl.scrollTop;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (readonly) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!textareaEl) return;

      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;

      if (e.shiftKey) {
        // Shift + Tab: unindent 4 spaces
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const spacesToRemove = currentLine.match(/^ {1,4}/)?.[0].length || 0;
        if (spacesToRemove > 0) {
          value = value.slice(0, lineStart) + value.slice(lineStart + spacesToRemove);
          setTimeout(() => {
            if (textareaEl) {
              textareaEl.selectionStart = textareaEl.selectionEnd = Math.max(lineStart, start - spacesToRemove);
            }
          }, 0);
        }
      } else {
        // Tab: insert 4 spaces
        value = value.substring(0, start) + '    ' + value.substring(end);
        setTimeout(() => {
          if (textareaEl) {
            textareaEl.selectionStart = textareaEl.selectionEnd = start + 4;
          }
        }, 0);
      }
    } else if (e.key === 'Enter') {
      if (!textareaEl) return;
      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;

      // Maintain indentation and auto-indent block braces/colons
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      const indent = currentLine.match(/^\s*/)?.[0] || '';
      const extraIndent = /[{:]\s*$/.test(currentLine) ? '    ' : '';
      const insertion = '\n' + indent + extraIndent;

      e.preventDefault();
      value = value.substring(0, start) + insertion + value.substring(end);
      setTimeout(() => {
        if (textareaEl) {
          textareaEl.selectionStart = textareaEl.selectionEnd = start + insertion.length;
          handleScroll();
        }
      }, 0);
    } else if (e.key === 'Backspace' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      if (!textareaEl) return;
      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;
      if (start === end && start >= 4) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const beforeCursor = value.slice(lineStart, start);
        if (/^ +$/.test(beforeCursor) && beforeCursor.length % 4 === 0) {
          e.preventDefault();
          value = value.slice(0, start - 4) + value.slice(start);
          setTimeout(() => {
            if (textareaEl) {
              textareaEl.selectionStart = textareaEl.selectionEnd = start - 4;
              handleScroll();
            }
          }, 0);
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRunOrSubmit?.();
    }
  }
</script>

<div
  class="relative flex w-full bg-[#05060a] border border-white/[0.08] rounded-xl overflow-hidden font-mono {fontSize} focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20 transition-all shadow-inner"
  style="min-height: {minHeight};"
>
  <!-- Line Numbers Gutter -->
  <div
    bind:this={gutterEl}
    aria-hidden="true"
    class="select-none overflow-hidden shrink-0 border-r border-white/[0.06] bg-[#07090e]/90 text-right text-slate-600 font-mono text-[11px] leading-[1.6rem] py-4 px-3 w-12"
  >
    {#each lineNumbers as num}
      <div class="h-[1.6rem]">{num}</div>
    {/each}
  </div>

  <!-- Synchronized Highlight & Textarea Container -->
  <div class="relative flex-1 min-w-0 h-full overflow-hidden">
    <!-- Underlay: Syntax-highlighted HTML -->
    <pre
      bind:this={preEl}
      aria-hidden="true"
      class="editor-underlay m-0 p-4 font-mono {fontSize} leading-[1.6rem] whitespace-pre overflow-auto pointer-events-none text-slate-200"
      style="tab-size: 4; -moz-tab-size: 4;"
    ><code class="language-{langConfig.name}">{@html highlightedHtml || (placeholder ? `<span class="text-slate-600 italic select-none">${placeholder}</span>` : '')}</code></pre>

    <!-- Overlay: Native interactive textarea -->
    <textarea
      bind:this={textareaEl}
      bind:value={value}
      onkeydown={handleKeyDown}
      onscroll={handleScroll}
      {readonly}
      spellcheck={false}
      autocapitalize="off"
      autocomplete="off"
      data-gramm="false"
      class="editor-textarea absolute inset-0 w-full h-full m-0 p-4 font-mono {fontSize} leading-[1.6rem] whitespace-pre overflow-auto bg-transparent border-none outline-none resize-none text-transparent caret-indigo-400 selection:bg-indigo-600/35 selection:text-transparent"
      style="tab-size: 4; -moz-tab-size: 4;"
      placeholder={value ? '' : placeholder}
    ></textarea>
  </div>
</div>

<style>
  .editor-underlay,
  .editor-textarea {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    letter-spacing: 0px;
    word-spacing: 0px;
    box-sizing: border-box;
  }

  .editor-underlay {
    position: absolute;
    inset: 0;
  }

  /* Custom scrollbar matching platform */
  .editor-textarea::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .editor-textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  .editor-textarea::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
  }
  .editor-textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }
</style>
