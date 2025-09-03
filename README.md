# Site Comparator

 A sophisticated website comparison tool that performs intelligent content analysis between two websites, detecting differences while accounting for content reordering and structural changes. Intended to get a general sense if your development or staging envirionment are in parity with regards to content with each other. At this point there is no funcitonality checks or visual/sylistic comparisons. This tool is intended for use on websites you have permission to crawl.

## 🚀 Features

- **Intelligent Content Analysis**: Compares websites beyond simple text matching, understanding content structure and meaning
- **Offset-Aware Comparison**: Detects when content has been reordered or shifted rather than just added/removed
- **Authentication Support**: Handles HTTP Basic Authentication with interactive prompts and environment variables
- **Automatic Crawling**: Discovers and compares internal pages automatically
- **Comprehensive Reports**: Generates detailed HTML and JSON reports with visual difference highlighting
- **Spurious Difference Filtering**: Ignores common dynamic content like CSRF tokens, timestamps, and session IDs
- **Flexible Configuration**: Customizable crawling limits, delays, and output options

## 📋 Requirements

- Node.js 16+
- npm or yarn
- Internet connection for web crawling

## 🛠️ Installation

### Global Installation (Recommended)

```bash
npm install -g @akukral/site-comparator
```

### Local Installation

```bash
npm install @akukral/site-comparator
```

### From Source

```bash
git clone https://github.com/akukral/site-comparator
cd site-comparator
npm install
npm link  # Makes it available globally
```

## 🎯 Quick Start

### Basic Usage

#### Global Installation
```bash
# Compare two websites
site-comparator https://staging.example.com https://example.com

# With custom options
site-comparator https://dev.site.com https://site.com --max-pages 20 --delay 2000
```

#### Local Installation
```bash
# Using npm script
npm run site-comparator https://staging.example.com https://example.com

# Using npx
npx site-comparator https://staging.example.com https://example.com

# Direct execution
node node_modules/@akukral/site-comparator/comparator.js https://staging.example.com https://example.com
```

### Authentication Examples

```bash
# Interactive authentication (will prompt for credentials)
site-comparator https://staging.example.com https://example.com

# Using environment variables
COMPARATOR_USERNAME=myuser COMPARATOR_PASSWORD=mypass \
  site-comparator https://staging.example.com https://example.com

# Different credentials per domain
COMPARATOR_USER_STAGING_EXAMPLE_COM=user1 COMPARATOR_PASS_STAGING_EXAMPLE_COM=pass1 \
COMPARATOR_USER_EXAMPLE_COM=user2 COMPARATOR_PASS_EXAMPLE_COM=pass2 \
  site-comparator https://staging.example.com https://example.com
```

## 📖 Usage

### Command Line Interface

```bash
site-comparator <domain1> <domain2> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-pages <number>` | Maximum pages to crawl per site | 20 |
| `--max-discovery <number>` | Maximum unique links to discover | 500 |
| `--delay <ms>` | Delay between requests (milliseconds) | 1000 |
| `--timeout <ms>` | Page load timeout (milliseconds) | 30000 |
| `--output-dir <path>` | Output directory for reports | `./comparator-results` |

### Programmatic Usage

```javascript
const Comparator = require('@akukral/site-comparator');

const comparator = new Comparator({
    maxPages: 20,
    maxDiscovery: 500,
    delay: 1500,
    timeout: 45000,
    outputDir: './my-results'
});

// Compare websites
await comparator.compare('https://staging.example.com', 'https://example.com');

// Or with authentication
await comparator.compare('https://staging.example.com', 'https://example.com', {
    site1: { username: 'user1', password: 'pass1' },
    site2: { username: 'user2', password: 'pass2' }
});
```

## 🔐 Authentication

Site Comparator supports multiple authentication methods:

### Interactive Prompts
When authentication is required, the tool will prompt for credentials with hidden password input.

### Environment Variables
Set credentials using environment variables:

```bash
# Default credentials for both sites
export COMPARATOR_USERNAME="myuser"
export COMPARATOR_PASSWORD="mypass"

# Site-specific credentials (domain key is hostname with special chars as _)
export COMPARATOR_USER_STAGING_EXAMPLE_COM="staging_user"
export COMPARATOR_PASS_STAGING_EXAMPLE_COM="staging_pass"
export COMPARATOR_USER_EXAMPLE_COM="prod_user"
export COMPARATOR_PASS_EXAMPLE_COM="prod_pass"
```

### Domain Key Generation
The tool automatically converts domain names to environment variable keys:
- `https://staging.example.com` → `STAGING_EXAMPLE_COM`
- `https://dev-site.com` → `DEV_SITE_COM`
- `https://test.example.co.uk` → `TEST_EXAMPLE_CO_UK`

## 📊 Output

Site Comparator generates comprehensive reports in the specified output directory:

### JSON Report (`results-{timestamp}.json`)
Detailed comparison data including:
- Page-by-page differences
- Content analysis results
- Error logs
- Summary statistics

### HTML Report (`report-{timestamp}.html`)
Visual report with:
- Summary metrics
- Difference type breakdown
- Content change analysis
- Most significant differences
- Detailed page comparisons
- Error listings

### Report Features
- **Difference Types**: Titles, headings, paragraphs, links, images, forms
- **Content Analysis**: Additions, deletions, reordering detection
- **Visual Indicators**: Color-coded differences and severity levels
- **Snippets**: Content previews for quick identification
- **Statistics**: Comprehensive metrics and summaries

## 🔧 Configuration

### Constructor Options

```javascript
const options = {
    maxPages: 20,                     // Maximum pages to crawl per site
    maxDiscovery: 500,                // Maximum unique links to discover (queue cap)
    delay: 1000,                      // Delay between requests (ms)
    timeout: 30000,                   // Page load timeout (ms)
    ignoreElements: [                 // HTML elements to ignore
        'script', 'noscript', 'style'
    ],
    ignoreAttributes: [               // Attributes to ignore
        'data-csrf', 'csrf-token', '_token', 'nonce'
    ],
    ignoreClasses: [                  // CSS classes to ignore
        'timestamp', 'csrf', 'nonce', 'random'
    ],
    userAgent: 'Comparator Bot 1.0',  // User agent string
    outputDir: './comparator-results' // Output directory
};
```

## 🧠 Intelligent Comparison

Site Comparator uses advanced algorithms to detect meaningful differences:

### Content Normalization
- Removes dynamic content (CSRF tokens, timestamps)
- Normalizes whitespace and formatting
- Handles URL differences between environments
- Filters out common noise

### Structural Analysis
- Compares content structure, not just text
- Detects content reordering vs. actual changes
- Analyzes heading hierarchies
- Examines link relationships

### Offset Detection
- Uses Longest Common Subsequence (LCS) algorithm
- Identifies when content has moved rather than changed
- Reduces false positives from content reordering
- Provides accurate change analysis

## 🚨 Error Handling

The tool gracefully handles various error scenarios:
- Network timeouts and connection issues
- Authentication failures
- Invalid URLs and redirects
- JavaScript errors on pages
- Missing or inaccessible content

Errors are logged and included in the final report for analysis.

## 🔒 Security Considerations

- Credentials are never logged or stored
- **Password input is completely hidden** - no keystrokes visible during interactive prompts
- Environment variables are cleared after use
- No sensitive data is included in reports
- Supports secure authentication methods
- Professional-grade password input using industry-standard libraries

## 📝 Examples

### Basic Website Comparison
```bash
# Compare staging and production
site-comparator https://staging.mysite.com https://mysite.com
```

### Limited Crawl for Large Sites
```bash
# Compare with limited page discovery
site-comparator https://dev.example.com https://example.com --max-pages 10
```

### Custom Output Location
```bash
# Save results to custom directory
site-comparator https://test.site.com https://site.com --output-dir ./my-comparison-results
```

### CI/CD Integration
```bash
# Use in automated testing
COMPARATOR_USERNAME=$STAGING_USER \
COMPARATOR_PASSWORD=$STAGING_PASS \
site-comparator https://staging.app.com https://app.com \
  --max-pages 20 \
  --delay 500 \
  --output-dir ./test-results
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: Check the inline code comments for detailed API documentation
- **Examples**: See the `examples/` directory for additional usage patterns

## 🔄 Version History

- **1.4.0**: Minor release with maintenance updates and JSDoc comments
- **1.2.0**: Crawl and discovery improvements
  - Added `maxDiscovery` option and `--max-discovery` CLI flag
  - Default `maxPages` now 20; discovery capped by crawled pages
  - Updated help text and docs
- **1.1.0**: Enhanced security and improved password input
  - **Security Enhancement**: Completely hidden password input with no visible keystrokes
  - **Professional Authentication**: Uses industry-standard `readline-sync` library for secure CLI input
  - **Better User Experience**: Cleaner, more reliable authentication prompts
  - **Dependency Updates**: Added `readline-sync` for enhanced security
- **1.0.4**: Previous stable release
- **1.0.0**: Initial release with intelligent content comparison
  - Features: Authentication support, HTML/JSON reports, offset detection

---

**Note**: This tool is designed for legitimate website comparison and testing purposes. Please ensure you have permission to crawl and compare the target websites.
