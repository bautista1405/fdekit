export const reviewStyles = `
.review-file {
  margin-bottom: 26px;
}

.review-file-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 9px;
}

.review-file-name {
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 13px;
  font-weight: 600;
}

.review-file-count {
  font-size: 12px;
  color: var(--muted, #6b6b76);
}

.review-finding {
  border-left: 3px solid #d33;
  background: rgba(221, 51, 51, 0.06);
  border-radius: 0 7px 7px 0;
  padding: 11px 14px;
  margin-bottom: 9px;
}

.review-finding.sev-medium {
  border-left-color: #c47d0a;
  background: rgba(196, 125, 10, 0.08);
}

.review-finding.sev-low {
  border-left-color: #6b6b76;
  background: rgba(107, 107, 118, 0.08);
}

.review-finding-head {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 5px;
}

.review-chip {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid rgba(128, 128, 140, 0.35);
  white-space: nowrap;
}

.review-chip.sev-high {
  background: #d33;
  border-color: #d33;
  color: #fff;
}

.review-chip.sev-medium {
  background: #c47d0a;
  border-color: #c47d0a;
  color: #fff;
}

.review-finding-loc {
  margin-left: auto;
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--muted, #6b6b76);
}

.review-rationale {
  margin: 0 0 5px;
}

.review-suggestion {
  margin: 0 0 5px;
  font-size: 13px;
}

.review-evidence {
  margin: 0;
  padding-left: 17px;
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--muted, #6b6b76);
}

/* The diff renderer ships its own theme; this only frames it.
   overflow-x must scroll rather than hide: a long line has to be reachable,
   and a split diff in a narrow column is otherwise squeezed unreadable. */
.review-diff {
  border: 1px solid rgba(128, 128, 140, 0.28);
  border-radius: 8px;
  overflow-x: auto;
  overflow-y: hidden;
}

/* The console body font is a proportional sans; code must not inherit it.
   Pierre sets this through --diffs-font-fallback on :host, which we rewrite to
   :root when inlining, but pin it here too so the diff can never fall back to
   Inter if that stylesheet changes shape. */
.review-diff pre,
.review-diff code {
  font-family: var(--diffs-font-fallback, ui-monospace, "SF Mono", Monaco, Consolas, "Liberation Mono", monospace);
  font-size: 12.5px;
  line-height: 1.55;
}

/* Print is the one place scrolling is not an option: the console's PDF export
   calls window.print(), and anything past the right edge of a scroll container
   is silently dropped from the output. An evidence document that quietly
   truncates the reviewed code is worse than one with ragged lines, so wrap
   here and only here. */
@media print {
  .review-diff {
    overflow-x: visible;
    border-color: rgba(0, 0, 0, 0.25);
  }

  .review-diff pre,
  .review-diff code,
  .review-diff [data-line] {
    white-space: pre-wrap !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .review-finding {
    break-inside: avoid;
  }

  .review-file {
    break-inside: avoid-page;
  }
}

.empty-note {
  color: var(--muted, #6b6b76);
  font-size: 13px;
  margin: 8px 0 0;
}
`;
