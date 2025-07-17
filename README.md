# Cucumber Full Language Support (Enhanced Fork)
VSCode Cucumber (Gherkin) Language Support + Format + Steps/PageObjects Validation

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=viktor-silakov.gherkin-extension)

> **⚠️ This is a fork of the original [VSCucumberAutoComplete](https://github.com/alexkrechik/VSCucumberAutoComplete) project with additional enhancements and bug fixes.**
> 
> For detailed information about all enhancements and modifications, see [ENHANCEMENTS.md](./docs/ENHANCEMENTS.md).

## 📦 Installation

Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=viktor-silakov.gherkin-extension) or search for "Gherkin Extension" in VS Code Extensions panel.

## This extension adds rich language support for the Cucumber (Gherkin) language to VS Code, including:
* Syntax highlight
* Basic Snippets support
* Auto-parsing of feature steps from paths, provided in settings.json
* Ontype validation for all the steps
* Definitions support for all the steps parts
* Document format support, including tables formatting
* Supporting of many spoken languages
* Gherkin page objects native support
* Multiple programming languages, JS, TS, Ruby, Kotlin etc.
* **🆕 Automatic Step Definition Generation** - Generate step definitions for undefined steps with Quick Fix
* **🆕 Enhanced Autocompletion System** - Intelligent step suggestions with context-aware filtering
* **🆕 Parameter Types to Simple Placeholders** - Convert `{string}` to `""` and `{int}` to `?` in autocompletion

## Important extension goals are improving of steps validation and navigation:
* Accurate step validation based on actual step definitions
* Go to definition support for all steps
* Quick fixes for undefined steps with automatic step generation

![](https://raw.githubusercontent.com/alexkrechik/VSCucumberAutoComplete/master/gclient/img/vscode.gif)

## 🆕 Step Definition Generation

Generate step definitions for undefined steps automatically:

1. **Via Quick Fix**: Click the 💡 lightbulb on undefined steps (red underline) or press `Ctrl+.`
2. **Via Command Palette**: Press `Ctrl+Shift+P` and search for "Generate Step Definition"
3. **Select target file**: Choose which step definition file to add the generated code to
4. **Review & customize**: The generated step definition will be added with modern parameter types

**Features**:
- **Modern Parameter Types**: Uses `{string}`, `{int}`, `{float}` instead of complex regex patterns
- **Playwright-Ready**: Generated steps include `{page}` parameter for Playwright compatibility
- **Auto Parameter Generation**: Automatically generates `str1`, `int1`, `float1`, etc. based on parameter type
- **Custom Templates**: Define your own step templates with `{gherkinType}`, `{stepPattern}`, and `{parameterList}` placeholders
- **Multi-language Support**: JavaScript, TypeScript, Ruby, Java, Python, and Kotlin

**Example**:
```gherkin
When I activate2 "feature" for 5 second and 3 times
```
Generated TypeScript:
```typescript
When('I activate2 {string} for {int} second and {int} times', async ({page}, str1, int1, int2) => {
    // TODO: implement step
    throw new Error('Step not implemented');
});
```

📖 **[Full Documentation](./docs/STEP_GENERATION.md)**

## How to use:
1. Open your app in VS Code
2. Install the extension from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=viktor-silakov.gherkin-extension) or search for "Gherkin Extension"
3. In the opened app root create (if absent) .vscode folder with settings.json file or just run ```mkdir .vscode && touch .vscode/settings.json```
4. Add all the needed settings to the settings.json file
5. Reload app to apply all the extension changes

## Settings:

### Basic settings example:
```javascript
{
    "cucumberautocomplete.steps": [
        "test/features/step_definitions/*.js",
        "node_modules/qa-lib/src/step_definitions/*.js"
    ]
}
```

### All the settings description:
**`cucumberautocomplete.steps`** - Glob-style path or array of glob-style paths to the gherkin steps files.
All the files, that match path provided, will be handled by the extension. So, ideally, this path should be as strict as possible (ex. `test/features/step_definitions/*.steps.js` is better then `test/**/*.steps.js` and much better then `**/*.steps.js`)
The Node will watch steps files for change and will automatically update steps in them.
All the paths are relative to the app root.

**`cucumberautocomplete.syncfeatures`** - Will get steps using count from the glob-style path.
Same with the `steps` setting - this path should be as strict as possible.



**`cucumberautocomplete.strictGherkinValidation`** - Compare step body and gherkin word during steps validation.
When enabled, only steps that strictly match the gherkin word will be considered valid.



**`cucumberautocomplete.customParameters`** - Change some steps RegEx parts depending on array of 'parameter' - 'value' key pairs. Parameter could be string or RegEx object.
This setting will be applied before the steps getting.
For ex. to get step from the py expression `@given(u'I do something')` we could use the next parameters:
```
"cucumberautocomplete.customParameters": [
        {
            "parameter":"(u'",
            "value":"('"
        }
    ],
```
After this, the current expression will be handled as `@given('I do something')`, so the extension would be able to get `'I do something'` step. 

**`cucumberautocomplete.pages`** - Object, which consists of 'page name' => 'page object file path' pairs
It is allowing to handle some very specific case of page objects usage in the gherkin steps.

**`cucumberautocomplete.skipDocStringsFormat`** - Skip format of strings, that placed between ''' or \"\"\".

**`cucumberautocomplete.formatConfOverride`** - Override some formatting via format conf strings = {[key: String]: num | 'relative' | 'relativeUp' }, where key - beggining of the string, num - numeric value of indents, 'relative' (same indent value as the next line), or 'relativeUp' (same as the previous line).
Example:
```
"cucumberautocomplete.formatConfOverride": {
        "And": 3,
        "But": "relative",
    },
```
Also, some new words (in the case of non-English languages using) could be added. Example:
```
"cucumberautocomplete.formatConfOverride": {
        "Característica": 3,
        "Cuando": "relative",
    },
```
Default format conf is:
```
{
    'Ability': 0,
    'Business Need': 0,
    'Feature:': 0,
    'Scenario:': 1,
    'Background:': 1,
    'Scenario Outline:': 1,
    'Examples:': 2,
    'Given': 2,
    'When': 2,
    'Then': 2,
    'And': 2,
    'But': 2,
    '*': 2,
    '|': 3,
    '"""': 3,
    '#': 'relative',
    '@': 'relative',
};
```


**`cucumberautocomplete.onTypeFormat`** - Enable ontype formattings (activating after pressing on space, @ and : keys)"

**`cucumberautocomplete.gherkinDefinitionPart`** - Provide step definition name part of regex(ex. '@(given|when|then|step)\\(' in case of python-like steps.
All the 'definition' words (usually they are gherkin words, but some other words also could be used) should be placed into the braces.

**`cucumberautocomplete.stepRegExSymbol`** - Provide step regex symbol. Ex. it would be \"'\" for When('I do something') definition
By default, all the `' ' "` symbols will be used do define start and the end of the regex. But, sometimes, we needs to use some other symbol (ex. `\\`) or we should exclude some default symbol (ex. use `'` only).

**`cucumberautocomplete.pureTextSteps`** - Some frameworks using gherkin steps as a text with just support for the cucumber expression instead of RegExp. This differs from the default extension behaviour, example:
`When('I give 5$ and * items')` step would be handled as `/I give 5$ and * items/` RegExp without this option enabled and as `/^I give 5\$ and \* items$/` RegExp with it (`^` and `$` symbols were added to the reg ex and also all the special regex symbols were handled as regular text symbols).

**`cucumberautocomplete.stepTemplate`** - Custom step template for generated step definitions. Use `{gherkinType}`, `{stepPattern}`, and `{parameterList}` placeholders. 
This template has priority over built-in language-specific templates. Empty by default (uses built-in templates).
Example:
```json
{
  "cucumberautocomplete.stepTemplate": "{gherkinType}('{stepPattern}', async ({page}{parameterList}) => {\n    // Custom implementation\n    throw new Error('Not implemented');\n});"
}
```

### Using all the setting available example:
```javascript
{
    "cucumberautocomplete.steps": [
        "test/features/step_definitions/*.js",
        "node_modules/qa-lib/src/step_definitions/*.js"
    ],
    "cucumberautocomplete.syncfeatures": "test/features/*feature",
    "cucumberautocomplete.strictGherkinCompletion": true,
    "cucumberautocomplete.strictGherkinValidation": true,
    "cucumberautocomplete.smartSnippets": true,
    "cucumberautocomplete.stepsInvariants": true,
    "cucumberautocomplete.customParameters": [
        {
            "parameter":"{ab}",
            "value":"(a|b)"
        },
        {
            "parameter":/\{a.*\}/,
            "value":"a"
        },
    ],
    "cucumberautocomplete.pages": {
        "users": "test/features/page_objects/users.storage.js",
        "pathes": "test/features/page_objects/pathes.storage.js",
        "main": "test/features/support/page_objects/main.page.js"
    },
    "cucumberautocomplete.stepTemplate": "{gherkinType}('{stepPattern}', async () => {\n    // TODO: implement step\n    throw new Error('Step not implemented');\n});",
    "cucumberautocomplete.skipDocStringsFormat": true,
    "cucumberautocomplete.formatConfOverride": {
        "And": 3,
        "But": "relative",
    },
    "cucumberautocomplete.onTypeFormat": true,
    "editor.quickSuggestions": {
        "comments": false,
        "strings": true,
        "other": true
    },
    "cucumberautocomplete.gherkinDefinitionPart": "(Given|When|Then)\\(",
    "cucumberautocomplete.stepRegExSymbol": "'",
    "cucumberautocomplete.pureTextSteps": true
}
```
---

## 🔧 Development (Fork-Specific)

### For Contributors to This Fork

This is an enhanced fork with additional features and bug fixes. When contributing:

#### Development Workflow
1. **Always run tests after changes**: `npm test`
2. **Update documentation**: Add entries to [ENHANCEMENTS.md](./ENHANCEMENTS.md)
3. **Follow the rules**: Check [.cursorrules](./.cursorrules) for development guidelines
4. **Test thoroughly**: Both automated tests and manual VS Code testing

#### Key Commands
```bash
# Run all tests (REQUIRED after every change)
npm test

# Compile TypeScript
npm run compile

# Run tests in watch mode during development
npm test -- --watch

# Build VSIX package (saved to out/ folder)
npm run build:vsix

# Interactive release (version bump + VSIX build)
npm run release:interactive

# Automated release scripts
npm run release:patch    # Patch version bump
npm run release:minor    # Minor version bump
npm run release:major    # Major version bump
```

#### Building and Release
The extension uses an enhanced build system that creates VSIX packages in the `out/` folder:

**Interactive Release (Recommended)**
```bash
npm run release:interactive
```
This will guide you through:
- Version selection (patch/minor/major/custom)
- Optional steps (tests, linting, git operations)
- VSIX package creation
- Git commit and tag creation

**Quick VSIX Build**
```bash
npm run build:vsix
```
Creates a VSIX package without version changes.

**Automated Release**
```bash
npm run release:patch    # For bug fixes
npm run release:minor    # For new features
npm run release:major    # For breaking changes
```

All VSIX files are saved to the `out/` folder and excluded from git.

#### Documentation Requirements
- **Every enhancement** must be documented in [ENHANCEMENTS.md](./ENHANCEMENTS.md)
- **Use the provided template** for consistency
- **Include test cases** for all new functionality
- **Explain the reasoning** behind changes

#### Testing Requirements
- **All tests must pass** before committing
- **Write tests first** (TDD approach recommended)
- **Cover edge cases** and error conditions
- **Maintain or improve** test coverage

---

## 📋 Original Project

#### Issues
Feel free to create app issues on [GitHub](https://github.com/alexkrechik/VSCucumberAutoComplete/issues) for the original project.

For issues specific to this fork, please create issues in this repository.

#### Thank you
If this plugin was helpful for you, you could give it a ★ Star on the [original GitHub](https://github.com/alexkrechik/VSCucumberAutoComplete) and this fork.
