export const foundationStyles = `    :root {
      color-scheme: light;
      --bg: #fafafa;
      --surface: #ffffff;
      --surface-alt: #f6f6f6;
      --surface-hover: #f1f1f1;
      --ink: #0a0a0a;
      --ink-soft: #262626;
      --muted: #707070;
      --line: #e6e6e6;
      --line-strong: #cfcfcf;
      --blue: #111111;
      --blue-soft: #f5f5f5;
      --teal: #404040;
      --teal-soft: #f5f5f5;
      --green: #111111;
      --green-soft: #f7f7f7;
      --amber: #525252;
      --amber-soft: #f4f4f5;
      --red: #111111;
      --red-soft: #ededed;
      --violet: #2f2f2f;
      --violet-soft: #f5f5f5;
      --shadow: 0 1px 1px rgba(0, 0, 0, 0.03), 0 8px 24px rgba(0, 0, 0, 0.04);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 284px minmax(0, 1fr);
    }

    aside {
      background: var(--surface);
      border-right: 1px solid var(--line);
      padding: 18px 12px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
    }

    .skip-link {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 20;
      transform: translateY(-160%);
      border: 1px solid var(--ink);
      border-radius: 6px;
      background: var(--ink);
      color: var(--surface);
      padding: 8px 10px;
      font-size: 13px;
      transition: transform 160ms ease;
    }

    .skip-link:focus {
      transform: translateY(0);
      outline: none;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 780;
      font-size: 15px;
      letter-spacing: 0;
      margin: 0 6px 18px;
    }

    .brand-mark {
      width: 26px;
      height: 26px;
      display: inline-grid;
      place-items: center;
      border-radius: 6px;
      background: var(--ink);
      color: var(--surface);
      font-size: 13px;
      line-height: 1;
    }

    .sidebar-review {
      display: grid;
      gap: 1px;
      margin: 0 6px 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--line);
    }

    .sidebar-review-row {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(62px, .7fr) minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 9px 10px;
      background: var(--surface);
    }

    .sidebar-review-row span {
      color: var(--muted);
      font-size: 11px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .sidebar-review-row strong {
      min-width: 0;
      justify-self: end;
      color: var(--ink);
      font-size: 13px;
      font-weight: 720;
      overflow-wrap: anywhere;
      text-align: right;
    }

    .sidebar-review-row .pill {
      height: 24px;
      padding: 0 8px;
      font-size: 11px;
    }

    .page-nav {
      display: grid;
      gap: 5px;
      margin-bottom: 18px;
    }

    .nav-link {
      display: grid;
      gap: 3px;
      padding: 10px 11px;
      border-radius: 8px;
      color: var(--ink);
      text-decoration: none;
      border: 1px solid transparent;
      transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
    }

    .nav-link:hover {
      background: var(--surface-hover);
      text-decoration: none;
    }

    .nav-link:focus-visible,
    button.export-button:focus-visible,
    .section-card:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }

    .nav-link.active {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--surface);
    }

    .nav-link span {
      font-size: 14px;
      font-weight: 720;
    }

    .nav-link small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }

    .nav-link.active small {
      color: #d4d4d4;
    }

    .sidebar-meta {
      border-top: 1px solid var(--line);
      padding: 2px 6px 18px;
    }

    .nav-group { margin-top: 20px; }
    .nav-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 8px;
      font-weight: 720;
    }

    .nav-value {
      display: block;
      color: var(--ink);
      padding: 7px 0;
      border-bottom: 1px solid var(--line);
      overflow-wrap: anywhere;
      font-size: 13px;
    }

    main {
      min-width: 0;
      width: min(100%, 1420px);
      padding: 30px;
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--line);
    }

    h1, h2, h3, p { margin-top: 0; }
    h1 {
      margin-bottom: 6px;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    h2 {
      font-size: 16px;
      margin-bottom: 14px;
      letter-spacing: 0;
    }

    h3 {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 8px;
    }

    .subtle { color: var(--muted); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .right { text-align: right; }
    a { color: var(--ink); text-decoration: none; font-weight: 620; }
    a:hover { text-decoration: underline; }

    .page-kicker {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .page-heading p {
      margin: 0;
      max-width: 720px;
      font-size: 14px;
    }

    .page-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .page-meta span {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 9px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
      font-size: 12px;
      font-weight: 660;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
      font-weight: 680;
    }

    .pill.pass { background: var(--ink); color: var(--surface); border-color: var(--ink); }
    .pill.fail { background: var(--surface); color: var(--ink); border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
    .pill.warn { background: var(--surface-alt); color: var(--ink); border-color: var(--line-strong); }
    .pill.info { background: var(--surface-alt); color: var(--ink); border-color: var(--line); }

    .topbar-actions {
      display: grid;
      justify-items: end;
      gap: 10px;
    }

    .export-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    button.export-button {
      border: 1px solid var(--line-strong);
      background: var(--surface);
      color: var(--ink);
      height: 32px;
      padding: 0 11px;
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
      font-weight: 680;
      cursor: pointer;
      transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
    }

    button.export-button:hover {
      border-color: var(--ink);
      color: var(--surface);
      background: var(--ink);
      transform: translateY(-1px);
    }`;
