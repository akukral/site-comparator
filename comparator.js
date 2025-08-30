#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { URL } = require('url');
const readline = require('readline');
const readlineSync = require('readline-sync');

class Comparator {
    constructor(options = {}) {
        this.options = {
            maxPages: 20,
            maxDiscovery: 500,
            delay: 1000,
            timeout: 30000,
            ignoreElements: ['script', 'noscript', 'style'],
            ignoreAttributes: ['data-csrf', 'csrf-token', '_token', 'nonce'],
            ignoreClasses: ['timestamp', 'csrf', 'nonce', 'random'],
            userAgent: 'Comparator Bot 1.2.1',
            outputDir: './comparator-results',
            ...options
        };

        this.visited = new Set();
        this.results = {
            compared: 0,
            differences: [],
            errors: [],
            summary: {}
        };
    }

    // Helper method for waiting - compatible with all Puppeteer versions
    async waitFor(page, milliseconds) {
        if (typeof page.waitForTimeout === 'function') {
            // Older Puppeteer versions
            return await page.waitForTimeout(milliseconds);
        } else {
            // Newer Puppeteer versions - use setTimeout
            return new Promise(resolve => setTimeout(resolve, milliseconds));
        }
    }

    async init() {
        // Create output directory
        await fs.mkdir(this.options.outputDir, { recursive: true });

        // Launch browser with better compatibility options
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors'
            ]
        });
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    // Get authentication credentials if needed
    async getAuthCredentials(domain, options = {}) {
        // Check if credentials were provided via command line or environment
        if (options.username && options.password) {
            return { username: options.username, password: options.password };
        }

        // Check environment variables
        const envUsername = process.env[`COMPARATOR_USER_${this.getDomainKey(domain)}`] || process.env.COMPARATOR_USERNAME;
        const envPassword = process.env[`COMPARATOR_PASS_${this.getDomainKey(domain)}`] || process.env.COMPARATOR_PASSWORD;

        if (envUsername && envPassword) {
            console.log(`Using credentials from environment for ${domain}`);
            return { username: envUsername, password: envPassword };
        }



        return new Promise((resolve) => {
            console.log(`\nHTTP Authentication may be required for ${domain}`);

            // Use readline-sync for username input
            const username = readlineSync.question('Username (press enter to skip): ');

            if (!username.trim()) {
                resolve(null);
                return;
            }

            // Use readline-sync's built-in password hiding - completely invisible keystrokes
            const password = readlineSync.question('Password: ', {
                hideEchoBack: true,  // This completely hides all keystrokes
                mask: ''             // No mask character shown
            });

            resolve({ username: username.trim(), password: password });
        });
    }

    // Helper to create environment variable key from domain
    getDomainKey(domain) {
        return new URL(domain).hostname.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    }

    // Create a new page with authentication if needed
    async createPage(auth = null) {
        const page = await this.browser.newPage();

        await page.setUserAgent(this.options.userAgent);
        await page.setViewport({ width: 1920, height: 1080 });

        // Set basic auth if provided
        if (auth) {
            await page.authenticate(auth);
        }

        // Handle authentication challenges
        page.on('response', async (response) => {
            if (response.status() === 401 && auth) {
                console.log(`Authentication challenge detected for ${response.url()}`);
            }
        });

        return page;
    }

    // Normalize content by removing spurious differences
    normalizeContent(html, baseUrl, targetUrl) {
        const $ = cheerio.load(html);

        // Remove ignored elements
        this.options.ignoreElements.forEach(selector => {
            $(selector).remove();
        });

        // Remove ignored attributes
        $('*').each((i, elem) => {
            const $elem = $(elem);
            this.options.ignoreAttributes.forEach(attr => {
                $elem.removeAttr(attr);
            });

            // Remove ignored classes
            const classes = $elem.attr('class');
            if (classes) {
                const filteredClasses = classes
                    .split(' ')
                    .filter(cls => !this.options.ignoreClasses.some(ignore => cls.includes(ignore)))
                    .join(' ');

                if (filteredClasses) {
                    $elem.attr('class', filteredClasses);
                } else {
                    $elem.removeAttr('class');
                }
            }
        });

        // Normalize URLs - replace baseUrl with targetUrl in links and sources
        $('a[href], img[src], link[href], script[src]').each((i, elem) => {
            const $elem = $(elem);
            const attrName = $elem.attr('href') ? 'href' : 'src';
            const url = $elem.attr(attrName);

            if (url && url.includes(baseUrl)) {
                $elem.attr(attrName, url.replace(baseUrl, targetUrl));
            }
        });

        // Remove comments
        $('*').contents().filter(function() {
            return this.type === 'comment';
        }).remove();

        // Normalize whitespace
        return $.html()
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .trim();
    }

    // Extract content for comparison
    extractContent(html) {
        const $ = cheerio.load(html);

        return {
            title: $('title').text().trim(),
            headings: $('h1, h2, h3, h4, h5, h6').map((i, el) => $(el).text().trim()).get(),
            paragraphs: $('p').map((i, el) => $(el).text().trim()).get().filter(p => p.length > 0),
            links: $('a[href]').map((i, el) => ({
                text: $(el).text().trim(),
                href: $(el).attr('href')
            })).get(),
            images: $('img[src]').map((i, el) => ({
                alt: $(el).attr('alt') || '',
                src: $(el).attr('src')
            })).get(),
            forms: $('form').map((i, el) => ({
                action: $(el).attr('action') || '',
                method: $(el).attr('method') || 'GET',
                inputs: $(el).find('input, textarea, select').map((j, input) => ({
                    name: $(input).attr('name') || '',
                    type: $(input).attr('type') || 'text'
                })).get()
            })).get()
        };
    }

    // Compare two pages
    comparePage(url, content1, content2, domain1, domain2) {
        const normalized1 = this.normalizeContent(content1, domain1, domain2);
        const normalized2 = this.normalizeContent(content2, domain2, domain1);

        const extracted1 = this.extractContent(normalized1);
        const extracted2 = this.extractContent(normalized2);

        const differences = [];

        // Compare titles
        if (extracted1.title !== extracted2.title) {
            differences.push({
                type: 'title',
                site1: extracted1.title,
                site2: extracted2.title,
                snippet: this.getSnippet(extracted1.title, extracted2.title)
            });
        }

        // Compare headings with detailed analysis
        const headingDiff = this.compareHeadings(extracted1.headings, extracted2.headings);
        if (headingDiff.hasDifferences) {
            differences.push({
                type: 'headings',
                site1: extracted1.headings.length,
                site2: extracted2.headings.length,
                details: headingDiff.details,
                snippets: headingDiff.snippets
            });
        }

        // Compare paragraphs with content analysis
        const paragraphDiff = this.compareParagraphs(extracted1.paragraphs, extracted2.paragraphs);
        if (paragraphDiff.hasDifferences) {
            differences.push({
                type: 'paragraphs',
                site1: extracted1.paragraphs.length,
                site2: extracted2.paragraphs.length,
                details: paragraphDiff.details,
                snippets: paragraphDiff.snippets
            });
        }

        // Compare links with detailed analysis
        const linkDiff = this.compareLinks(extracted1.links, extracted2.links);
        if (linkDiff.hasDifferences) {
            differences.push({
                type: 'links',
                site1: extracted1.links.length,
                site2: extracted2.links.length,
                details: linkDiff.details,
                snippets: linkDiff.snippets
            });
        }

        // Compare images
        const imageDiff = this.compareImages(extracted1.images, extracted2.images);
        if (imageDiff.hasDifferences) {
            differences.push({
                type: 'images',
                site1: extracted1.images.length,
                site2: extracted2.images.length,
                details: imageDiff.details,
                snippets: imageDiff.snippets
            });
        }

        // Compare forms
        const formDiff = this.compareForms(extracted1.forms, extracted2.forms);
        if (formDiff.hasDifferences) {
            differences.push({
                type: 'forms',
                site1: extracted1.forms.length,
                site2: extracted2.forms.length,
                details: formDiff.details,
                snippets: formDiff.snippets
            });
        }

        return {
            url,
            hasDifferences: differences.length > 0,
            differences,
            extracted1,
            extracted2
        };
    }

        // Helper method to create snippets for differences
    getSnippet(text1, text2, maxLength = 100) {
        const truncate = (text) => {
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength) + '...';
        };

        return {
            site1: truncate(text1),
            site2: truncate(text2)
        };
    }

    // Intelligent content difference detection that accounts for offsets
    findContentDifferences(array1, array2, contentType = 'content') {
        const differences = [];
        const additions = [];
        const deletions = [];

        // Normalize arrays for comparison
        const normalized1 = array1.map(item => this.normalizeForComparison(item));
        const normalized2 = array2.map(item => this.normalizeForComparison(item));

        // Find the longest common subsequence to identify reordering
        const lcs = this.findLongestCommonSubsequence(normalized1, normalized2);

        // Create maps for efficient lookup
        const map1 = new Map();
        const map2 = new Map();

        // Build maps with normalized content as key and original items as values
        array1.forEach((item, index) => {
            const key = normalized1[index];
            if (!map1.has(key)) {
                map1.set(key, []);
            }
            map1.get(key).push(item);
        });

        array2.forEach((item, index) => {
            const key = normalized2[index];
            if (!map2.has(key)) {
                map2.set(key, []);
            }
            map2.get(key).push(item);
        });

        // Find items that exist in both arrays (matches)
        const matches = new Set();
        for (const [key] of map1) {
            if (map2.has(key)) {
                matches.add(key);
            }
        }

        // Find additions (items only in array2)
        for (const [key, items2] of map2) {
            if (!matches.has(key)) {
                additions.push({
                    type: 'addition',
                    contentType,
                    items: items2,
                    count: items2.length,
                    snippet: this.getSnippet('', items2[0], 150)
                });
            }
        }

        // Find deletions (items only in array1)
        for (const [key, items1] of map1) {
            if (!matches.has(key)) {
                deletions.push({
                    type: 'deletion',
                    contentType,
                    items: items1,
                    count: items1.length,
                    snippet: this.getSnippet(items1[0], '', 150)
                });
            }
        }

        // Check for reordering (items that exist in both but in different positions)
        if (lcs.length < Math.min(normalized1.length, normalized2.length)) {
            const reorderedCount = Math.min(normalized1.length, normalized2.length) - lcs.length;
            if (reorderedCount > 0) {
                differences.push({
                    type: 'reordering',
                    contentType,
                    count: reorderedCount,
                    description: `${reorderedCount} ${contentType}s appear to be reordered`
                });
            }
        }

        return {
            differences: differences,
            additions: additions,
            deletions: deletions,
            matches: matches.size,
            reordered: lcs.length < Math.min(normalized1.length, normalized2.length)
        };
    }

    // Find longest common subsequence to detect reordering
    findLongestCommonSubsequence(arr1, arr2) {
        const m = arr1.length;
        const n = arr2.length;
        const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

        // Build LCS matrix
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (arr1[i - 1] === arr2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // Reconstruct the LCS
        const lcs = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (arr1[i - 1] === arr2[j - 1]) {
                lcs.unshift(arr1[i - 1]);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        return lcs;
    }

    // Normalize content for comparison (remove extra whitespace, etc.)
    normalizeForComparison(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        return text
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

        // Compare headings with detailed analysis
    compareHeadings(headings1, headings2) {
        const details = [];
        const snippets = [];

        if (headings1.length !== headings2.length) {
            details.push(`Different number of headings: ${headings1.length} vs ${headings2.length}`);
        }

        // Use intelligent matching to find actual differences, not just position shifts
        const { differences, additions, deletions, reordered } = this.findContentDifferences(headings1, headings2, 'heading');

        if (differences.length > 0) {
            details.push(`${differences.length} headings have different content`);
            snippets.push(...differences.slice(0, 3));
        }

        if (additions.length > 0) {
            details.push(`${additions.length} headings added`);
            snippets.push(...additions.slice(0, 2));
        }

        if (deletions.length > 0) {
            details.push(`${deletions.length} headings removed`);
            snippets.push(...deletions.slice(0, 2));
        }

        if (reordered) {
            details.push(`Headings appear to be reordered`);
        }

        return {
            hasDifferences: details.length > 0,
            details,
            snippets: snippets.slice(0, 5) // Limit to first 5 differences
        };
    }

        // Compare paragraphs with content analysis
    compareParagraphs(paragraphs1, paragraphs2) {
        const details = [];
        const snippets = [];

        if (paragraphs1.length !== paragraphs2.length) {
            details.push(`Different number of paragraphs: ${paragraphs1.length} vs ${paragraphs2.length}`);
        }

        // Use intelligent matching to find actual differences, not just position shifts
        const { differences, additions, deletions, reordered } = this.findContentDifferences(paragraphs1, paragraphs2, 'paragraph');

        if (differences.length > 0) {
            details.push(`${differences.length} paragraphs have different content`);
            snippets.push(...differences.slice(0, 3));
        }

        if (additions.length > 0) {
            details.push(`${additions.length} paragraphs added`);
            snippets.push(...additions.slice(0, 2));
        }

        if (deletions.length > 0) {
            details.push(`${deletions.length} paragraphs removed`);
            snippets.push(...deletions.slice(0, 2));
        }

        if (reordered) {
            details.push(`Paragraphs appear to be reordered`);
        }

        return {
            hasDifferences: details.length > 0,
            details,
            snippets: snippets.slice(0, 3) // Limit to first 3 differences
        };
    }

        // Compare links with detailed analysis
    compareLinks(links1, links2) {
        const details = [];
        const snippets = [];

        if (links1.length !== links2.length) {
            details.push(`Different number of links: ${links1.length} vs ${links2.length}`);
        }

        // Extract link texts for comparison
        const texts1 = links1.map(l => l.text).filter(t => t.length > 0);
        const texts2 = links2.map(l => l.text).filter(t => t.length > 0);

        // Use intelligent matching to find actual differences
        const { differences, additions, deletions, reordered } = this.findContentDifferences(texts1, texts2, 'link');

        if (differences.length > 0) {
            details.push(`${differences.length} links have different text`);
            snippets.push(...differences.slice(0, 3));
        }

        if (additions.length > 0) {
            details.push(`${additions.length} links added`);
            snippets.push(...additions.slice(0, 2));
        }

        if (deletions.length > 0) {
            details.push(`${deletions.length} links removed`);
            snippets.push(...deletions.slice(0, 2));
        }

        if (reordered) {
            details.push(`Links appear to be reordered`);
        }

        return {
            hasDifferences: details.length > 0,
            details,
            snippets
        };
    }

    // Compare images with detailed analysis
    compareImages(images1, images2) {
        const details = [];
        const snippets = [];

        if (images1.length !== images2.length) {
            details.push(`Different number of images: ${images1.length} vs ${images2.length}`);
        }

        // Find images with missing alt text
        const missingAlt1 = images1.filter(img => !img.alt || img.alt.trim() === '').length;
        const missingAlt2 = images2.filter(img => !img.alt || img.alt.trim() === '').length;

        if (missingAlt1 !== missingAlt2) {
            details.push(`Different number of images without alt text: ${missingAlt1} vs ${missingAlt2}`);
        }

        // Find different image sources
        const srcs1 = images1.map(img => img.src).filter(src => src);
        const srcs2 = images2.map(img => img.src).filter(src => src);

        const uniqueSrcs1 = srcs1.filter(src => !srcs2.includes(src));
        const uniqueSrcs2 = srcs2.filter(src => !srcs1.includes(src));

        if (uniqueSrcs1.length > 0 || uniqueSrcs2.length > 0) {
            details.push(`Different image sources found`);
            if (uniqueSrcs1.length > 0) {
                snippets.push({
                    type: 'images_only_in_site1',
                    count: uniqueSrcs1.length,
                    examples: uniqueSrcs1.slice(0, 2)
                });
            }
            if (uniqueSrcs2.length > 0) {
                snippets.push({
                    type: 'images_only_in_site2',
                    count: uniqueSrcs2.length,
                    examples: uniqueSrcs2.slice(0, 2)
                });
            }
        }

        return {
            hasDifferences: details.length > 0,
            details,
            snippets
        };
    }

    // Compare forms with detailed analysis
    compareForms(forms1, forms2) {
        const details = [];
        const snippets = [];

        if (forms1.length !== forms2.length) {
            details.push(`Different number of forms: ${forms1.length} vs ${forms2.length}`);
        }

        // Compare form actions and methods
        const actions1 = forms1.map(f => f.action).filter(a => a);
        const actions2 = forms2.map(f => f.action).filter(a => a);

        if (actions1.length !== actions2.length) {
            details.push(`Different number of form actions: ${actions1.length} vs ${actions2.length}`);
        }

        // Compare input counts
        const totalInputs1 = forms1.reduce((sum, form) => sum + form.inputs.length, 0);
        const totalInputs2 = forms2.reduce((sum, form) => sum + form.inputs.length, 0);

        if (totalInputs1 !== totalInputs2) {
            details.push(`Different total input fields: ${totalInputs1} vs ${totalInputs2}`);
        }

        return {
            hasDifferences: details.length > 0,
            details,
            snippets
        };
    }

    // Generate summary of difference types found
    getDifferenceTypeSummary() {
        const typeCounts = {};

        this.results.differences.forEach(diff => {
            diff.differences.forEach(d => {
                typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
            });
        });

        return typeCounts;
    }

        // Get the most significant differences for quick overview
    getSignificantDifferences() {
        const significant = [];

        this.results.differences.forEach(diff => {
            const significantDiffs = diff.differences.filter(d => {
                // Consider title differences as most significant
                if (d.type === 'title') return true;
                // Consider content differences with snippets as significant
                if (d.snippets && d.snippets.length > 0) return true;
                // Consider large count differences as significant
                if (Math.abs(d.site1 - d.site2) > 2) return true;
                return false;
            });

            if (significantDiffs.length > 0) {
                significant.push({
                    url: diff.url,
                    differences: significantDiffs
                });
            }
        });

        return significant.slice(0, 5); // Return top 5 most significant
    }

    // Get a summary of offset analysis results
    getOffsetAnalysisSummary() {
        const summary = {
            totalPages: this.results.differences.length,
            pagesWithAdditions: 0,
            pagesWithDeletions: 0,
            pagesWithReordering: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            contentTypes: {}
        };

        this.results.differences.forEach(diff => {
            let hasAdditions = false;
            let hasDeletions = false;
            let hasReordering = false;

            diff.differences.forEach(d => {
                if (d.snippets) {
                    d.snippets.forEach(snippet => {
                        if (snippet.type === 'addition') {
                            hasAdditions = true;
                            summary.totalAdditions += snippet.count;
                            summary.contentTypes[snippet.contentType] = (summary.contentTypes[snippet.contentType] || 0) + snippet.count;
                        } else if (snippet.type === 'deletion') {
                            hasDeletions = true;
                            summary.totalDeletions += snippet.count;
                            summary.contentTypes[snippet.contentType] = (summary.contentTypes[snippet.contentType] || 0) + snippet.count;
                        } else if (snippet.type === 'reordering') {
                            hasReordering = true;
                        }
                    });
                }
            });

            if (hasAdditions) summary.pagesWithAdditions++;
            if (hasDeletions) summary.pagesWithDeletions++;
            if (hasReordering) summary.pagesWithReordering++;
        });

        return summary;
    }

    // Crawl a single page
    async crawlPage(page, url, auth = null) {
        try {
            console.log(`Crawling: ${url}`);

            const response = await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: this.options.timeout
            });

            if (!response.ok()) {
                throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
            }

            // Wait for dynamic content - compatible with all Puppeteer versions
            await this.waitFor(page, this.options.delay);

            const content = await page.content();

            // Get links with error handling
            let links = [];
            try {
                links = await page.$$eval('a[href]', anchors =>
                    anchors.map(a => a.href).filter(href => href && href.startsWith('http'))
                );
                console.log(`  Found ${links.length} links on ${url}`);
            } catch (linkError) {
                console.warn(`Could not extract links from ${url}:`, linkError.message);
            }

            return { content, links, status: response.status() };

        } catch (error) {
            console.error(`Error crawling ${url}:`, error.message);
            return { content: null, links: [], error: error.message };
        }
    }

    // Discover pages to compare
    async discoverPages(domain, auth = null) {
        const page = await this.createPage(auth);
        const discovered = new Set([domain]);
        const toVisit = [domain];
        const pages = new Map();

        console.log(`Discovering pages from ${domain}...`);

        while (toVisit.length > 0 && pages.size < this.options.maxPages) {
            const url = toVisit.shift();

            if (this.visited.has(url)) continue;
            this.visited.add(url);

            const result = await this.crawlPage(page, url, auth);
            pages.set(url, result);

            if (result.content && result.links && result.links.length > 0) {
                // Add internal links to discovery queue
                result.links.forEach(link => {
                    try {
                        const linkUrl = new URL(link);
                        const baseUrl = new URL(domain);

                        // Only add internal links that we haven't discovered yet
                        if (linkUrl.hostname === baseUrl.hostname &&
                            !discovered.has(link) &&
                            !link.includes('#') && // Skip anchor links
                            !link.includes('?') && // Skip query parameters for now
                            pages.size < this.options.maxPages &&
                            discovered.size < this.options.maxDiscovery) {

                            discovered.add(link);
                            toVisit.push(link);
                            console.log(`    Adding to queue: ${link}`);
                        }
                    } catch (e) {
                        // Invalid URL, skip silently
                    }
                });
            }

            // Show progress
            if (pages.size % 5 === 0) {
                console.log(`  Crawled ${pages.size} pages from ${domain}`);
            }
        }

        await page.close();
        console.log(`✅ Finished discovering ${pages.size} pages from ${domain}`);
        console.log(`📊 Total links found: ${Array.from(pages.values()).reduce((sum, page) => sum + (page.links ? page.links.length : 0), 0)}`);
        return pages;
    }

    // Main comparison function
    async compare(domain1, domain2, authOptions = {}) {
        console.log(`Starting comparison between:\n  Site 1: ${domain1}\n  Site 2: ${domain2}\n`);

        try {
            await this.init();

            // Get authentication if needed
            const auth1 = await this.getAuthCredentials(domain1, authOptions.site1 || {});
            const auth2 = await this.getAuthCredentials(domain2, authOptions.site2 || {});

            console.log('\nDiscovering pages...');

            // Test authentication by trying to access the root page first
            if (auth1) {
                console.log(`Testing authentication for ${domain1}...`);
                const testResult = await this.testAuthentication(domain1, auth1);
                if (!testResult.success) {
                    throw new Error(`Authentication failed for ${domain1}: ${testResult.error}`);
                }
                console.log(`✅ Authentication successful for ${domain1}`);
            }

            if (auth2) {
                console.log(`Testing authentication for ${domain2}...`);
                const testResult = await this.testAuthentication(domain2, auth2);
                if (!testResult.success) {
                    throw new Error(`Authentication failed for ${domain2}: ${testResult.error}`);
                }
                console.log(`✅ Authentication successful for ${domain2}`);
            }

            // Discover pages from both sites
            const [pages1, pages2] = await Promise.all([
                this.discoverPages(domain1, auth1),
                this.discoverPages(domain2, auth2)
            ]);

            console.log(`\nFound ${pages1.size} pages on site 1, ${pages2.size} pages on site 2`);

            // Find common paths for comparison
            const paths1 = new Set(Array.from(pages1.keys()).map(url => new URL(url).pathname));
            const paths2 = new Set(Array.from(pages2.keys()).map(url => new URL(url).pathname));
            const commonPaths = [...paths1].filter(path => paths2.has(path));

            console.log(`\nComparing ${commonPaths.length} common paths...\n`);

            // Compare common pages
            for (const path of commonPaths) {
                const url1 = Array.from(pages1.keys()).find(url => new URL(url).pathname === path);
                const url2 = Array.from(pages2.keys()).find(url => new URL(url).pathname === path);

                const page1Data = pages1.get(url1);
                const page2Data = pages2.get(url2);

                if (page1Data.content && page2Data.content) {
                    const comparison = this.comparePage(
                        path,
                        page1Data.content,
                        page2Data.content,
                        domain1,
                        domain2
                    );

                    if (comparison.hasDifferences) {
                        this.results.differences.push(comparison);
                        console.log(`❌ ${path}: ${comparison.differences.length} differences found`);
                    } else {
                        console.log(`✅ ${path}: No significant differences`);
                    }

                    this.results.compared++;
                } else {
                    const error = page1Data.error || page2Data.error || 'Unknown error';
                    this.results.errors.push({ path, error });
                    console.log(`⚠️  ${path}: Error - ${error}`);
                }
            }

            // Generate summary
            this.results.summary = {
                totalCompared: this.results.compared,
                pagesWithDifferences: this.results.differences.length,
                errors: this.results.errors.length,
                site1: domain1,
                site2: domain2,
                timestamp: new Date().toISOString(),
                differenceTypes: this.getDifferenceTypeSummary()
            };

            // Save results
            await this.saveResults();

            console.log(`\n📊 Comparison Complete:`);
            console.log(`   Total pages compared: ${this.results.summary.totalCompared}`);
            console.log(`   Pages with differences: ${this.results.summary.pagesWithDifferences}`);
            console.log(`   Errors encountered: ${this.results.summary.errors}`);
            console.log(`   Results saved to: ${this.options.outputDir}`);

        } catch (error) {
            console.error('Comparison failed:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    // Test authentication credentials
    async testAuthentication(domain, auth) {
        const page = await this.createPage(auth);

        try {
            console.log(`Testing authentication for ${domain}...`);
            const response = await page.goto(domain, {
                waitUntil: 'domcontentloaded',
                timeout: this.options.timeout
            });

            // Wait a moment for any redirects or dynamic content
            await this.waitFor(page, 2000);

            const finalUrl = page.url();
            const status = response.status();

            await page.close();

            if (status === 401) {
                return { success: false, error: 'Invalid credentials - received 401 Unauthorized' };
            } else if (status === 403) {
                return { success: false, error: 'Access forbidden - received 403 Forbidden' };
            } else if (status >= 400) {
                return { success: false, error: `HTTP ${status}: ${response.statusText()}` };
            }

            // Check if we were redirected to a login page (common pattern)
            if (finalUrl.toLowerCase().includes('login') && !domain.toLowerCase().includes('login')) {
                return { success: false, error: 'Redirected to login page - authentication may be required' };
            }

            console.log(`✅ Authentication test passed for ${domain} (HTTP ${status})`);
            return { success: true, status: status };

        } catch (error) {
            await page.close();
            console.error(`❌ Authentication test failed for ${domain}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Save detailed results as JSON
        await fs.writeFile(
            path.join(this.options.outputDir, `results-${timestamp}.json`),
            JSON.stringify(this.results, null, 2)
        );

        // Save summary report as HTML
        const htmlReport = this.generateHTMLReport();
        await fs.writeFile(
            path.join(this.options.outputDir, `report-${timestamp}.html`),
            htmlReport
        );
    }

    generateHTMLReport() {
        const { summary, differences, errors } = this.results;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comparator Report - ${summary.timestamp}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #475569; font-size: 14px; }
        .metric .value { font-size: 28px; font-weight: bold; color: #1e293b; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        .difference { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin-bottom: 15px; border-radius: 6px; }
        .difference h4 { margin: 0 0 10px 0; color: #dc2626; }
        .diff-item { background: white; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .diff-details { margin: 10px 0; padding: 10px; background: #f8f9fa; border-left: 3px solid #007bff; }
        .diff-snippet { margin: 5px 0; padding: 8px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 3px; }
        .snippet-label { font-weight: bold; color: #856404; margin-bottom: 5px; }
        .snippet-content { font-family: monospace; font-size: 11px; color: #495057; }
        .diff-type { display: inline-block; background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 10px; }
        .error { background: #fffbeb; border: 1px solid #fed7aa; padding: 15px; margin-bottom: 15px; border-radius: 6px; }
        .no-differences { text-align: center; padding: 40px; color: #059669; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Comparator Comparison Report</h1>
            <p>Generated on ${new Date(summary.timestamp).toLocaleString()}</p>
            <p><strong>Site 1:</strong> ${summary.site1}<br><strong>Site 2:</strong> ${summary.site2}</p>
        </div>

        <div class="content">
            <div class="summary">
                <div class="metric">
                    <h3>Pages Compared</h3>
                    <div class="value">${summary.totalCompared}</div>
                </div>
                <div class="metric">
                    <h3>Differences Found</h3>
                    <div class="value" style="color: ${summary.pagesWithDifferences > 0 ? '#dc2626' : '#059669'}">${summary.pagesWithDifferences}</div>
                </div>
                <div class="metric">
                    <h3>Errors</h3>
                    <div class="value" style="color: ${summary.errors > 0 ? '#d97706' : '#059669'}">${summary.errors}</div>
                </div>
            </div>

            ${summary.differenceTypes && Object.keys(summary.differenceTypes).length > 0 ? `
            <div class="section">
                <h2>Difference Types Found</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 15px;">
                    ${Object.entries(summary.differenceTypes).map(([type, count]) => `
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; text-align: center;">
                            <div style="font-weight: bold; color: #495057;">${type}</div>
                            <div style="font-size: 18px; color: #dc2626;">${count}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${this.getOffsetAnalysisSummary().totalPages > 0 ? `
            <div class="section">
                <h2>Content Change Analysis</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea5e9;">
                        <div style="font-weight: bold; color: #0c4a6e;">Pages with Additions</div>
                        <div style="font-size: 24px; color: #059669;">${this.getOffsetAnalysisSummary().pagesWithAdditions}</div>
                        <div style="font-size: 12px; color: #64748b;">${this.getOffsetAnalysisSummary().totalAdditions} total items added</div>
                    </div>
                    <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #ef4444;">
                        <div style="font-weight: bold; color: #7f1d1d;">Pages with Deletions</div>
                        <div style="font-size: 24px; color: #dc2626;">${this.getOffsetAnalysisSummary().pagesWithDeletions}</div>
                        <div style="font-size: 12px; color: #64748b;">${this.getOffsetAnalysisSummary().totalDeletions} total items removed</div>
                    </div>
                    <div style="background: #fffbeb; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                        <div style="font-weight: bold; color: #78350f;">Pages with Reordering</div>
                        <div style="font-size: 24px; color: #d97706;">${this.getOffsetAnalysisSummary().pagesWithReordering}</div>
                        <div style="font-size: 12px; color: #64748b;">Content order changes</div>
                    </div>
                </div>
                ${Object.keys(this.getOffsetAnalysisSummary().contentTypes).length > 0 ? `
                <div style="margin-top: 20px;">
                    <h3 style="color: #374151; margin-bottom: 10px;">Content Changes by Type:</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
                        ${Object.entries(this.getOffsetAnalysisSummary().contentTypes).map(([type, count]) => `
                            <div style="background: #f3f4f6; padding: 8px; border-radius: 4px; text-align: center;">
                                <div style="font-weight: bold; color: #374151; font-size: 12px;">${type}</div>
                                <div style="font-size: 16px; color: #dc2626;">${count}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}

            ${this.getSignificantDifferences().length > 0 ? `
            <div class="section">
                <h2>Most Significant Differences</h2>
                ${this.getSignificantDifferences().map(diff => `
                    <div class="difference" style="background: #fef7f0; border-color: #fdba74;">
                        <h4>${diff.url}</h4>
                        ${diff.differences.map(d => `
                            <div class="diff-item">
                                <span class="diff-type" style="background: #f97316; color: white;">${d.type}</span>
                                <strong>Site 1:</strong> ${d.site1} | <strong>Site 2:</strong> ${d.site2}

                                ${d.snippet ? `
                                <div class="diff-snippet">
                                    <div class="snippet-label">Content Snippet:</div>
                                    <div class="snippet-content">
                                        <strong>Site 1:</strong> "${d.snippet.site1}"<br>
                                        <strong>Site 2:</strong> "${d.snippet.site2}"
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${differences.length > 0 ? `
            <div class="section">
                <h2>Pages with Differences</h2>
                ${differences.map(diff => `
                    <div class="difference">
                        <h4>${diff.url}</h4>
                        ${diff.differences.map(d => `
                            <div class="diff-item">
                                <span class="diff-type">${d.type}</span>
                                <strong>Site 1:</strong> ${d.site1} | <strong>Site 2:</strong> ${d.site2}

                                ${d.snippet ? `
                                <div class="diff-snippet">
                                    <div class="snippet-label">Content Snippet:</div>
                                    <div class="snippet-content">
                                        <strong>Site 1:</strong> "${d.snippet.site1}"<br>
                                        <strong>Site 2:</strong> "${d.snippet.site2}"
                                    </div>
                                </div>
                                ` : ''}

                                ${d.details ? `
                                <div class="diff-details">
                                    <strong>Details:</strong><br>
                                    ${d.details.map(detail => `• ${detail}`).join('<br>')}
                                </div>
                                ` : ''}

                                ${d.snippets && d.snippets.length > 0 ? `
                                <div class="diff-details">
                                    <strong>Specific Differences:</strong><br>
                                    ${d.snippets.map(snippet => {
                                        if (snippet.index) {
                                            return `• <strong>Item ${snippet.index}:</strong><br>
                                                    <span class="snippet-content">Site 1: "${snippet.site1}"<br>Site 2: "${snippet.site2}"</span>`;
                                        } else if (snippet.type === 'missing_in_site2' || snippet.type === 'missing_in_site1') {
                                            const siteLabel = snippet.type === 'missing_in_site2' ? 'Site 1 only' : 'Site 2 only';
                                            return `• <strong>${siteLabel}:</strong><br>
                                                    <span class="snippet-content">${snippet.links.map(link => `"${link}"`).join(', ')}</span>`;
                                        } else if (snippet.type === 'images_only_in_site1' || snippet.type === 'images_only_in_site2') {
                                            const siteLabel = snippet.type === 'images_only_in_site1' ? 'Site 1 only' : 'Site 2 only';
                                            return `• <strong>${siteLabel} (${snippet.count} images):</strong><br>
                                                    <span class="snippet-content">${snippet.examples.map(src => `"${src}"`).join(', ')}</span>`;
                                        } else if (snippet.type === 'addition') {
                                            return `• <strong style="color: #059669;">➕ Added ${snippet.contentType}${snippet.count > 1 ? `s (${snippet.count})` : ''}:</strong><br>
                                                    <span class="snippet-content">"${snippet.snippet.site2}"</span>`;
                                        } else if (snippet.type === 'deletion') {
                                            return `• <strong style="color: #dc2626;">➖ Removed ${snippet.contentType}${snippet.count > 1 ? `s (${snippet.count})` : ''}:</strong><br>
                                                    <span class="snippet-content">"${snippet.snippet.site1}"</span>`;
                                        } else if (snippet.type === 'reordering') {
                                            return `• <strong style="color: #d97706;">🔄 ${snippet.description}</strong>`;
                                        }
                                        return '';
                                    }).join('<br><br>')}
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
            ` : '<div class="no-differences"><h2>🎉 No significant differences found!</h2></div>'}

            ${errors.length > 0 ? `
            <div class="section">
                <h2>Errors Encountered</h2>
                ${errors.map(error => `
                    <div class="error">
                        <strong>${error.path}:</strong> ${error.error}
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`
Site Comparator - Website Comparison Tool

Usage: site-comparator <domain1> <domain2> [options]

Example:
  site-comparator https://staging.example.com https://example.com
  site-comparator https://dev.site.com https://site.com --max-pages 20

Authentication Examples:
  # Interactive prompts
  site-comparator https://staging.example.com https://example.com

  # Environment variables
  COMPARATOR_USERNAME=myuser COMPARATOR_PASSWORD=mypass site-comparator https://staging.example.com https://example.com

  # Different credentials per domain
  COMPARATOR_USER_STAGING_EXAMPLE_COM=user1 COMPARATOR_PASS_STAGING_EXAMPLE_COM=pass1 \\
  COMPARATOR_USER_EXAMPLE_COM=user2 COMPARATOR_PASS_EXAMPLE_COM=pass2 \\
  site-comparator https://staging.example.com https://example.com

Options:
  --max-pages <number>      Maximum pages to crawl (default: 20)
  --max-discovery <number>  Maximum unique links to discover (default: 500)
  --delay <ms>              Delay between requests (default: 1000)
  --timeout <ms>            Page load timeout (default: 30000)
  --output-dir <path>       Output directory (default: ./comparator-results)

Environment Variables:
  COMPARATOR_USERNAME      Default username for both sites
  COMPARATOR_PASSWORD      Default password for both sites
  COMPARATOR_USER_<KEY>    Username for specific domain (KEY = hostname with special chars as _)
  COMPARATOR_PASS_<KEY>    Password for specific domain

Features:
  ✅ Handles HTTP Basic Authentication
  ✅ Interactive credential prompts (with hidden password input)
  ✅ Environment variable support for CI/CD
  ✅ Per-domain authentication configuration
  ✅ Authentication testing before crawling
  ✅ Ignores spurious differences (CSRF tokens, timestamps, etc.)
  ✅ Compares content structure and meaning
  ✅ Generates detailed HTML and JSON reports
  ✅ Crawls internal links automatically
  ✅ Normalizes URLs and whitespace
        `);
        process.exit(1);
    }

    const domain1 = args[0];
    const domain2 = args[1];

    // Parse options
    const options = {};
    for (let i = 2; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];

        switch (key) {
            case 'max-pages':
                options.maxPages = parseInt(value);
                break;
            case 'max-discovery':
                options.maxDiscovery = parseInt(value);
                break;
            case 'delay':
                options.delay = parseInt(value);
                break;
            case 'timeout':
                options.timeout = parseInt(value);
                break;
            case 'output-dir':
                options.outputDir = value;
                break;
        }
    }

            const comparator = new Comparator(options);

    try {
        await comparator.compare(domain1, domain2);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Package.json dependencies needed:
// npm install puppeteer cheerio

if (require.main === module) {
    main().catch(console.error);
}

module.exports = Comparator;
