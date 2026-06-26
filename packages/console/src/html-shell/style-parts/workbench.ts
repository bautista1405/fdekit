export const workbenchStyles = `
    .workbench {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
      gap: 14px;
      align-items: start;
    }

    .detail-stack {
      display: grid;
      gap: 10px;
    }

    details.detail-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    details.detail-panel:hover {
      border-color: var(--line-strong);
    }

    details.detail-panel summary {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 14px;
      cursor: pointer;
      font-weight: 760;
      list-style: none;
      transition: background 160ms ease;
    }

    details.detail-panel summary:hover {
      background: var(--surface-alt);
    }

    details.detail-panel summary:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: -2px;
    }

    details.detail-panel summary::-webkit-details-marker { display: none; }

    details.detail-panel summary::after {
      content: "+";
      width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: var(--surface-alt);
      color: var(--ink);
      font-weight: 800;
      flex: 0 0 auto;
      border: 1px solid var(--line);
      transition: background 160ms ease, color 160ms ease, transform 160ms ease;
    }

    details.detail-panel[open] summary {
      border-bottom: 1px solid var(--line);
    }

    details.detail-panel[open] summary::after {
      content: "-";
      background: var(--ink);
      color: var(--surface);
      transform: rotate(180deg);
    }

    .detail-body {
      padding: 14px;
    }

    .subsection-title {
      margin-top: 16px;
    }

    .subsection-title:first-child {
      margin-top: 0;
    }

    .charts-panel { margin-bottom: 14px; }
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      align-items: stretch;
    }

    .chart-block {
      min-width: 0;
      display: grid;
      align-content: start;
      gap: 10px;
      padding-right: 12px;
      border-right: 1px solid var(--line);
    }

    .chart-block:last-child {
      padding-right: 0;
      border-right: 0;
    }

    .chart-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .donut-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .donut {
      width: 104px;
      height: 104px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: conic-gradient(var(--ink) var(--donut-pass), var(--surface-alt) 0);
      border: 1px solid var(--line);
    }

    .donut::after {
      content: attr(data-label);
      width: 66px;
      height: 66px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--surface);
      color: var(--ink);
      font-weight: 800;
      font-size: 18px;
    }

    .stacked-bar {
      display: flex;
      height: 16px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--surface-alt);
      border: 1px solid var(--line);
    }

    .stacked-segment { min-width: 2px; }
    .stacked-segment.issues { background: var(--ink); }
    .stacked-segment.slack { background: #737373; }
    .stacked-segment.tools { background: #d4d4d4; }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      color: var(--muted);
      font-size: 12px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .legend-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--ink);
    }

    .legend-dot.issues { background: var(--ink); }
    .legend-dot.slack { background: #737373; }
    .legend-dot.tools { background: #d4d4d4; border: 1px solid var(--line-strong); }
    .sparkline {
      width: 100%;
      min-height: 118px;
    }

    .sparkline path, .sparkline polyline {
      fill: none;
      stroke: var(--ink);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .sparkline .baseline {
      stroke: var(--line-strong);
      stroke-width: 1;
    }

    .chart-stat {
      display: grid;
      gap: 4px;
      padding: 8px 0;
    }

    .chart-stat strong {
      font-size: 26px;
      font-weight: 780;
      line-height: 1.1;
    }

    .ops-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: 18px;
      margin-top: 14px;
      align-items: start;
    }

    .bar-label {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
    }

    .bar-label .mono { overflow-wrap: anywhere; }

    .bar-sub {
      color: var(--muted);
      font-size: 12px;
      flex: 0 0 auto;
    }
`;
