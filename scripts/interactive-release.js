#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

function updatePackageVersion(newVersion) {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

function incrementVersion(version, type) {
    const parts = version.split('.').map(Number);
    switch (type) {
        case 'major':
            return `${parts[0] + 1}.0.0`;
        case 'minor':
            return `${parts[0]}.${parts[1] + 1}.0`;
        case 'patch':
            return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
        default:
            throw new Error(`Invalid version type: ${type}`);
    }
}

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function askQuestion(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

function validateVersion(version) {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
}

async function selectVersionType(rl, currentVersion) {
    console.log();
    log('📦 Current version: ' + currentVersion, colors.blue);
    console.log();
    log('Select version increment type:', colors.cyan);
    log('  1. Patch (bug fixes)     → ' + incrementVersion(currentVersion, 'patch'), colors.yellow);
    log('  2. Minor (new features)  → ' + incrementVersion(currentVersion, 'minor'), colors.yellow);
    log('  3. Major (breaking)      → ' + incrementVersion(currentVersion, 'major'), colors.yellow);
    log('  4. Custom version', colors.yellow);
    console.log();

    while (true) {
        const choice = await askQuestion(rl, 'Enter your choice (1-4): ');
        
        switch (choice) {
            case '1':
                return { type: 'patch', version: incrementVersion(currentVersion, 'patch') };
            case '2':
                return { type: 'minor', version: incrementVersion(currentVersion, 'minor') };
            case '3':
                return { type: 'major', version: incrementVersion(currentVersion, 'major') };
            case '4':
                while (true) {
                    const customVersion = await askQuestion(rl, 'Enter custom version (e.g., 1.2.3): ');
                    if (validateVersion(customVersion)) {
                        return { type: 'custom', version: customVersion };
                    } else {
                        log('❌ Invalid version format. Please use semantic versioning (e.g., 1.2.3)', colors.red);
                    }
                }
            default:
                log('❌ Invalid choice. Please enter 1, 2, 3, or 4.', colors.red);
        }
    }
}

async function confirmRelease(rl, newVersion, options) {
    console.log();
    log('🚀 Release Summary:', colors.bright);
    log(`📦 New version: ${newVersion}`, colors.blue);
    log(`🧪 Run tests: ${!options.skipTests ? 'Yes' : 'No'}`, colors.blue);
    log(`🔍 Run linting: ${!options.skipLint ? 'Yes' : 'No'}`, colors.blue);
    log(`📝 Create git commit/tag: ${!options.skipGit ? 'Yes' : 'No'}`, colors.blue);
    log(`📦 Build VSIX: Yes (saved to out/ folder)`, colors.blue);
    console.log();

    while (true) {
        const confirm = await askQuestion(rl, 'Proceed with release? (y/n): ');
        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            return true;
        } else if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
            return false;
        } else {
            log('❌ Please enter y or n', colors.red);
        }
    }
}

async function askOptions(rl) {
    const options = {
        skipTests: false,
        skipLint: false,
        skipGit: false
    };

    console.log();
    log('⚙️  Release Options:', colors.cyan);

    const skipTests = await askQuestion(rl, 'Skip tests? (y/N): ');
    options.skipTests = skipTests.toLowerCase() === 'y' || skipTests.toLowerCase() === 'yes';

    const skipLint = await askQuestion(rl, 'Skip linting? (y/N): ');
    options.skipLint = skipLint.toLowerCase() === 'y' || skipLint.toLowerCase() === 'yes';

    const skipGit = await askQuestion(rl, 'Skip git commit and tag? (y/N): ');
    options.skipGit = skipGit.toLowerCase() === 'y' || skipGit.toLowerCase() === 'yes';

    return options;
}

async function main() {
    const rl = createInterface();

    try {
        log('🎯 Interactive Release Tool', colors.bright);
        log('This tool will help you create a new release with version bump and VSIX build', colors.cyan);

        const currentVersion = getPackageVersion();
        const versionInfo = await selectVersionType(rl, currentVersion);
        const options = await askOptions(rl);
        
        const shouldProceed = await confirmRelease(rl, versionInfo.version, options);
        
        if (!shouldProceed) {
            log('❌ Release cancelled by user', colors.yellow);
            process.exit(0);
        }

        console.log();
        log('🚀 Starting release process...', colors.bright);

        // Step 1: Install dependencies
        log('📥 Installing dependencies...', colors.yellow);
        execCommand('npm run postinstall');

        // Step 2: Lint code (unless skipped)
        if (!options.skipLint) {
            log('🔍 Linting code...', colors.yellow);
            execCommand('npm run lint');
        } else {
            log('⚠️  Skipping linting', colors.yellow);
        }

        // Step 3: Run tests (unless skipped)
        if (!options.skipTests) {
            log('🧪 Running tests...', colors.yellow);
            execCommand('npm test');
        } else {
            log('⚠️  Skipping tests', colors.yellow);
        }

        // Step 4: Compile TypeScript
        log('🔨 Compiling TypeScript...', colors.yellow);
        execCommand('npm run compile');

        // Step 5: Update version
        log(`📦 Updating version to ${versionInfo.version}...`, colors.yellow);
        updatePackageVersion(versionInfo.version);
        log(`✅ Version updated to: ${versionInfo.version}`, colors.green);

        // Step 6: Create VSIX package
        log('📦 Creating VSIX package...', colors.yellow);
        
        // Ensure out directory exists
        const outDir = path.join(__dirname, '..', 'out');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        
        const vsixFileName = `gherkin-extension-${versionInfo.version}.vsix`;
        const vsixPath = path.join(outDir, vsixFileName);
        
        execCommand(`vsce package --out "${vsixPath}"`);
        
        if (fs.existsSync(vsixPath)) {
            const stats = fs.statSync(vsixPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            log(`✅ VSIX package created: ${vsixPath} (${fileSizeMB} MB)`, colors.green);
        } else {
            log('❌ VSIX package not found', colors.red);
            process.exit(1);
        }

        // Step 7: Git operations (unless skipped)
        if (!options.skipGit) {
            log('📝 Creating git commit and tag...', colors.yellow);
            execCommand('git add .');
            execCommand(`git commit -m "chore: release v${versionInfo.version}"`);
            execCommand(`git tag v${versionInfo.version}`);
            log(`✅ Git commit and tag v${versionInfo.version} created`, colors.green);
        } else {
            log('⚠️  Skipping git operations', colors.yellow);
        }

        // Step 8: Success message
        console.log();
        log('🎉 Release completed successfully!', colors.green);
        log(`📦 Version: ${versionInfo.version}`, colors.bright);
        log(`📁 VSIX file: ${vsixPath}`, colors.bright);
        
        if (!options.skipGit) {
            log(`🏷️  Git tag: v${versionInfo.version}`, colors.bright);
            console.log();
            log('Next steps:', colors.cyan);
            log('  • Push changes: git push origin main', colors.cyan);
            log('  • Push tags: git push origin --tags', colors.cyan);
            log('  • Test extension: code --install-extension "' + vsixPath + '"', colors.cyan);
            log('  • Publish to marketplace: npm run publish', colors.cyan);
        } else {
            console.log();
            log('Next steps:', colors.cyan);
            log('  • Test extension: code --install-extension "' + vsixPath + '"', colors.cyan);
            log('  • Publish to marketplace: npm run publish', colors.cyan);
        }

    } catch (error) {
        log(`❌ Release failed: ${error.message}`, colors.red);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
${colors.bright}Gherkin Extension Interactive Release Tool${colors.reset}

${colors.cyan}Description:${colors.reset}
  Interactive tool for creating releases with version bumping and VSIX building.
  This tool will guide you through the release process step by step.

${colors.cyan}Usage:${colors.reset}
  npm run release:interactive

${colors.cyan}Features:${colors.reset}
  • Interactive version selection (patch/minor/major/custom)
  • Optional steps (tests, linting, git operations)
  • VSIX package creation in out/ folder
  • Git commit and tag creation
  • Comprehensive release summary

${colors.cyan}Examples:${colors.reset}
  npm run release:interactive    # Start interactive release process

${colors.cyan}Note:${colors.reset}
  This tool does NOT publish to the marketplace automatically.
  Use 'npm run publish' after the release is complete.
`);
    process.exit(0);
}

main();