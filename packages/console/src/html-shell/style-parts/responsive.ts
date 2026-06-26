export const responsiveStyles = `    @media (max-width: 1120px) {
      .app { grid-template-columns: 1fr; }
      aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      .page-nav { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .sidebar-review { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .sidebar-review-row { grid-template-columns: 1fr; }
      .sidebar-review-row strong { justify-self: start; text-align: left; }
      .story-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .nav-group { display: inline-block; min-width: 180px; margin-right: 20px; vertical-align: top; }
      .signal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .control-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .section-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .review-gates { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .layout, .brief-grid, .workbench { grid-template-columns: 1fr; }
      .chart-grid { grid-template-columns: 1fr; }
      .chart-block { padding-right: 0; border-right: 0; border-bottom: 1px solid var(--line); padding-bottom: 14px; }
      .chart-block:last-child { border-bottom: 0; padding-bottom: 0; }
      .ops-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
      main { padding: 16px; }
      aside { padding: 16px 10px; }
      .page-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .nav-link { padding: 10px; }
      .nav-link small { display: none; }
      .sidebar-meta { display: none; }
      .topbar { display: block; }
      .topbar-actions { justify-items: start; margin-top: 12px; }
      .export-actions { justify-content: flex-start; }
      h1 { font-size: 23px; }
      .section-titlebar { display: block; }
      .section-titlebar .pill { margin-top: 8px; }
      .sidebar-review { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .story-strip { grid-template-columns: 1fr; }
      .signal-grid, .mini-metrics { grid-template-columns: 1fr; }
      .impact-grid { grid-template-columns: 1fr; }
      .control-grid { grid-template-columns: 1fr; }
      .kpis { grid-template-columns: 1fr; }
      .section-cards { grid-template-columns: 1fr; }
      .review-gates { grid-template-columns: 1fr; }
      .event, .handoff-row, .message-row, .history-row, .evidence-row { grid-template-columns: 1fr; }
      .bar-row { grid-template-columns: 1fr 1fr 34px; }
    }

    @media print {
      body { background: #fff; }
      .app { display: block; }
      aside, .export-actions { display: none; }
      main { padding: 0; }
      .panel, .kpi { box-shadow: none; break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
`;
