#!/usr/bin/env node

/**
 * Authentication Example
 *
 * This example demonstrates how to use the Comparator with authentication
 * for comparing websites that require login credentials.
 */

const Comparator = require('../comparator.js');

async function authenticatedComparison() {
    console.log('🔐 Starting authenticated website comparison...\n');

    // Create a new comparator instance
    const comparator = new Comparator({
        maxPages: 15,
        delay: 2000,            // Longer delay for authenticated sites
        timeout: 45000,         // Longer timeout for complex pages
        outputDir: './auth-results'
    });

    try {
        // Compare websites with authentication
        await comparator.compare(
            'https://staging.example.com',
            'https://example.com',
            {
                site1: {
                    username: 'staging_user',
                    password: 'staging_pass'
                },
                site2: {
                    username: 'prod_user',
                    password: 'prod_pass'
                }
            }
        );

        console.log('\n✅ Authenticated comparison completed successfully!');
        console.log('📁 Check the ./auth-results directory for detailed reports.');

    } catch (error) {
        console.error('❌ Authenticated comparison failed:', error.message);
        process.exit(1);
    }
}

// Alternative: Using environment variables
async function authenticatedComparisonWithEnv() {
    console.log('🔐 Starting authenticated comparison using environment variables...\n');

    // Set environment variables (in real usage, these would be set externally)
    process.env.COMPARATOR_USERNAME = 'myuser';
    process.env.COMPARATOR_PASSWORD = 'mypass';

    const comparator = new Comparator({
        maxPages: 10,
        outputDir: './env-auth-results'
    });

    try {
        // The tool will automatically use environment variables for authentication
        await comparator.compare(
            'https://staging.example.com',
            'https://example.com'
        );

        console.log('\n✅ Environment-based authentication completed successfully!');
        console.log('📁 Check the ./env-auth-results directory for detailed reports.');

    } catch (error) {
        console.error('❌ Environment-based authentication failed:', error.message);
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--env')) {
        authenticatedComparisonWithEnv().catch(console.error);
    } else {
        authenticatedComparison().catch(console.error);
    }
}

module.exports = { authenticatedComparison, authenticatedComparisonWithEnv };
