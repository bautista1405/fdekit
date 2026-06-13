export const foundationStyles = `    :root {
      color-scheme: light;
      --bg: #fafafa;
      --surface: #ffffff;
      --surface-alt: #f6f6f6;
      --ink: #0a0a0a;
      --muted: #707070;
      --line: #e6e6e6;
      --line-strong: #cfcfcf;
      --blue: #0070f3;
      --blue-soft: #edf6ff;
      --teal: #0d9488;
      --teal-soft: #e7f8f6;
      --green: #16a34a;
      --green-soft: #ecfdf3;
      --amber: #b45309;
      --amber-soft: #fff7ed;
      --red: #dc2626;
      --red-soft: #fef2f2;
      --violet: #7c3aed;
      --violet-soft: #f3efff;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    .app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 272px minmax(0, 1fr);
    }

    aside {
      background: var(--surface);
      border-right: 1px solid var(--line);
      padding: 20px 14px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
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

    .page-nav {
      display: grid;
      gap: 4px;
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
    }

    .nav-link:hover {
      background: var(--surface-alt);
      text-decoration: none;
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
      padding: 2px 6px 0;
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

    .pill.pass { background: var(--green-soft); color: var(--green); border-color: #bbf7d0; }
    .pill.fail { background: var(--red-soft); color: var(--red); border-color: #fecaca; }
    .pill.warn { background: var(--amber-soft); color: var(--amber); border-color: #fed7aa; }
    .pill.info { background: var(--blue-soft); color: var(--blue); border-color: #bfdbfe; }

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
    }

    button.export-button:hover {
      border-color: var(--ink);
      color: var(--surface);
      background: var(--ink);
    }`;
