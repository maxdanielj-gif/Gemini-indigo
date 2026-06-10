import React, { useEffect, useRef, useState } from 'react';

// ── MobileDebugger ─────────────────────────────────────────────────────────
// Floating bug button in the corner — zero screen space when closed.
// Tap the button to open/close the panel. Panel overlays content (doesn't
// push the layout). Toggle via Settings or ?debug=true in the URL.

const MobileDebugger: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const url = new URLSearchParams(window.location.search);
    if (url.get('debug') === 'true') {
      localStorage.setItem('indigo_debugger_enabled', 'true');
      return true;
    }
    return localStorage.getItem('indigo_debugger_enabled') === 'true';
  });

  const [isOpen, setIsOpen] = useState(false);

  // Listen for toggle from Settings
  useEffect(() => {
    const handler = () => setIsEnabled(localStorage.getItem('indigo_debugger_enabled') === 'true');
    window.addEventListener('storage', (e) => { if (e.key === 'indigo_debugger_enabled') handler(); });
    window.addEventListener('indigo_debugger_toggle', handler);
    return () => {
      window.removeEventListener('storage', handler as any);
      window.removeEventListener('indigo_debugger_toggle', handler);
    };
  }, []);

  const outputRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEnabled || !isOpen) return;
    const output  = outputRef.current;
    const input   = inputRef.current;
    const suggest = suggestRef.current;
    if (!output || !input || !suggest) return;

    let entryCount  = 0;
    let cmdHistory: string[] = [];
    let historyIdx  = 0;
    let currentFilter = 'all';
    let currentSearch = '';
    let selectedEntry: HTMLElement | null = null;

    const JS_KEYWORDS = [
      'break','case','catch','class','const','continue','debugger','default',
      'delete','do','else','export','extends','finally','for','function','if',
      'import','in','instanceof','new','return','super','switch','this','throw',
      'try','typeof','var','void','while','yield',
      'console','document','window','JSON','Math','Object','Array','String',
      'Number','Boolean','fetch','localStorage','Promise','undefined','null',
      'true','false',
    ];

    function safeStringify(obj: any, maxDepth = 2): string {
      const cache = new Set();
      function helper(val: any, depth: number): any {
        if (depth > maxDepth) return '[Object]';
        if (val === null) return 'null';
        if (typeof val === 'undefined') return 'undefined';
        if (typeof val !== 'object') return String(val).slice(0, 500);
        if (cache.has(val)) return '[Circular]';
        cache.add(val);
        if (Array.isArray(val)) {
          const r = val.slice(0, 10).map(i => helper(i, depth + 1));
          if (val.length > 10) r.push(`…${val.length - 10} more`);
          return r;
        }
        const r: any = {};
        Object.keys(val).slice(0, 20).forEach(k => { r[k] = helper(val[k], depth + 1); });
        return r;
      }
      try { return JSON.stringify(helper(obj, 0), null, 2); } catch { return String(obj); }
    }

    function shouldShow(type: string, msg: string) {
      return (currentFilter === 'all' || type === currentFilter) &&
             msg.toLowerCase().includes(currentSearch.toLowerCase());
    }

    function appendEntry(args: any[], type: string) {
      entryCount++;
      const msg = args.map(a =>
        a instanceof Error ? a.message + (a.stack ? '\n' + a.stack : '') :
        typeof a === 'object' && a !== null ? safeStringify(a) : String(a)
      ).join(' ');

      const div = document.createElement('div');
      div.className = `log-dbg type-${type}`;
      div.dataset.type = type;
      div.dataset.message = msg;

      const colors: Record<string,string> = {
        error: '#ff6b6b', warn: '#ffd93d', system: '#74b9ff', log: '#00ff00'
      };
      div.style.cssText = `
        padding:2px 4px; border-bottom:1px solid #222; word-break:break-all;
        white-space:pre-wrap; color:${colors[type]||'#00ff00'};
        display:${shouldShow(type,msg)?'block':'none'}
      `;
      div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;

      // Long-press to copy
      let pressTimer: any;
      div.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          navigator.clipboard?.writeText(msg).catch(() => {});
          appendEntry(['Copied.'], 'system');
        }, 600);
      }, { passive: true });
      div.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
      div.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });

      output.appendChild(div);
      output.scrollTop = output.scrollHeight;
    }

    function applyFilters() {
      Array.from(output.children).forEach(el => {
        const d = el as HTMLElement;
        (d.style.display = shouldShow(d.dataset.type!, d.dataset.message!) ? 'block' : 'none');
      });
    }

    // Global error catchers
    window.onerror = (msg, _url, line, col, err) => {
      appendEntry([`Uncaught: ${msg} (${line}:${col})${err?.stack ? '\n'+err.stack : ''}`], 'error');
      return false;
    };
    window.addEventListener('unhandledrejection', (e: any) => {
      const r = e.reason;
      const msg = r instanceof Error
        ? `Unhandled rejection: ${r.message}${r.stack ? '\n' + r.stack : ''}`
        : `Unhandled rejection: ${String(r)}`;
      appendEntry([msg], 'error');
    });

    // Autocomplete
    input.addEventListener('input', () => {
      const text = input.value, cursor = input.selectionStart || 0;
      const before = text.slice(0, cursor);
      const dotMatch = before.match(/([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]*)$/);
      let list: string[] = [], prefix = '';

      if (dotMatch) {
        prefix = dotMatch[2];
        try {
          const obj = (0, eval)(dotMatch[1]); // indirect eval = safe to minify
          if (obj != null) {
            const props: string[] = [];
            let o = obj;
            while (o) { props.push(...Object.getOwnPropertyNames(o)); o = Object.getPrototypeOf(o); }
            list = props.filter(p => p.startsWith(prefix) && p !== prefix);
          }
        } catch {}
      } else {
        const words = before.split(/[^a-zA-Z0-9_$]/);
        prefix = words[words.length - 1];
        if (prefix.length >= 2) {
          list = [...new Set([...JS_KEYWORDS, ...cmdHistory])].filter(s => s.startsWith(prefix) && s !== prefix);
        }
      }

      suggest.innerHTML = '';
      if (list.length) {
        list.slice(0, 10).forEach(s => {
          const d = document.createElement('div');
          d.textContent = s;
          d.style.cssText = 'padding:6px 10px; cursor:pointer; border-bottom:1px solid #444; color:#fff;';
          d.addEventListener('mousedown', (e) => {
            e.preventDefault();
            input.value = text.slice(0, cursor - prefix.length) + s + text.slice(cursor);
            suggest.style.display = 'none';
            input.focus();
          });
          suggest.appendChild(d);
        });
        suggest.style.display = 'block';
      } else {
        suggest.style.display = 'none';
      }
    });

    // Keyboard
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && suggest.style.display === 'block') {
        e.preventDefault();
        (suggest.firstElementChild as HTMLElement)?.dispatchEvent(new MouseEvent('mousedown'));
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCode(); return; }
      if (e.key === 'ArrowUp' && historyIdx > 0) { e.preventDefault(); input.value = cmdHistory[--historyIdx]; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        historyIdx < cmdHistory.length - 1 ? (input.value = cmdHistory[++historyIdx]) : (input.value = '', historyIdx = cmdHistory.length);
      }
    });

    function runCode() {
      suggest.style.display = 'none';
      const code = input.value.trim();
      if (!code) return;
      cmdHistory.push(code); historyIdx = cmdHistory.length;
      appendEntry(['> ' + code], 'system');
      try { new Function(code); } catch (err: any) { appendEntry(['Syntax: ' + err.message], 'error'); return; }
      try {
        const result = (0, eval)(code); // indirect eval = safe to minify
        if (result !== undefined) appendEntry([result], 'log');
      } catch (err: any) { appendEntry([err], 'error'); }
      input.value = '';
    }

    // Expose run function to button
    (window as any)._dbgRun = runCode;
    (window as any)._dbgClear = () => { output.innerHTML = ''; entryCount = 0; };
    (window as any)._dbgFilter = (f: string) => { currentFilter = f; applyFilters(); };
    (window as any)._dbgSearch = (s: string) => { currentSearch = s; applyFilters(); };
    (window as any)._dbgCopy = () => {
      const text = Array.from(output.querySelectorAll('.log-dbg')).map(d => d.textContent).join('\n');
      navigator.clipboard?.writeText(text).then(() => appendEntry(['Copied to clipboard.'], 'system'));
    };

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    appendEntry(['Debugger ready. Ctrl+Enter or Run button to execute JS.'], 'system');

    // Flush buffered logs
    const buffer: any[] = (window as any)._logBuffer || [];
    const start = Math.max(0, buffer.length - 200);
    if (start > 0) appendEntry([`...${start} older logs hidden...`], 'system');
    buffer.slice(start).forEach((item: any) => appendEntry(item.args, item.type));

    // Register live listener
    (window as any)._logListener = (item: any) => appendEntry(item.args, item.type);

    return () => { (window as any)._logListener = null; };
  }, [isEnabled, isOpen]);

  if (!isEnabled) return null;

  return (
    <>
      {/* Floating toggle button — always visible when debugger is enabled */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 80, right: 12, zIndex: 999998,
          width: 40, height: 40, borderRadius: '50%',
          background: isOpen ? '#ff6b6b' : '#333',
          border: '2px solid #555', color: '#fff',
          fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={isOpen ? 'Close debugger' : 'Open debugger'}
      >
        {isOpen ? '✕' : '🐛'}
      </button>

      {/* Panel — overlays content, doesn't push layout */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999997,
          height: '45vh', background: '#1a1a1a', color: '#00ff00',
          fontFamily: 'monospace', fontSize: 12,
          borderTop: '2px solid #444', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.7)',
        }}>
          {/* Header controls */}
          <div style={{ background: '#2a2a2a', padding: '4px 8px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid #444' }}>
            <span style={{ color: '#74b9ff', fontWeight: 'bold', marginRight: 4 }}>🐛 Debug</span>
            <input
              type="text" placeholder="Search…"
              onChange={e => (window as any)._dbgSearch?.(e.target.value)}
              style={{ width: 70, background: '#555', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'monospace' }}
            />
            <select onChange={e => (window as any)._dbgFilter?.(e.target.value)}
              style={{ background: '#555', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'monospace' }}>
              <option value="all">All</option>
              <option value="log">Log</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="system">System</option>
            </select>
            <button onClick={() => (window as any)._dbgCopy?.()} style={{ background: '#555', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>Copy</button>
            <button onClick={() => (window as any)._dbgClear?.()} style={{ background: '#555', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>Clear</button>
          </div>

          {/* Log output */}
          <div ref={outputRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }} />

          {/* Input area */}
          <div style={{ background: '#222', borderTop: '1px solid #333', position: 'relative', flexShrink: 0 }}>
            <div ref={suggestRef} style={{ display: 'none', position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#333', border: '1px solid #555', maxHeight: 120, overflowY: 'auto', zIndex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ padding: '8px 6px', color: '#aaa' }}>&gt;</span>
              <textarea
                ref={inputRef}
                placeholder="Run JS… (Ctrl+Enter)"
                rows={1}
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '8px 4px', outline: 'none', fontFamily: 'monospace', fontSize: 12, resize: 'none', minHeight: 36, maxHeight: 80 }}
              />
              <button
                onClick={() => (window as any)._dbgRun?.()}
                style={{ background: '#336633', color: '#fff', border: 'none', padding: '4px 12px', cursor: 'pointer', alignSelf: 'stretch', fontFamily: 'monospace' }}
              >Run</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileDebugger;
