## 0.0.8
* **FEATURE**: Added Automatic Step Definition Generation
  - Generate step definitions for undefined steps using Quick Fix (💡 lightbulb)
  - Support for JavaScript, TypeScript, Ruby, Java, Python, and Kotlin
  - Smart regex generation for quoted strings and numbers
  - File selection dialog to choose target step definition file
  - Integrates with existing LSP CodeActions for seamless UX
  - Command palette support for step generation
  - Comprehensive test coverage and documentation

## 0.0.6
* **BUGFIX**: Fixed false positive step matches in "Go to Definition"
  - Added validation to skip empty or very short step definitions (< 3 characters)
  - Prevents false matches from comments and documentation
  - Improved accuracy of step definition detection
* **FEATURE**: Added icon for feature files
  - Added cucumber icon for better file identification in VSCode

## 0.0.3
* **BUGFIX**: Fixed incorrect line mapping in "Go to Definition" functionality
  - Fixed issue where step definitions were redirected to wrong files and line numbers
  - Improved line number mapping algorithm after comment removal
  - Added regression tests to prevent future issues
  - Now correctly navigates to step definitions in files with extensive comments

## 3.0.5
* Used absolute pathes for the glob sync to fix "Go To Definition" problem on some Window PCs
* Fixed regression issue with non-English languages formatting
* Fixed wrong format selecting in case of no semicolon in the settings

## 3.0.0
* Extension updates:
1. Added the `pureTextSteps` option, enabling the use of steps as plain text (not as RegExp), with support for some Cucumber expressions.
2. Introduced the `relativeUp` formatting option. Now, lines can look up to the nearest formatting to determine the number of spaces.
3. Improved table pipes formatting.
4. Added an icon for feature files.

* Development Tech Dept updates:
1. Upgraded to the latest versions of all VSCode libraries, enhancing extension speed, security, and the development/debugging experience.
2. Upgraded to the latest version of TypeScript, making the application more error-resistant due to improved typings.
3. Transitioned from Chai+Mocha to Jest.
4. Improved monorepo-like extension usage.

* BREAKING CHANGES:
1. The `*` and `|` keys for the `formatConfOverride` settings no longer need to be escaped. Use `{ "*": 3 }` instead of `{ "\\*": 3 }` for the `cucumberautocomplete.formatConfOverride` option.

* Full list of features, improvements, and bug fixes can be found [here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A3.0.0).

## 2.15.2
* Fixed app compiling issues..
* Did some extension development updates.
* Fixed 'word' and 'string' cucumber expressions

## 2.15.1
* Fixed autoformat with unicode characters
* Fixed issue of steps highlighting, that ends with 'JSON' keyword
* Fixed indentation of the DOC strings
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.15.0)

## 2.15.0
* Added support for Gherkin 6 syntax (Rule and Example keywords)
* Added all the steps description into the Readme file
* Corrected JSON-related parts formatting
* Fixed some issues related to non-English languages

## 2.14.0
* Added stepRegExSymbol extension option
* Added strictGherkinValidation extension option
* Added extension support for "Ability" and "Business Need" synonyms for the "Feature"
* Implemented full support of '*' (any) gherkin symbol
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.14.0)

## 2.13.1
* Implemented all the foreign 'Given/When/Then' words support
* Corrected completion getting in case of strictGherkinCompletion option and foreign gherkin words
* Show, if present, JSDoc step field as suggestion description
* Added support of 'Parameter Types', 'Optional Text' and 'Alternative Text' cucumber expressions
* Added an ability to provide some custom Gherkin Definition RegEx Part
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.13.0)

## 2.12.0
* Implemented proper steps suggestions after "And" word in Strict Gherkin Suggestions mode
* Fixed steps detection for Scenario Outline strings
* Added extension support for '.testcase' files
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.12.0)

## 2.11.0
* Many formatting fixes/improvements (please look at the skipDocStringsFormat, formatConfOverride and onTypeFormat options).
* Some other small fixes.
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.11.0)

## 2.10.0
* Added an ability to define steps using "Step" word
* Disable validation for commented parts of feature files
* Small formatting fixes
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.10.0)

## 2.9.0
* Added an ability to define steps using grave accent(`) symbol
* Fixed customParameters applying to the steps definitions
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.9.0+is%3Aclosed)

## 2.8.0
* Extension will not crash in case of invalid regular expression - such regExp's will be skipped.
* Added 'cucumberautocomplete.customParameters' option, that allows to change any step part.
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.8.0+is%3Aclosed)

## 2.7.0
* Added cucumberautocomplete.stepsInvariants option. Steps Invariants feature is disabled by default.
* Fixed "Unterminated group" error for some steps regexps.
* Implemented multi languages for the steps getting.
* Steps could be defined in two strings.
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.7.0+is%3Aclosed)

## 2.6.0
* Implemented strictGherkinCompletion extension option that will do strict comparing between gherkin word and step definition function name during showing of completions
* Implemented smartSnippets extension option that will automatically change all the parts, that requires some user input (like .*, ([a-z]+), \\w{1,3}) to snippets
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.6.0+is%3Aclosed)

## 2.5.0
* Added support of 'Go To Definition'/'Step Diagnostic' for many languages.
* Added auto-update steps / wrong steps errors after files with steps changing.
* Steps, which contains some 'or' parts (like `I do (something|another thing)`) will be showed as several different steps
* Full list of Features/Improvements/Bugfixes could be found [Here](https://github.com/alexkrechik/VSCucumberAutoComplete/issues?q=milestone%3A2.5.0+is%3Aclosed)

## 2.4.0
### Features/Improvements:
* [#124](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/124) Cucumber 2 support
* [#118](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/118) Syntax should highlight tags and nested variables
### Bugfixes:
* [#102](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/102) Fix snippets to avoid snippets warnings
* [#99](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/99) CucumberJS v2.X regex syntax {.*} not being detected

## 2.3.0
### MAIN CHANGES
* Added an ability to provide glop pattern fo features, that should be synced for steps using count getting
* Many features formatting improvements/bugfixes
### Features/Improvements:
* [#81](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/81) Add global pattern support for cucumberautocomplete.steps and cucumberautocomplete.pages
* [#83](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/83) Add possibility to specify paths to features inside cucumberautocomplete.syncfeatures
* [#84](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/84) Add one more space after page object insert
### Bugfixes:
* [#89](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/89) Data tables have to start with identation in steps and scenario outline examples
* [#90](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/90) Scenario Outline is idented as it is a step in the previous block
* [#91](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/91) Tags are indented as they belong to the previous block
* [#92](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/92) Format data tables so they are rectangular
* [#93](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/93) Background should be on the same level as Scenario
* [#95](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/95) two spaces after Then not find

## 2.2.0
### MAIN CHANGES
* All the steps suggestions are sorted by their using count
* Using count will be taken from user input + from all the feature files (if `cucumberautocomplete.syncfeatures=true`)
* Warning message will appear for steps setting, which match no files
### Features/Improvements:
* [#45](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/45) All the suggestions should be sorted by their using count.
* [#66](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/66) Cannot work with some build-in/custom parameter types
* [#65](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/65) Step def with ruby interpolation aren't detect
* [#30](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/30) Add some error popup if wrong pathes in settings provided
* [#38](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/38) TypeScript PageObjects are not supported
### Bugfixes:
* [#64](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/64) A trailing space gives "unable to find step"
* [#73](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/73) Fix source in diagnostic warnings
* [#63](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/63) Highlighting as a comment when the # is after text
* [#79](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/79) Finding step definitions

## 2.1.0
### MAIN CHANGES
* Gherkin steps definitions in all the languages should be supported by default
* cucumber.regexpstart and cucumber.regexpend settings were removed due to this
### Features/Improvements:
* [#51](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/51) Add missing symbols after pages and page objects completion resolve
* [#39](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/39) Add all the languages steps support by default + refactoring
* [#35](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/35) support steps defined with strings instead of regexes
* [#54](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/54) App behaviour should be correct if some options were not provided
### Bugfixes:
* [#49](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/49) Unable to parse some step definitions from feature files
* [#62](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/62) Go to Definition throws error File not found with wrong path
* [#60](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/60) Wrong settings path broke app
* [#57](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/57) Steps implementation path can not be opened
* [#53](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/53) Page objects suggestions doesnt work with new VSCode
* [#40](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/40) Objects from commented lines should not be added as steps and page objects

## 2.0.0
### MAIN CHANGES
* cucumberautocomplete.steps setting format was changed to glob style due to [#24](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/24)
### Features/Improvements:
* [#24](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/24) Settings config file does not consider files on multiple levels
* [#29](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/29) Snippets support
* [#28](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/28) Multi - language extension support
* [#26](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/26) Add support for Cucumber-TSFlow
### Bugfixes:
* [#25](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/25) Add support for Cucumber-TSFlow

## 1.1.0
### MAIN CHANGES
* All the steps and page objects will be updated automatically after any key in any feature file pressing
### Features:
* [#15](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/15) Add some 'Steps and Page Objects refreshing' command
### Bugfixes:
* [#18](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/18) Wrong pageObjects detecting
* [#17](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/17) Pick definition for the page/page objects if step is not completed
* [#21](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/21) Allow '/' in step definitions
* [#20](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/20) Added extension configuration
* [#16](https://github.com/alexkrechik/VSCucumberAutoComplete/issues/16) fix - Gherkin-style comments with #
