import type { TraceArtifact, TraceEvent } from './interfaces/index.js';
export type { TraceArtifact, TraceEvent } from './interfaces/index.js';

export function renderTraceViewer(traces: TraceArtifact[]): string {
  const payload = JSON.stringify(traces, null, 2).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FDEKit Trace Viewer</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f4; color: #1d2329; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .meta { color: #59636e; margin-bottom: 24px; }
    .trace { border: 1px solid #d8d8d0; border-radius: 8px; background: #fff; margin-bottom: 16px; overflow: hidden; }
    .trace header { padding: 14px 16px; border-bottom: 1px solid #e7e7df; display: flex; justify-content: space-between; gap: 16px; }
    .event { padding: 12px 16px; border-top: 1px solid #efefe7; }
    .event:first-of-type { border-top: 0; }
    code { background: #f0f0e8; padding: 2px 5px; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 8px 0 0; color: #39414a; }
  </style>
</head>
<body>
  <main>
    <h1>FDEKit Trace Viewer</h1>
    <div class="meta" id="meta"></div>
    <section id="traces"></section>
  </main>
  <script>
    const traces = ${payload};
    document.getElementById('meta').textContent = traces.length + ' trace(s) loaded';
    document.getElementById('traces').innerHTML = traces.map((trace) => \`
      <article class="trace">
        <header>
          <strong>\${trace.deployment || 'unknown deployment'}</strong>
          <code>\${trace.id || 'no-id'}</code>
        </header>
        \${(trace.events || []).map((event) => \`
          <div class="event">
            <strong>\${event.type || 'event'}</strong>
            <pre>\${escapeHtml(JSON.stringify(event, null, 2))}</pre>
          </div>
        \`).join('')}
      </article>
    \`).join('');

    function escapeHtml(value) {
      return value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[char]));
    }
  </script>
</body>
</html>
`;
}
