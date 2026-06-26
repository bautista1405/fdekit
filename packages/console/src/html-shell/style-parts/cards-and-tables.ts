export const cardAndTableStyles = `    .handoff {
      display: grid;
      gap: 10px;
    }

    .handoff-row, .story-row, .message-row, .history-row, .evidence-row {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid var(--line);
    }

    .handoff-row:last-child, .story-row:last-child, .message-row:last-child, .history-row:last-child, .evidence-row:last-child {
      border-bottom: 0;
    }

    .row-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 760;
    }

    .row-main {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .story-row {
      grid-template-columns: 34px minmax(0, 1fr);
      align-items: start;
    }

    .step-mark {
      width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      background: var(--surface-alt);
      color: var(--ink);
      font-size: 12px;
      font-weight: 800;
      border: 1px solid var(--line-strong);
    }

    .step-mark.issue,
    .step-mark.slack,
    .step-mark.tool,
    .step-mark.fail {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--surface);
    }

    .step-mark.policy,
    .step-mark.pass {
      background: var(--surface);
      color: var(--ink);
    }

    .step-mark.final,
    .step-mark.warn {
      background: var(--surface-alt);
      color: var(--ink);
    }

    .evidence-row {
      grid-template-columns: 96px minmax(0, 1fr);
      align-items: start;
    }

    .evidence-badge {
      display: inline-flex;
      justify-content: center;
      min-width: 72px;
      padding: 5px 8px;
      border-radius: 6px;
      background: var(--surface-alt);
      color: var(--ink);
      border: 1px solid var(--line-strong);
      font-size: 12px;
      font-weight: 760;
    }

    .mini-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .mini-metric {
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      min-width: 0;
    }

    .mini-metric strong {
      display: block;
      font-size: 18px;
      line-height: 1.1;
      margin-bottom: 3px;
    }

    .review-gates {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .review-gate {
      min-width: 0;
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }

    .review-gate span:first-child {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .review-gate strong {
      font-size: 16px;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .customer-answer .handoff-row {
      padding-top: 0;
    }

    .impact-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .impact-card {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 10px;
    }

    .impact-card.pass { border-color: var(--green-line); background: var(--green-soft); }
    .impact-card.warn { border-color: var(--amber-line); background: var(--amber-soft); }
    .impact-card.fail { border-color: var(--red-line); background: var(--red-soft); }

    .impact-value {
      display: block;
      font-size: 20px;
      font-weight: 800;
      line-height: 1.1;
      margin: 3px 0;
    }

    .impact-card.warn .impact-value { color: var(--amber); }
    .impact-card.fail .impact-value { color: var(--red); }

    .readiness-list {
      display: grid;
      gap: 9px;
    }

    .readiness-item, .workflow-step {
      display: grid;
      grid-template-columns: 86px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }

    .workflow {
      display: grid;
      gap: 9px;
    }

    .workflow-step {
      grid-template-columns: 28px minmax(0, 1fr);
    }

    .control-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    .control-card {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 12px;
    }

    .control-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .control-title {
      font-size: 13px;
      font-weight: 760;
      overflow-wrap: anywhere;
    }

    .trend {
      display: grid;
      gap: 8px;
    }

    .trend-row {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr) 46px;
      gap: 8px;
      align-items: center;
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th {
      text-align: left;
      color: var(--muted);
      font-weight: 720;
      font-size: 12px;
      padding: 9px 8px;
      border-bottom: 1px solid var(--line-strong);
      letter-spacing: .03em;
      text-transform: uppercase;
    }

    td {
      padding: 11px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    tr:last-child td { border-bottom: 0; }

    .status-stack {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
`;
