# Site Comparator Examples

This directory contains practical examples demonstrating how to use the Comparator tool in various scenarios.

## 📁 Examples Overview

### 1. Basic Usage (`basic-usage.js`)
**Purpose**: Simple website comparison without authentication
**Use Case**: Comparing public websites or staging vs production environments

```bash
# Run the example
node examples/basic-usage.js

# Or make it executable and run directly
chmod +x examples/basic-usage.js
./examples/basic-usage.js
```

**Features Demonstrated**:
- Basic comparator initialization
- Custom configuration options
- Error handling
- Results output

### 2. Authentication Example (`authentication-example.js`)
**Purpose**: Website comparison with authentication credentials
**Use Case**: Comparing private/staging environments that require login

```bash
# Run with direct authentication
node examples/authentication-example.js

# Run with environment variable authentication
node examples/authentication-example.js --env
```

**Features Demonstrated**:
- Direct credential passing
- Environment variable authentication
- Per-site authentication configuration
- Secure credential handling

### 3. CI/CD Integration (`ci-cd-example.js`)
**Purpose**: Integration into automated testing and deployment workflows
**Use Case**: Automated quality assurance in CI/CD pipelines

```bash
# Run full CI/CD comparison
node examples/ci-cd-example.js

# Run quick health check
node examples/ci-cd-example.js --health-check

# With environment variables
STAGING_URL=https://staging.example.com \
PRODUCTION_URL=https://example.com \
MAX_DIFFERENCES=5 \
MAX_ERRORS=2 \
node examples/ci-cd-example.js
```

**Features Demonstrated**:
- Environment variable configuration
- Automated decision making
- Exit code handling for CI/CD
- Results analysis and reporting
- Health check mode for quick validation

## 🚀 Running Examples

### Prerequisites
1. Install dependencies: `npm install`
2. Ensure you have Node.js 16+ installed
3. Have access to the websites you want to compare

### Basic Setup
```bash
# Clone or download the site-comparator
cd site-comparator

# Install dependencies
npm install

# Run an example
node examples/basic-usage.js
```

### Customizing Examples
Each example can be customized by modifying the URLs and configuration options:

```javascript
// In any example file, modify these lines:
await comparator.compare(
    'https://your-staging-site.com',  // Change this
    'https://your-production-site.com' // Change this
);
```

## 🔧 Example Configurations

### For Development
```javascript
const comparator = new Comparator({
    maxPages: 5,      // Small limit for quick testing
    delay: 500,       // Fast requests
    timeout: 15000,   // Short timeout
    outputDir: './dev-results'
});
```

### For Production Testing
```javascript
const comparator = new Comparator({
    maxPages: 50,     // Comprehensive coverage
    delay: 2000,      // Respectful to servers
    timeout: 45000,   // Longer timeout for complex pages
    outputDir: './prod-results'
});
```

### For CI/CD
```javascript
const comparator = new Comparator({
    maxPages: 20,     // Balanced coverage
    delay: 1000,      // Reasonable speed
    timeout: 30000,   // Standard timeout
    outputDir: './ci-results'
});
```

## 📊 Understanding Results

After running any example, check the output directory for:

- **JSON Report**: Detailed comparison data (`results-{timestamp}.json`)
- **HTML Report**: Visual report with differences (`report-{timestamp}.html`)
- **CI Summary**: For CI/CD examples (`ci-summary.json`)

### Key Metrics to Monitor
- **Total Pages Compared**: Number of pages analyzed
- **Pages with Differences**: Pages that have meaningful differences
- **Error Count**: Number of pages that couldn't be compared
- **Difference Types**: Categories of differences found (titles, content, links, etc.)

## 🔐 Authentication Examples

### Environment Variables
```bash
# Set credentials before running
export COMPARATOR_USERNAME="your_username"
export COMPARATOR_PASSWORD="your_password"

# Run comparison
node examples/authentication-example.js --env
```

### Per-Domain Authentication
```bash
# Different credentials for different domains
export COMPARATOR_USER_STAGING_EXAMPLE_COM="staging_user"
export COMPARATOR_PASS_STAGING_EXAMPLE_COM="staging_pass"
export COMPARATOR_USER_EXAMPLE_COM="prod_user"
export COMPARATOR_PASS_EXAMPLE_COM="prod_pass"

# Run comparison
node examples/authentication-example.js
```

## 🚨 Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify credentials are correct
   - Check if the site requires different authentication method
   - Ensure environment variables are set correctly

2. **Timeout Errors**
   - Increase the `timeout` option for slow-loading pages
   - Check network connectivity
   - Verify the target URLs are accessible

3. **No Pages Found**
   - Ensure the starting URL is accessible
   - Check if the site has internal links
   - Verify the `maxPages` setting isn't too low

4. **Permission Errors**
   - Ensure you have write permissions for the output directory
   - Check if the directory exists and is writable

### Debug Mode
Add more verbose logging by modifying the comparator options:

```javascript
const comparator = new Comparator({
    // ... other options
    verbose: true  // Add this for more detailed logging
});
```

## 📝 Custom Examples

You can create your own examples by following the patterns in these files:

1. **Import the Comparator**: `const Comparator = require('../comparator.js');`
2. **Create an instance**: `new Comparator(options)`
3. **Run comparison**: `await comparator.compare(url1, url2, authOptions)`
4. **Handle results**: Check the output directory for reports

## 🤝 Contributing Examples

If you have a useful example, feel free to contribute:

1. Create a new file in the `examples/` directory
2. Follow the naming convention: `descriptive-name.js`
3. Include a shebang line: `#!/usr/bin/env node`
4. Add comprehensive comments explaining the use case
5. Update this README with your example

---

For more information, see the main [README.md](../README.md) file.
