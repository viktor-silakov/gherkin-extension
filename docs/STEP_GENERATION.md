# Step Definition Generation

This feature allows you to automatically generate step definitions for undefined steps in your Gherkin feature files. The generated step definitions are based on the step text and can be customized for different programming languages.

## Features

- 🔧 **Automatic Step Definition Generation**: Converts undefined steps into proper step definitions
- 🎯 **Language Support**: Supports JavaScript, TypeScript, Ruby, Java, Python, and Kotlin
- 🚀 **Quick Fix Integration**: Works with VSCode's built-in Quick Fix functionality (💡 lightbulb)
- 🎨 **Smart Regex Generation**: Automatically converts quoted strings and numbers to regex groups
- 📂 **File Selection**: Choose which step definition file to add the generated code to

## How to Use

### Method 1: Quick Fix (Recommended)

1. Open a `.feature` file with undefined steps
2. Navigate to a step that shows a validation error (red underline)
3. Click the 💡 lightbulb icon or press `Ctrl+.` (Windows/Linux) or `Cmd+.` (Mac)
4. Select "Generate step definition for [step text]"
5. Choose the file where you want to add the step definition
6. The step definition will be generated and added to the selected file

### Method 2: Command Palette

1. Open a `.feature` file
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Generate Step Definition" and select the command
4. Follow the prompts to select the step and target file

## Generated Step Definition Examples

### JavaScript
```javascript
given('^I enter "([^"]*)" in the "([^"]*)" field$', function() {
    // TODO: implement step
    throw new Error('Step not implemented');
});
```

### TypeScript
```typescript
given('^I enter "([^"]*)" in the "([^"]*)" field$', () => {
    // TODO: implement step
    throw new Error('Step not implemented');
});
```

### Ruby
```ruby
given('^I enter "([^"]*)" in the "([^"]*)" field$') do
    # TODO: implement step
    raise NotImplementedError, 'Step not implemented'
end
```

### Java
```java
@Given("^I enter \"([^\"]*)\" in the \"([^\"]*)\" field$")
public void stepMethod() {
    // TODO: implement step
    throw new RuntimeException("Step not implemented");
}
```

### Python
```python
@given('^I enter "([^"]*)" in the "([^"]*)" field$')
def step_method(context):
    # TODO: implement step
    raise NotImplementedError('Step not implemented')
```

### Kotlin
```kotlin
@Given("^I enter \"([^\"]*)\" in the \"([^\"]*)\" field$")
fun stepMethod() {
    // TODO: implement step
    throw NotImplementedError("Step not implemented")
}
```

## Smart Regex Generation

The step generation feature automatically converts step text into appropriate regex patterns:

| Step Text | Generated Regex |
|-----------|-----------------|
| `I enter "test" in field` | `^I enter "([^"]*)" in field$` |
| `I wait 5 seconds` | `^I wait (\\d+) seconds$` |
| `I click button (close)` | `^I click button \\(close\\)$` |

## Configuration

The feature uses your existing `cucumberautocomplete.steps` configuration to:
- Detect the programming language from file extensions
- Find available step definition files for selection
- Determine the appropriate template to use

### Example Configuration

```json
{
    "cucumberautocomplete.steps": [
        "src/test/steps/**/*.js",
        "src/test/steps/**/*.ts"
    ]
}
```

## Language Detection

The system automatically detects the programming language based on the file patterns in your `cucumberautocomplete.steps` configuration:

- `.js` files → JavaScript templates
- `.ts` files → TypeScript templates
- `.rb` files → Ruby templates
- `.java` files → Java templates
- `.py` files → Python templates
- `.kt` files → Kotlin templates

If no specific language is detected, it defaults to JavaScript.

## Troubleshooting

### No Step Definition Files Found
**Error**: "No step definition files found. Please check your cucumberautocomplete.steps settings."

**Solution**: Ensure your `cucumberautocomplete.steps` configuration points to existing step definition files.

### Quick Fix Not Appearing
**Issue**: The lightbulb doesn't appear for undefined steps.

**Solutions**:
1. Ensure the step has a validation error (red underline)
2. Check that `cucumberautocomplete.steps` is configured
3. Restart VSCode to reload the extension

### Generated Step Not Working
**Issue**: The generated step definition doesn't match the step in the feature file.

**Solutions**:
1. Check that the regex pattern matches your step text
2. Manually adjust the regex if needed
3. Ensure parameter types match your step implementation

## Best Practices

1. **Review Generated Code**: Always review and customize the generated step definitions
2. **Consistent Naming**: Use consistent naming conventions for your step definition methods
3. **Parameter Types**: Consider using Cucumber parameter types for better type safety
4. **Organization**: Group related step definitions in logical files
5. **Documentation**: Add meaningful comments to explain complex step implementations

## Performance

The step generation feature is optimized for performance:
- Language detection is cached
- File scanning is done efficiently
- Generation is fast even for large projects

## Integration with Existing Features

This feature works seamlessly with:
- ✅ Step validation and diagnostics
- ✅ Autocompletion
- ✅ Go to definition
- ✅ Performance optimizations
- ✅ Multi-language support

## Keyboard Shortcuts

- `Ctrl+.` / `Cmd+.` - Open Quick Fix menu
- `Ctrl+Shift+P` / `Cmd+Shift+P` - Open Command Palette

## Future Enhancements

Planned improvements include:
- Custom step definition templates
- Batch generation for multiple steps
- Integration with popular testing frameworks
- Advanced regex pattern customization