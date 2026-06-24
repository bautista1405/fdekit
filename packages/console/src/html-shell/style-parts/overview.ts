export const overviewStyles = `
    .story-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin-bottom: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--line);
      box-shadow: var(--shadow);
    }

    .story-step {
      min-width: 0;
      display: grid;
      align-content: start;
      gap: 5px;
      min-height: 104px;
      padding: 14px;
      background: var(--surface);
    }

    .story-step span {
      color: var(--muted);
      font-size: 11px;
      font-weight: 780;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .story-step strong {
      color: var(--ink);
      font-size: 18px;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .story-step small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .kpi, .panel, .demo-hero {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }

    .kpi { padding: 15px; min-height: 104px; }
    .kpi .label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .kpi .value { font-size: 25px; font-weight: 780; letter-spacing: 0; }
    .kpi .note { color: var(--muted); font-size: 12px; margin-top: 5px; overflow-wrap: anywhere; }

    .demo-hero {
      padding: 18px;
      margin-bottom: 16px;
    }

    .hero-copy {
      display: grid;
      align-content: start;
      gap: 10px;
      min-width: 0;
    }

    .hero-kicker {
      color: var(--muted);
      font-size: 12px;
      font-weight: 780;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .hero-title {
      margin: 0;
      font-size: 21px;
      line-height: 1.18;
      letter-spacing: 0;
    }

    .hero-copy p {
      margin: 0;
      color: var(--muted);
      max-width: 780px;
    }

    .signal-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      margin-top: 2px;
    }

    .signal {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--surface-alt);
    }

    .signal.pass { border-color: var(--line-strong); background: var(--surface); }
    .signal.warn { border-color: var(--line-strong); background: var(--surface-alt); }
    .signal.fail { border-color: var(--ink); background: var(--ink); color: var(--surface); }

    .signal-title {
      font-weight: 760;
      font-size: 13px;
      margin-bottom: 3px;
    }

    .signal-detail {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .signal.fail .signal-detail {
      color: #d4d4d4;
    }

    .section-cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .section-card {
      min-height: 128px;
      display: grid;
      align-content: space-between;
      gap: 18px;
      padding: 15px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow);
      transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }

    .section-card:hover {
      border-color: var(--ink);
      text-decoration: none;
      transform: translateY(-1px);
    }

    .section-card span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .section-card strong {
      font-size: 15px;
      line-height: 1.35;
      font-weight: 680;
    }

    .section-card small {
      color: var(--muted);
      font-size: 12px;
      font-weight: 680;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
      gap: 12px;
      align-items: start;
    }

    .panel { padding: 16px; }
    .panel + .panel { margin-top: 12px; }

    .section-titlebar {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 14px;
      margin: 0 0 12px;
    }

    .section-titlebar h2 {
      margin-bottom: 3px;
      font-size: 18px;
    }

    .section-titlebar p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }

    .brief-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(280px, .82fr);
      gap: 14px;
      align-items: stretch;
      margin-bottom: 14px;
    }

    .compact-panel {
      min-width: 0;
      min-height: 100%;
    }

    .section-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .section-head h2 { margin-bottom: 0; }

    .section-note {
      color: var(--muted);
      font-size: 12px;
      margin-top: 3px;
    }`;
