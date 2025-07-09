#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
    log(`${colors.cyan}> ${command}${colors.reset}`);
    try {
        return execSync(command, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
            ...options
        });
    } catch (error) {
        log(`❌ Command failed: ${command}`, colors.red);
        process.exit(1);
    }
}

function getPackageVersion() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
}

function main() {
    const args = process.argv.slice(2);
    const skipTests = args.includes('--skip-tests');
    const skipLint = args.includes('--skip-lint');

    log('📦 Building VSIX package...', colors.bright);
    console.log();

    try {
        // Step 1: Install dependencies
        log('📥 Installing dependencies...', colors.yellow);
        execCommand('npm run postinstall');

        // Step 2: Lint code (unless skipped)
        if (!skipLint) {
            log('🔍 Linting code...', colors.yellow);
            execCommand('npm run lint');
        } else {
            log('⚠️  Skipping linting', colors.yellow);
        }

        // Step 3: Run tests (unless skipped)
        if (!skipTests) {
            log('🧪 Running tests...', colors.yellow);
            execCommand('npm test');
        } else {
            log('⚠️  Skipping tests', colors.yellow);
        }

        // Step 4: Compile TypeScript
        log('🔨 Compiling TypeScript...', colors.yellow);
        execCommand('npm run compile');

        // Step 5: Create VSIX package
        log('📦 Creating VSIX package...', colors.yellow);
        execCommand('npm run package');

        // Step 6: Verify package was created
        const version = getPackageVersion();
        const vsixFile = `gherkin-extension-${version}.vsix`;
        
        if (fs.existsSync(vsixFile)) {
            const stats = fs.statSync(vsixFile);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            console.log();
            log('🎉 VSIX package created successfully!', colors.green);
            log(`📁 File: ${vsixFile}`, colors.bright);
            log(`📏 Size: ${fileSizeMB} MB`, colors.bright);
            log(`📦 Version: ${version}`, colors.bright);
            
            console.log();
            log('Next steps:', colors.cyan);
            log('  • Test locally: code --install-extension ' + vsixFile, colors.cyan);
            log('  • Publish: npm run publish', colors.cyan);
        } else {
            log('❌ VSIX package not found', colors.red);
            process.exit(1);
        }

    } catch (error) {
        log(`❌ Build failed: ${error.message}`, colors.red);
        process.exit(1);
    }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
${colors.bright}Gherkin Extension VSIX Builder${colors.reset}

${colors.cyan}Usage:${colors.reset}
  npm run build:vsix [options]

${colors.cyan}Options:${colors.reset}
  --skip-tests    Skip running tests
  --skip-lint     Skip linting
  --help, -h      Show this help message

${colors.cyan}Examples:${colors.reset}
  npm run build:vsix                 # Full build with all checks
  npm run build:vsix --skip-tests    # Build without running tests
  npm run build:vsix --skip-lint     # Build without linting
`);
    process.exit(0);
}

main();