// ---------------------------------------------------------------------------
// SEO Audit — console output and report formatting
// ---------------------------------------------------------------------------

/**
 * Print a compact SEO summary to the console (used by CLI build/deploy).
 * @param {{ score, summary, settings, pages, siteWide }} report
 */
function printSeoSummary(report) {
  const { score, summary } = report;
  const parts = [];
  if (summary.failed > 0) parts.push(`${summary.failed} error${summary.failed > 1 ? 's' : ''}`);
  if (summary.warned > 0) parts.push(`${summary.warned} warning${summary.warned > 1 ? 's' : ''}`);
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  console.log(`  SEO health: ${score}/100${detail}`);

  // Show errors
  const errors = [...report.settings, ...report.pages, ...report.siteWide]
    .filter(c => !c.passed && c.severity === 'error');
  for (const e of errors) {
    console.log(`  \u2717 ${e.message}`);
  }

  // Show warnings only when score is low
  if (score < 70) {
    const warnings = [...report.settings, ...report.pages, ...report.siteWide]
      .filter(c => !c.passed && c.severity === 'warning');
    for (const w of warnings) {
      console.log(`  \u00b7 ${w.message}`);
    }
  }
}

module.exports = { printSeoSummary };
