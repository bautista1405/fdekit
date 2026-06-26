export const overviewStyles = `
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
    .kpi-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .kpi .label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .kpi-head .pill {
      height: 22px;
      padding: 0 8px;
      font-size: 11px;
      flex: 0 0 auto;
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
