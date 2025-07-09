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
    magenta: '\x1b[35m',
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

function updateVersion(versionType) {
    log(`📦 Updating version (${versionType})...`, colors.yellow);
    execCommand(`npm version ${versionType} --no-git-tag-version`);
    return getPackageVersion();
}

function main() {
    const args = process.argv.slice(2);
    const versionType = args[0] || 'patch';
    const skipTests = args.includes('--skip-tests');
    const skipGit = args.includes('--skip-git');
    const dryRun = args.includes('--dry-run');

    if (!['patch', 'minor', 'major'].includes(versionType)) {
        log('❌ Invalid version type. Use: patch, minor, or major', colors.red);
        process.exit(1);
    }

    log('🚀 Starting release process...', colors.bright);
    log(`📋 Version type: ${versionType}`, colors.blue);
    log(`🧪 Skip tests: ${skipTests}`, colors.blue);
    log(`📝 Skip git: ${skipGit}`, colors.blue);
    log(`🔍 Dry run: ${dryRun}`, colors.blue);
    console.log();

    try {
        // Step 1: Clean and install dependencies
        log('🧹 Cleaning and installing dependencies...', colors.yellow);
        execCommand('npm run postinstall');

        // Step 2: Lint code
        log('🔍 Linting code...', colors.yellow);
        execCommand('npm run lint');

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

        // Step 5: Update version
        const newVersion = updateVersion(versionType);
        log(`✅ Version updated to: ${newVersion}`, colors.green);

        // Step 6: Create VSIX package
        if (!dryRun) {
            log('📦 Creating VSIX package...', colors.yellow);
            
            // Ensure out directory exists
            const outDir = path.join(__dirname, '..', 'out');
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            
            const vsixFileName = `gherkin-extension-${newVersion}.vsix`;
            const vsixPath = path.join(outDir, vsixFileName);
            
            execCommand(`vsce package --out "${vsixPath}"`);
            
            if (fs.existsSync(vsixPath)) {
                log(`✅ VSIX package created: ${vsixPath}`, colors.green);
            } else {
                log('❌ VSIX package not found', colors.red);
                process.exit(1);
            }
        } else {
            log('🔍 Dry run: Skipping VSIX package creation', colors.yellow);
        }

        // Step 7: Git operations (unless skipped)
        if (!skipGit && !dryRun) {
            log('📝 Creating git commit and tag...', colors.yellow);
            execCommand('git add .');
            execCommand(`git commit -m "chore: release v${newVersion}"`);
            execCommand(`git tag v${newVersion}`);
            log(`✅ Git commit and tag v${newVersion} created`, colors.green);
        } else {
            log('⚠️  Skipping git operations', colors.yellow);
        }

        // Step 8: Success message
        console.log();
        log('🎉 Release completed successfully!', colors.green);
        log(`📦 Version: ${newVersion}`, colors.bright);
        
        if (!dryRun) {
            log(`📁 VSIX file: out/gherkin-extension-${newVersion}.vsix`, colors.bright);
        }
        
        if (!skipGit && !dryRun) {
            log(`🏷️  Git tag: v${newVersion}`, colors.bright);
            console.log();
            log('Next steps:', colors.cyan);
            log('  • Push changes: git push origin main', colors.cyan);
            log('  • Push tags: git push origin --tags', colors.cyan);
            log('  • Publish to marketplace: npm run publish', colors.cyan);
        }

    } catch (error) {
        log(`❌ Release failed: ${error.message}`, colors.red);
        process.exit(1);
    }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
${colors.bright}Gherkin Extension Release Script${colors.reset}

${colors.cyan}Usage:${colors.reset}
  npm run release [version-type] [options]

${colors.cyan}Version Types:${colors.reset}
  patch    Increment patch version (default)
  minor    Increment minor version
  major    Increment major version

${colors.cyan}Options:${colors.reset}
  --skip-tests    Skip running tests
  --skip-git      Skip git commit and tag creation
  --dry-run       Show what would be done without executing
  --help, -h      Show this help message

${colors.cyan}Examples:${colors.reset}
  npm run release                    # Patch release with all steps
  npm run release minor              # Minor release
  npm run release major --skip-tests # Major release without tests
  npm run release patch --dry-run    # See what would happen
`);
    process.exit(0);
}

main();