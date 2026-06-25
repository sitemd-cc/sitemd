#!/usr/bin/env node

const path = require('path');

/**
 * Standalone build — produces full HTML output to disk.
 * Requires authentication + API verification (no offline builds).
 * This is the "escape hatch" for users deploying to unsupported hosting.
 */
async function runBuild(root) {
  const { getToken } = require('../cli/auth-store');
  const { activateSite, verifySite } = require('../deploy/activate');
  const { extractSiteFingerprint, loadSiteReceipt, writeSiteReceipt } = require('./site-identity');

  // Step 1: Check auth
  const token = getToken();
  if (!token) {
    console.log('');
    console.log('  Not authenticated. Run: sitemd auth login');
    console.log('');
    process.exit(1);
  }

  const { checkDependencies, printDependencyWarning } = require('./deps');
  printDependencyWarning(checkDependencies(root));
  const { syncThemeToCSS } = require('./css');
  const { build } = require('./render');

  // Step 2: Build to memory first (trial mode renders to memory)
  syncThemeToCSS(root);
  const result = build(root);
  const memoryOutput = result.config._memoryOutput || new Map();

  // Step 3: Extract fingerprint from rendered output
  const fingerprint = extractSiteFingerprint(result.config, memoryOutput);

  // Step 4: Check local receipt and activate/verify via API
  const receipt = loadSiteReceipt(root);

  if (!receipt.activated) {
    // Activation ceremony
    if (!result.config.domain) {
      console.error('✗ Set the url field in settings/meta.md before building for production');
      process.exit(1);
    }

    console.log(`  Site identity:  title='${fingerprint.title}'  brand='${fingerprint.brandName}'  domain='${fingerprint.domain}'`);
    console.log();

    if (process.stdin.isTTY) {
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => {
        rl.question('  This site identity will be activated to your sitemd account and consume 1 site slot.\n  Site activations are permanent — this cannot be undone, credited, or refunded.\n  Continue? (y/N) ', resolve);
      });
      rl.close();
      if (answer.toLowerCase() !== 'y') {
        console.log('  Cancelled.');
        process.exit(0);
      }
    }

    try {
      const activationResult = await activateSite(token, fingerprint);
      writeSiteReceipt(root, activationResult);
      console.log('✓ Site activated');
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  } else {
    // Verify existing activation
    try {
      const verifyResult = await verifySite(token, fingerprint);
      if (verifyResult.verified) {
        console.log('✓ Site verified');
      } else {
        const details = verifyResult.details ? verifyResult.details.join('; ') : verifyResult.reason;
        console.error(`✗ Site identity changed since activation. ${details}`);
        console.error('  Contact support@sitemd.cc if you need to update your site identity.');
        process.exit(1);
      }
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  }

  // Step 5: Re-build in activated mode (now that receipt exists, config._mode will be 'activated')
  syncThemeToCSS(root);
  const finalResult = build(root);

  // Step 5.5: SEO health check
  try {
    const { runSeoAudit, printSeoSummary } = require('../seo/audit');
    printSeoSummary(runSeoAudit(root));
  } catch (e) { /* audit is non-blocking */ }

  // Step 6: Async post-build (favicons, OG images, image optimization, card images)
  (async () => {
    try {
      const distDir = path.join(root, finalResult.config.outputDir);
      const { requireWithExtraPaths } = require('./modules');

      // Favicons
      const { generateFavicons } = require('./favicon');
      const { hasFavicon, isSvg } = await generateFavicons(finalResult.config, root, distDir);
      if (hasFavicon) finalResult.config._hasFavicon = true;
      if (isSvg) finalResult.config._faviconSvg = true;

      // OG images
      const og = requireWithExtraPaths(require.resolve('../seo/og'));
      og.checkDependencies();
      if (finalResult.config.ogImage === 'auto') {
        await og.generateOgImages(finalResult.pages, finalResult.config, distDir, root);
      }

      // Image optimization (resize, compress, WebP) + dimension injection
      const { optimizeImages, injectImageDimensions } = requireWithExtraPaths(require.resolve('./premium/images'));
      await optimizeImages(distDir, finalResult.config);
      await injectImageDimensions(distDir);

      // Media hosting — sync to CDN and rewrite URLs
      const { syncMedia } = require('./premium/hosting');
      await syncMedia(distDir, finalResult.config);

      // Card auto-images
      const { getPendingCardImages, clearPendingCardImages } = require('./parse');
      const pending = getPendingCardImages();
      if (pending.length > 0) {
        const { generateCardImages } = require('./card-images');
        await generateCardImages(pending, root);
        clearPendingCardImages();
      }
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        console.log('  SEO images: ' + e.message);
      }
    }
  })();
}

function runServe(root) {
  const { serve } = require('./server');
  serve(root);
}

module.exports = { runBuild, runServe };

if (require.main === module) {
  const ROOT = process.env.SITEMD_PROJECT_ROOT || path.resolve(__dirname, '../..');
  const args = process.argv.slice(2);

  if (args.includes('--serve')) {
    runServe(ROOT);
  } else {
    runBuild(ROOT);
  }
}
