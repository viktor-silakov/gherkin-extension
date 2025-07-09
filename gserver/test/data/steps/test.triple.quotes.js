/**
 * Step with triple quotes in JSDoc example
 * @example
 * ```javascript
 * const code = "example";
 * const docstring = """
 * This is a docstring with triple quotes
 * that used to break step definition parsing
 * """;
 * ```
 * 
 * Another example with backticks:
 * ```
 * function test() {
 *   return `template string`;
 * }
 * ```
 */
this.When(/I test step with problematic JSDoc comments/, function (next) {
    const docstring = """
    This is actual code with triple quotes
    """;
    next;
});

/**
 * Step with triple quotes in description
 * This step has """triple quotes""" in the description text
 * @description Normal step that should work fine
 */
this.Given(/I have step with quotes in description/, function (next) {
    next;
});

/**
 * Step with complex JSDoc and code blocks
 * @example
 * ```typescript
 * interface TestInterface {
 *   value: string;
 * }
 * const template = `
 *   Multi-line template string
 *   with ${variable} interpolation
 * `;
 * ```
 * @param {string} param - Parameter description
 */
this.Then(/I should handle complex documentation/, function (next) {
    const multilineString = `
        This is a template string
        with multiple lines
    `;
    next;
});

// Step without JSDoc comment but with triple quotes in code
this.And(/I have step without documentation/, function (next) {
    const docstring = """
    This step has no JSDoc comment
    """;
    next;
});