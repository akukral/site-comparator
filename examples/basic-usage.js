#!/usr/bin/env node

/**
 * Basic Usage Example
 *
 * This example demonstrates how to use the Comparator programmatically
 * to compare two websites and handle the results.
 */

const Comparator = require('../comparator.js');

async function basicComparison() {
    console.log('🚀 Starting basic website comparison...\n');

    // Create a new comparator instance with custom options
    const comparator = new Comparator({
        maxPages: 10,           // Limit to 10 pages for this example
        delay: 1500,            // 1.5 second delay between requests
        timeout: 30000,         // 30 second timeout
        outputDir: './example-results'
    });

    try {
        // Compare two websites
        await comparator.compare(
            'https://staging.example.com',
            'https://example.com'
        );

        console.log('\n✅ Comparison completed successfully!');
        console.log('📁 Check the ./example-results directory for detailed reports.');

    } catch (error) {
        console.error('❌ Comparison failed:', error.message);
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    basicComparison().catch(console.error);
}

module.exports = basicComparison;
