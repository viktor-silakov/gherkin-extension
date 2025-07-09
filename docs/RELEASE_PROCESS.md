# Release Process Documentation

This document describes the automated release process for the Gherkin Extension.

## Available Scripts

### 🚀 Release Scripts

#### `npm run release [version-type] [options]`
Complete release process that handles version bumping, testing, building, and git operations.

**Version Types:**
- `patch` - Bug fixes (default)
- `minor` - New features
- `major` - Breaking changes

**Options:**
- `--skip-tests` - Skip running tests
- `--skip-git` - Skip git commit and tag creation
- `--dry-run` - Show what would be done without executing

**Examples:**
```bash
# Patch release (default)
npm run release

# Minor release
npm run release minor

# Major release without tests
npm run release major --skip-tests

# Dry run to see what would happen
npm run release patch --dry-run
```

#### Quick Release Commands
```bash
npm run release:patch    # Equivalent to: npm run release patch
npm run release:minor    # Equivalent to: npm run release minor
npm run release:major    # Equivalent to: npm run release major
```

### 📦 Build Scripts

#### `npm run build:vsix [options]`
Build VSIX package without changing version.

**Options:**
- `--skip-tests` - Skip running tests
- `--skip-lint` - Skip linting

**Examples:**
```bash
# Full build with all checks
npm run build:vsix

# Build without tests
npm run build:vsix --skip-tests

# Quick build (skip tests and linting)
npm run build:vsix --skip-tests --skip-lint
```

## Release Process Steps

The `npm run release` command performs the following steps:

1. **🧹 Clean and Install** - Runs `npm run postinstall`
2. **🔍 Lint Code** - Runs `npm run lint`
3. **🧪 Run Tests** - Runs `npm test` (unless `--skip-tests`)
4. **🔨 Compile TypeScript** - Runs `npm run compile`
5. **📦 Update Version** - Updates version in package.json
6. **📦 Create VSIX** - Runs `npm run package`
7. **📝 Git Operations** - Creates commit and tag (unless `--skip-git`)

## Manual Release Steps

If you prefer manual control:

```bash
# 1. Update version manually
npm version patch  # or minor/major

# 2. Build VSIX
npm run build:vsix

# 3. Create git commit and tag
git add .
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git tag v$(node -p "require('./package.json').version")

# 4. Push changes
git push origin main
git push origin --tags

# 5. Publish to marketplace
npm run publish
```

## Publishing to VS Code Marketplace

After creating a release:

```bash
# Publish to marketplace
npm run publish

# Or publish specific VSIX file
vsce publish --packagePath gherkin-extension-x.x.x.vsix
```

## Testing Locally

Before publishing, test the VSIX locally:

```bash
# Install in VS Code
code --install-extension gherkin-extension-x.x.x.vsix

# Or use VS Code UI: Extensions > ... > Install from VSIX
```

## Troubleshooting

### Common Issues

1. **Tests failing**: Use `--skip-tests` for emergency releases
2. **Git issues**: Use `--skip-git` and handle git operations manually
3. **VSIX not created**: Check TypeScript compilation errors
4. **Permission issues**: Ensure scripts are executable (`chmod +x scripts/*.js`)

### Rollback

If you need to rollback a release:

```bash
# Reset version in package.json
git checkout HEAD~1 -- package.json

# Delete tag
git tag -d vX.X.X
git push origin :refs/tags/vX.X.X

# Reset commit
git reset --hard HEAD~1
```

## Best Practices

1. **Always test before release**: Don't use `--skip-tests` unless necessary
2. **Use semantic versioning**: patch for fixes, minor for features, major for breaking changes
3. **Review changes**: Use `--dry-run` to preview what will happen
4. **Test VSIX locally**: Install and test before publishing
5. **Update documentation**: Keep ENHANCEMENTS.md up to date

## CI/CD Integration

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Release
  run: npm run release patch --skip-git
  
- name: Create Release
  uses: actions/create-release@v1
  with:
    tag_name: v${{ env.VERSION }}
    release_name: Release v${{ env.VERSION }}
```

## Environment Requirements

- Node.js 16+
- npm 8+
- Git configured
- VS Code Extension Manager (`vsce`) installed
- All dependencies installed (`npm run postinstall`)