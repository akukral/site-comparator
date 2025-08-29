#!/usr/bin/env node

/**
 * CI/CD Integration Example
 *
 * This example demonstrates how to integrate the Comparator into
 * continuous integration and deployment workflows.
 */

const Comparator = require('../comparator.js');
const fs = require('fs').promises;
const path = require('path');

async function ciCdComparison() {
    console.log('🔄 Starting CI/CD website comparison...\n');

    // CI/CD specific configuration
    const comparator = new Comparator({
        maxPages: 20,           // Reasonable limit for CI/CD
        delay: 1000,            // Faster for automation
        timeout: 30000,         // Standard timeout
        outputDir: './ci-results'
    });

    try {
        // Get URLs from environment variables (common in CI/CD)
        const stagingUrl = process.env.STAGING_URL || 'https://staging.example.com';
        const productionUrl = process.env.PRODUCTION_URL || 'https://example.com';

        console.log(`📊 Comparing ${stagingUrl} vs ${productionUrl}`);

        // Compare websites
        await comparator.compare(stagingUrl, productionUrl);

        // Read the results for CI/CD decision making
        const resultsDir = './ci-results';
        const files = await fs.readdir(resultsDir);
        const jsonFile = files.find(f => f.startsWith('results-') && f.endsWith('.json'));

        if (jsonFile) {
            const resultsPath = path.join(resultsDir, jsonFile);
            const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));

            // CI/CD decision logic
            const totalPages = results.summary.totalCompared;
            const pagesWithDifferences = results.summary.pagesWithDifferences;
            const errorCount = results.summary.errors;

            console.log('\n📈 CI/CD Analysis Results:');
            console.log(`   Total pages compared: ${totalPages}`);
            console.log(`   Pages with differences: ${pagesWithDifferences}`);
            console.log(`   Errors encountered: ${errorCount}`);

            // Example CI/CD decision criteria
            const maxAllowedDifferences = parseInt(process.env.MAX_DIFFERENCES || '5');
            const maxAllowedErrors = parseInt(process.env.MAX_ERRORS || '2');

            if (errorCount > maxAllowedErrors) {
                console.error(`❌ CI/CD FAILED: Too many errors (${errorCount} > ${maxAllowedErrors})`);
                process.exit(1);
            }

            if (pagesWithDifferences > maxAllowedDifferences) {
                console.error(`❌ CI/CD FAILED: Too many differences (${pagesWithDifferences} > ${maxAllowedDifferences})`);
                process.exit(1);
            }

            if (pagesWithDifferences === 0) {
                console.log('✅ CI/CD PASSED: No differences found');
            } else {
                console.log(`⚠️  CI/CD PASSED: ${pagesWithDifferences} differences found (within acceptable limits)`);
            }

            // Generate summary for CI/CD reporting
            const summary = {
                status: pagesWithDifferences <= maxAllowedDifferences && errorCount <= maxAllowedErrors ? 'PASS' : 'FAIL',
                totalPages,
                pagesWithDifferences,
                errorCount,
                maxAllowedDifferences,
                maxAllowedErrors,
                timestamp: new Date().toISOString()
            };

            await fs.writeFile(
                path.join(resultsDir, 'ci-summary.json'),
                JSON.stringify(summary, null, 2)
            );

            console.log('📁 CI/CD summary saved to ci-results/ci-summary.json');

        } else {
            console.error('❌ No results file found');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ CI/CD comparison failed:', error.message);
        process.exit(1);
    }
}

// Alternative: Quick health check comparison
async function healthCheckComparison() {
    console.log('🏥 Starting health check comparison...\n');

    const comparator = new Comparator({
        maxPages: 5,            // Very limited for health checks
        delay: 500,             // Fast health check
        timeout: 15000,         // Shorter timeout
        outputDir: './health-check-results'
    });

    try {
        const stagingUrl = process.env.STAGING_URL || 'https://staging.example.com';
        const productionUrl = process.env.PRODUCTION_URL || 'https://example.com';

        await comparator.compare(stagingUrl, productionUrl);

        console.log('✅ Health check completed successfully');

    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--health-check')) {
        healthCheckComparison().catch(console.error);
    } else {
        ciCdComparison().catch(console.error);
    }
}

module.exports = { ciCdComparison, healthCheckComparison };
