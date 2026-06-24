export const traceAndReportStyles = `    .timeline {
      display: grid;
      gap: 9px;
    }

    .event {
      display: grid;
      grid-template-columns: 138px minmax(0, 1fr);
      gap: 12px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-alt);
    }

    .event-type {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: var(--ink);
      overflow-wrap: anywhere;
    }

    .event-main {
      min-width: 0;
      color: var(--ink);
      overflow-wrap: anywhere;
    }

    .event-meta {
      color: var(--muted);
      font-size: 12px;
      margin-top: 4px;
    }

    .bars {
      display: grid;
      gap: 10px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: minmax(110px, .8fr) minmax(140px, 1.4fr) 44px;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }

    .track {
      height: 9px;
      background: var(--surface-alt);
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid var(--line);
    }

    .bar {
      height: 100%;
      background: var(--ink);
      border-radius: inherit;
    }

    .summary-list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .summary-list li {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }

    .summary-list li:last-child { border-bottom: 0; padding-bottom: 0; }

    .report {
      max-height: 320px;
      overflow: auto;
      margin: 0;
      padding: 12px;
      background: var(--surface-alt);
      border: 1px solid var(--line);
      border-radius: 8px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--ink);
      font-size: 13px;
      line-height: 1.55;
    }
`;
