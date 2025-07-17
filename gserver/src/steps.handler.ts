import * as glob from 'glob';
import * as commentParser from 'doctrine';

import {
    Definition,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Location,
    Range,
    CompletionItem,
    CompletionItemKind,
} from 'vscode-languageserver';

import {
    getOSPath,
    getFileContent,
    clearComments,
    getMD5Id,
    escapeRegExp,
    escaprRegExpForPureText,
    getTextRange,
    getSortPrefix,
} from './util';

import {
    allGherkinWords,
    GherkinType,
    getGherkinType,
    getGherkinTypeLower,
} from './gherkin';

import { Settings, StepSettings, CustomParameter } from './types';

export type Step = {
  id: string;
  reg: RegExp;
  partialReg: RegExp;
  text: string;
  desc: string;
  def: Definition;
  count: number;
  gherkin: GherkinType;
  documentation: string;
};

export type StepsCountHash = {
  [step: string]: number;
};

interface JSDocComments {
  [key: number]: string;
}

export default class StepsHandler {
    elements: Step[] = [];

    elementsHash: { [step: string]: boolean } = {};

    elemenstCountHash: StepsCountHash = {};

    settings: Settings;

    private workspaceRoot: string;

    // Кэши для оптимизации производительности
    private regexCache = new Map<string, RegExp>();
    private partialRegexCache = new Map<string, RegExp>();
    private processedStepCache = new Map<string, string>();
    


    // Кэшированная версия создания RegExp
    private getRegExpCached(regText: string): RegExp {
        if (this.settings.enableRegexCaching && this.regexCache.has(regText)) {
            return this.regexCache.get(regText)!;
        }

        try {
            const regex = new RegExp(regText);
            if (this.settings.enableRegexCaching) {
                this.regexCache.set(regText, regex);
            }
            return regex;
        } catch (error) {
            console.warn(`Invalid regex pattern: ${regText}`, error);
            // Fallback to a simple regex that matches nothing
            const fallbackRegex = /^$/;
            if (this.settings.enableRegexCaching) {
                this.regexCache.set(regText, fallbackRegex);
            }
            return fallbackRegex;
        }
    }

    // Кэшированная версия partial RegExp
    private getPartialRegExpCached(step: string, regText?: string): RegExp {
        const cacheKey = regText ? `${step}:${regText}` : step;
        if (this.settings.enableRegexCaching && this.partialRegexCache.has(cacheKey)) {
            return this.partialRegexCache.get(cacheKey)!;
        }

        try {
            const partialRegText = regText 
                ? this.getPartialRegTextFromProcessed(regText)
                : this.getPartialRegText(step);
            const regex = new RegExp(partialRegText);
            if (this.settings.enableRegexCaching) {
                this.partialRegexCache.set(cacheKey, regex);
            }
            return regex;
        } catch (err) {
            // Fallback to main regex
            const fallbackRegText = regText || this.getRegTextForStepCached(step);
            const regex = this.getRegExpCached(fallbackRegText);
            if (this.settings.enableRegexCaching) {
                this.partialRegexCache.set(cacheKey, regex);
            }
            return regex;
        }
    }

    // Очистка всех кэшей
    private clearCaches(): void {
        this.regexCache.clear();
        this.partialRegexCache.clear();
        this.processedStepCache.clear();
    }

    // Метод для обновления всех partialReg в элементах
    private updatePartialRegexes(): void {
        this.partialRegexCache.clear();
        this.elements.forEach(element => {
            element.partialReg = this.getPartialRegExpCached(element.text);
        });
    }



    constructor(root: string, settings: Settings) {
        this.workspaceRoot = root;
        const { syncfeatures, steps } = settings;
        this.settings = settings;
        
        // Применяем настройки оптимизации по умолчанию
        if (this.settings.enablePerformanceOptimizations !== false) {
            this.settings.enablePerformanceOptimizations = true;
            this.settings.enableRegexCaching = this.settings.enableRegexCaching !== false;
        }
        
        // Clear caches on initialization
        this.clearCaches();
        
        this.populate(root, steps);
        
        if (syncfeatures === true) {
            this.setElementsHash(`${root}/**/*.feature`);
        } else if (typeof syncfeatures === 'string') {
            this.setElementsHash(`${root}/${syncfeatures}`);
        }
    }





    getGherkinRegEx() {
        return new RegExp(`^(\\s*)(${allGherkinWords})(\\s+)(.*)`);
    }

    getElements(): Step[] {
        return this.elements;
    }

    setElementsHash(path: string): void {
        this.elemenstCountHash = {};
        const files = glob.sync(path);
        files.forEach((f) => {
            const text = getFileContent(f);
            text.split(/\r?\n/g).forEach((line) => {
                const match = this.getGherkinMatch(line, text);
                if (match) {
                    const step = this.getStepByText(match[4]);
                    if (step) {
                        this.incrementElementCount(step.id);
                    }
                }
            });
        });
        this.elements.forEach((el) => (el.count = this.getElementCount(el.id)));
    }

    incrementElementCount(id: string): void {
        if (this.elemenstCountHash[id]) {
            this.elemenstCountHash[id]++;
        } else {
            this.elemenstCountHash[id] = 1;
        }
    }

    getElementCount(id: string): number {
        return this.elemenstCountHash[id] || 0;
    }

    getStepRegExp(): RegExp {
    //Actually, we dont care what the symbols are before our 'Gherkin' word
    //But they shouldn't end with letter
        const startPart = "^((?:[^'\"/]*?[^\\w])|.{0})";

        //All the steps should be declared using any gherkin keyword. We should get first 'gherkin' word
        const gherkinPart =
      this.settings.gherkinDefinitionPart ||
      `(${allGherkinWords}|defineStep|Step|StepDefinition)`;

        //All the symbols, except of symbols, using as step start and letters, could be between gherkin word and our step
        const nonStepStartSymbols = '[^/\'"`\\w]*?';

        // Step part getting
        const { stepRegExSymbol } = this.settings;
        // Step text could be placed between '/' symbols (ex. in JS) or between quotes, like in Java
        const stepStart = stepRegExSymbol ? `(${stepRegExSymbol})` : '(/|\'|"|`)';
        // ref to RegEx Example: https://regex101.com/r/mS1zJ8/1
        // Use a RegEx that peeks ahead to ensure escape character can still work, like `\'`.
        const stepBody = '((?:(?=(?:\\\\)*)\\\\.|.)*?)';
        //Step should be ended with same symbol it begins
        const stepEnd = stepRegExSymbol ? stepRegExSymbol : '\\3';

        //Our RegExp will be case-insensitive to support cases like TypeScript (...@when...)
        const r = new RegExp(
            startPart +
        gherkinPart +
        nonStepStartSymbols +
        stepStart +
        stepBody +
        stepEnd,
            'i'
        );

        // /^((?:[^'"\/]*?[^\w])|.{0})(Given|When|Then|And|But|defineStep)[^\/'"\w]*?(\/|'|")([^\3]+)\3/i
        return r;
    }

    geStepDefinitionMatch(line: string) {
        return line.match(this.getStepRegExp());
    }

    getOutlineVars(text: string) {
        return text.split(/\r?\n/g).reduce((res, a, i, arr) => {
            if (a.match(/^\s*Examples:\s*$/) && arr[i + 2]) {
                const names = arr[i + 1].split(/\s*\|\s*/).slice(1, -1);
                const values = arr[i + 2].split(/\s*\|\s*/).slice(1, -1);
                names.forEach((n, i) => {
                    if (values[i]) {
                        res[n] = values[i];
                    }
                });
            }
            return res;
        }, {} as Record<string, string>);
    }

    getGherkinMatch(line: string, document: string) {
        const outlineMatch = line.match(/<.*?>/g);
        if (outlineMatch) {
            const outlineVars = this.getOutlineVars(document);
            //We should support both outlines lines variants - with and without quotes
            const pureLine = outlineMatch
                .map((s) => s.replace(/<|>/g, ''))
                .reduce((resLine, key) => {
                    if (outlineVars[key]) {
                        resLine = resLine.replace(`<${key}>`, outlineVars[key]);
                    }
                    return resLine;
                }, line);
            const quotesLine = outlineMatch
                .map((s) => s.replace(/<|>/g, ''))
                .reduce((resLine, key) => {
                    if (outlineVars[key]) {
                        resLine = resLine.replace(`<${key}>`, `"${outlineVars[key]}"`);
                    }
                    return resLine;
                }, line);
            const pureMatch = pureLine.match(this.getGherkinRegEx());
            const quotesMatch = quotesLine.match(this.getGherkinRegEx());
            if (quotesMatch && quotesMatch[4] && this.getStepByText(quotesMatch[4])) {
                return quotesMatch;
            } else {
                return pureMatch;
            }
        }
        return line.match(this.getGherkinRegEx());
    }

    handleCustomParameters(step: string): string {
        const { customParameters } = this.settings;
        if (!customParameters) {
            return step;
        }
        customParameters.forEach((p: CustomParameter) => {
            const { parameter, value } = p;
            step = step.split(parameter).join(value);
        });
        return step;
    }

    // Оптимизированные предкомпилированные регулярные выражения для parameter types
    private static readonly PARAMETER_REPLACEMENTS = new Map([
        [/{float}/g, '-?\\d*\\.?\\d+'],
        [/{int}/g, '-?\\d+'],
        [/{stringInDoubleQuotes}/g, '"[^"]+"'],
        [/{word}/g, '[^\\s]+'],
        [/{string}/g, "(\"|')[^\\1]*\\1"],
        [/{}/g, '.*'],
        [/#{(.*?)}/g, '.*'] // Ruby interpolation
    ]);

    private static readonly COMMON_PATTERNS = {
        optionalText: /\(([a-z]+)\)/g,
        alternativeText: /([a-zA-Z]+)(?:\/([a-zA-Z]+))+/g,
        cucumberExpressions: /([^\\]|^){(?![\d,])(.*?)}/g
    };

    specialParameters = [
        //Ruby interpolation (like `#{Something}` ) should be replaced with `.*`
        //https://github.com/alexkrechik/VSCucumberAutoComplete/issues/65
        [/#{(.*?)}/g, '.*'],

        //Parameter-types
        //https://github.com/alexkrechik/VSCucumberAutoComplete/issues/66
        //https://docs.cucumber.io/cucumber/cucumber-expressions/
        [/{float}/g, '-?\\d*\\.?\\d+'],
        [/{int}/g, '-?\\d+'],
        [/{stringInDoubleQuotes}/g, '"[^"]+"'],
        [/{word}/g, '[^\\s]+'],
        [/{string}/g, "(\"|')[^\\1]*\\1"],
        [/{}/g, '.*'],
    ] as const

    getRegTextForPureStep(step: string): string {
        
        // Change all the special parameters
        this.specialParameters.forEach(([parameter, change]) => {
            step = step.replace(parameter, change)
        })
    
        // Escape all special symbols
        step = escaprRegExpForPureText(step)

        // Escape all the special parameters back
        this.specialParameters.forEach(([, change]) => {
            const escapedChange = escaprRegExpForPureText(change);
            step = step.replace(escapedChange, change)
        })

        // Compile the final regex
        return `^${step}$`;
    }

    // Оптимизированная обработка parameter types
    private processParameterTypes(step: string): string {
        let result = step;
        
        // Используем предкомпилированные регулярные выражения
        StepsHandler.PARAMETER_REPLACEMENTS.forEach((replacement, pattern) => {
            result = result.replace(pattern, replacement);
        });

        return result;
    }

    // Оптимизированная обработка общих паттернов
    private processCommonPatterns(step: string): string {
        let result = step;

        // Optional Text
        result = result.replace(StepsHandler.COMMON_PATTERNS.optionalText, '($1)?');

        // Alternative text a/b/c === (a|b|c)
        result = result.replace(
            StepsHandler.COMMON_PATTERNS.alternativeText,
            (match) => `(${match.replace(/\//g, '|')})`
        );

        // Handle Cucumber Expressions
        result = result.replace(StepsHandler.COMMON_PATTERNS.cucumberExpressions, '$1.*');

        return result;
    }

    // Кэшированная версия getRegTextForStep
    getRegTextForStepCached(step: string): string {
        if (this.settings.enableRegexCaching && this.processedStepCache.has(step)) {
            return this.processedStepCache.get(step)!;
        }

        let result = this.processParameterTypes(step);
        result = this.processCommonPatterns(result);
        result = escapeRegExp(result);

        if (this.settings.enableRegexCaching) {
            this.processedStepCache.set(step, result);
        }
        return result;
    }

    getRegTextForStep(step: string): string {
        // Используем кэшированную версию если включены оптимизации
        if (this.settings.enablePerformanceOptimizations) {
            return this.getRegTextForStepCached(step);
        }
        
        // Оригинальная логика для обратной совместимости
        let result = this.processParameterTypes(step);
        result = this.processCommonPatterns(result);
        result = escapeRegExp(result);
        return result;
    }

    getPartialRegParts(text: string): string[] {
    // We should separate got string into the parts by space symbol
    // But we should not touch /()/ and /[]/ RegEx elements
        text = this.settings.pureTextSteps
            ? this.getRegTextForPureStep(text)
            : this.getRegTextForStep(text);
        let currString = '';
        let bracesMode = false;
        let bracketsMode = false;
        let openingBracesNum = 0;
        let closingBracesNum = 0;
        const res = [];
        
        for (let i = 0; i <= text.length; i++) {
            const currSymbol = text[i];
            if (i === text.length) {
                res.push(currString);
            } else if (bracketsMode) {
                // Handle square brackets [] (character classes)
                if (currSymbol === ']') {
                    bracketsMode = false;
                }
                currString += currSymbol;
            } else if (bracesMode) {
                // Handle parentheses () (groups)
                if (currSymbol === ')') {
                    closingBracesNum++;
                    if (openingBracesNum === closingBracesNum) {
                        bracesMode = false;
                    }
                }
                if (currSymbol === '(') {
                    openingBracesNum++;
                }
                currString += currSymbol;
            } else {
                if (currSymbol === ' ') {
                    res.push(currString);
                    currString = '';
                } else if (currSymbol === '(') {
                    currString += '(';
                    bracesMode = true;
                    openingBracesNum = 1;
                    closingBracesNum = 0;
                } else if (currSymbol === '[') {
                    currString += '[';
                    bracketsMode = true;
                } else {
                    currString += currSymbol;
                }
            }
        }
        return res;
    }

    // Version that works with already processed regex text
    getPartialRegPartsFromProcessed(processedText: string): string[] {
        // Remove ^ and $ anchors from the processed regex
        processedText = processedText.replace(/^\^|\$$/g, '');
        
        let currString = '';
        let bracesMode = false;
        let bracketsMode = false;
        let openingBracesNum = 0;
        let closingBracesNum = 0;
        const res = [];
        
        for (let i = 0; i <= processedText.length; i++) {
            const currSymbol = processedText[i];
            const prevSymbol = i > 0 ? processedText[i - 1] : '';
            
            if (i === processedText.length) {
                res.push(currString);
            } else if (bracketsMode) {
                // Handle square brackets [] (character classes)
                if (currSymbol === ']') {
                    bracketsMode = false;
                }
                currString += currSymbol;
            } else if (bracesMode) {
                // Handle parentheses () (groups)
                if (currSymbol === ')') {
                    closingBracesNum++;
                    if (openingBracesNum === closingBracesNum) {
                        bracesMode = false;
                    }
                }
                if (currSymbol === '(') {
                    openingBracesNum++;
                }
                currString += currSymbol;
            } else {
                // Handle escaped spaces for pure text steps
                if (currSymbol === ' ' && prevSymbol !== '\\') {
                    res.push(currString);
                    currString = '';
                } else if (currSymbol === '(') {
                    currString += '(';
                    bracesMode = true;
                    openingBracesNum = 1;
                    closingBracesNum = 0;
                } else if (currSymbol === '[') {
                    currString += '[';
                    bracketsMode = true;
                } else {
                    currString += currSymbol;
                }
            }
        }
        return res;
    }

    getPartialRegText(regText: string): string {
    //Same with main reg, only differ is match any string that same or less that current one
        const parts = this.getPartialRegParts(regText);
        return parts
            .map((el, index) => {
                if (index === parts.length - 1) {
                    // For the last element, allow partial matching by creating alternatives
                    // for all possible prefixes of the word, include empty string for completion
                    const alternatives = [];
                    for (let i = 0; i <= el.length; i++) {
                        const prefix = el.substring(0, i);
                        // Escape special regex characters in the prefix
                        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        alternatives.push(escapedPrefix);
                    }
                    return `(${alternatives.join('|')})`;
                } else {
                    return `(${el}|$)`;
                }
            })
            .join('( |$)')
            .replace(/^\^|^/, '^');
    }

    // Version that works with already processed regex text  
    getPartialRegTextFromProcessed(regText: string): string {
        const parts = this.getPartialRegPartsFromProcessed(regText);
        return parts
            .map((el, index) => {
                if (index === parts.length - 1) {
                    // For the last element, allow partial matching by creating alternatives
                    // for all possible prefixes of the word, include empty string for completion
                    const alternatives = [];
                    for (let i = 0; i <= el.length; i++) {
                        const prefix = el.substring(0, i);
                        // Escape special regex characters in the prefix
                        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        alternatives.push(escapedPrefix);
                    }
                    return `(${alternatives.join('|')})`;
                } else {
                    return `(${el}|$)`;
                }
            })
            .join('( |$)')
            .replace(/^\^|^/, '^');
    }

    getTextForStep(step: string): string {
        //Remove "string start" and "string end" RegEx symbols
        step = step.replace(/^\^|\$$/g, '');

        // Create numbered placeholders for regex patterns in order of appearance
        let placeholderCounter = 1;
        
        // Replace all regex patterns with numbered placeholders in the order they appear
        step = step.replace(
            /\\[sdw][*+?]?|\([^)]*\)|\[[^\]]*\][*+?]?|\(\?:[^)]*\)/g,
            (match) => {
                // Don't replace very short or empty capturing groups that are likely empty
                if (match.startsWith('(') && match.endsWith(')') && match.length <= 4 && match === '()') {
                    return '';
                }
                return `\${${placeholderCounter++}:}`;
            }
        );
            
        // Now process other backslashes
        step = step
            .replace(/\\"/g, '"')     // Replace \" with "
            .replace(/\\'/g, "'")     // Replace \' with '
            .replace(/\\n/g, '\n')    // Replace \n with newline
            .replace(/\\t/g, '\t')    // Replace \t with tab
            .replace(/\\r/g, '\r')    // Replace \r with carriage return
            .replace(/\\\\/g, '\\')   // Replace \\ with \
            .replace(/\\(.)/g, '$1'); // Replace any other \x with x

        step = step
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim(); // Remove leading/trailing whitespace

        return step;
    }

    getDescForStep(step: string): string {
    //Remove 'Function body' part
        step = step.replace(/\{.*/, '');

        //Remove spaces in the beginning end in the end of string
        step = step.replace(/^\s*/, '').replace(/\s*$/, '');

        return step;
    }

    getStepTextInvariants(step: string): string[] {
    //Handle regexp's like 'I do (one|to|three)'
    //TODO - generate correct num of invariants for the circular braces
        const bracesRegEx = /(\([^)()]+\|[^()]+\))/;
        if (~step.search(bracesRegEx)) {
            const match = step.match(bracesRegEx);
            const matchRes = match![1];
            const variants = matchRes
                .replace(/\(\?:/, '')
                .replace(/^\(|\)$/g, '')
                .split('|');
            return variants.reduce((varRes, variant) => {
                return varRes.concat(
                    this.getStepTextInvariants(step.replace(matchRes, variant))
                );
            }, new Array<string>());
        } else {
            return [step];
        }
    }



    getDocumentation(stepRawComment: string) {
        const stepParsedComment = commentParser.parse(stepRawComment.trim(), {
            unwrap: true,
            sloppy: true,
            recoverable: true,
        });
        return (
            stepParsedComment.description ||
      (stepParsedComment.tags.find((tag) => tag.title === 'description') || {})
          .description ||
      (stepParsedComment.tags.find((tag) => tag.title === 'desc') || {})
          .description ||
      stepRawComment
        );
    }

    getSteps(
        fullStepLine: string,
        stepPart: string,
        def: Location,
        gherkin: GherkinType,
        comments: JSDocComments
    ): Step[] {
        // Debug logging for step creation
        if (stepPart.includes('the "([^"]*)" (.+)')) {
            console.log('DEBUG getSteps execution:');
            console.log('  stepPart:', stepPart);
            console.log('  gherkin received:', gherkin);
            console.log('  fullStepLine:', fullStepLine);
        }
        
        const stepsVariants = this.settings.stepsInvariants
            ? this.getStepTextInvariants(stepPart)
            : [stepPart];
        const desc = this.getDescForStep(fullStepLine);
        const comment = comments[def.range.start.line];
        const documentation = comment
            ? this.getDocumentation(comment)
            : fullStepLine;
        return stepsVariants
            .filter((step) => {
                //Filter invalid long regular expressions
                try {
                    const regText = this.settings.pureTextSteps
                        ? this.getRegTextForPureStep(step)
                        : this.getRegTextForStep(step);
                    new RegExp(regText);
                    return true;
                } catch (err) {
                    //Todo - show some warning
                    return false;
                }
            })
            .map((step) => {
                const regText = this.settings.pureTextSteps
                    ? this.getRegTextForPureStep(step)
                    : this.getRegTextForStepCached(step);
                
                const reg = this.getRegExpCached(regText);
                const partialReg = this.getPartialRegExpCached(step, regText);
                
                //Todo we should store full value here
                const text = this.settings.pureTextSteps
                    ? step
                    : this.getTextForStep(step);
                const id = 'step' + getMD5Id(text);
                const count = this.getElementCount(id);
                const stepObj = {
                    id,
                    reg,
                    partialReg,
                    text,
                    desc,
                    def,
                    count,
                    gherkin,
                    documentation,
                };
                
                // Debug logging for step creation
                if (reg.source === '^the "([^"]*)" (.+)$') {
                    console.log('DEBUG step object created:');
                    console.log('  text:', text);
                    console.log('  gherkin:', gherkin);
                    console.log('  id:', id);
                    console.log('  reg.source:', reg.source);
                }
                
                return stepObj;
            });
    }

    getMultiLineComments(content: string) {
        const lines = content.split(/\r?\n/g);
        const comments: JSDocComments = {};
        let current = '';
        let commentMode = false;
        let commentStartLine = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (~line.search(/^\s*\/\*/)) {
                current = `${line}\n`;
                commentMode = true;
                commentStartLine = i;
            } else if (~line.search(/^\s*\*\//)) {
                current += `${line}\n`;
                commentMode = false;
                
                // Find the next non-empty line after the comment
                let nextLineIndex = i + 1;
                while (nextLineIndex < lines.length && lines[nextLineIndex].trim() === '') {
                    nextLineIndex++;
                }
                
                // Associate comment with the next non-empty line
                if (nextLineIndex < lines.length) {
                    comments[nextLineIndex] = current;
                }
                
                current = '';
                commentStartLine = -1;
            } else if (commentMode) {
                current += `${line}\n`;
            }
        }
        
        return comments;
    }

    getFileSteps(filePath: string) {
        const fileContent = getFileContent(filePath);
        const fileComments = this.getMultiLineComments(fileContent);
        const definitionFile = clearComments(fileContent);
        
        // Create mapping from cleared file lines to original file lines
        const originalLines = fileContent.split(/\r?\n/g);
        const clearedLines = definitionFile.split(/\r?\n/g);
        const lineMapping: number[] = [];
        
        // Simple approach: map each cleared line to the same line number in original
        // This works because strip-comments preserves line numbers with preserveNewlines: true
        for (let i = 0; i < clearedLines.length; i++) {
            lineMapping[i] = i;
        }
        
        return clearedLines
            .reduce((steps, line, lineIndex, lines) => {
                //TODO optimize
                let match;
                let finalLine = '';
                const currLine = this.handleCustomParameters(line);
                const currentMatch = this.geStepDefinitionMatch(currLine);
                //Add next line to our string to handle two-lines step definitions
                const nextLine = this.handleCustomParameters(lines[lineIndex + 1] || '');
                if (currentMatch) {
                    match = currentMatch;
                    finalLine = currLine;
                } else if (nextLine) {
                    const nextLineMatch = this.geStepDefinitionMatch(nextLine);
                    const bothLinesMatch = this.geStepDefinitionMatch(
                        currLine + nextLine
                    );
                    if (bothLinesMatch && !nextLineMatch) {
                        match = bothLinesMatch;
                        finalLine = currLine + nextLine;
                    }
                }
                if (match) {
                    const [, beforeGherkin, gherkinString, , stepPart] = match;
                    
                    // Skip empty or very short step definitions (likely false positives)
                    if (!stepPart || stepPart.trim().length < 3) {
                        return steps;
                    }
                    
                    const gherkin = getGherkinTypeLower(gherkinString);
                    
                    // Debug logging for gherkin type determination
                    if (stepPart.includes('the "([^"]*)" (.+)')) {
                        console.log('DEBUG gherkin type determination:');
                        console.log('  gherkinString:', gherkinString);
                        console.log('  gherkin type:', gherkin);
                        console.log('  stepPart:', stepPart);
                    }
                    
                    // Use original line number for position and comment lookup
                    const originalLineIndex = lineMapping[lineIndex] !== undefined ? lineMapping[lineIndex] : lineIndex;
                    const pos = Position.create(originalLineIndex, beforeGherkin.length);
                    const def = Location.create(
                        getOSPath(filePath),
                        Range.create(pos, pos)
                    );
                    // Debug logging for gherkin type passed to getSteps
                    if (stepPart.includes('the "([^"]*)" (.+)')) {
                        console.log('DEBUG getSteps call:');
                        console.log('  stepPart:', stepPart);
                        console.log('  gherkin passed to getSteps:', gherkin);
                        console.log('  gherkinString that was used:', gherkinString);
                    }
                    
                    steps = steps.concat(
                        this.getSteps(finalLine, stepPart, def, gherkin, fileComments)
                    );
                }
                return steps;
            }, new Array<Step>());
    }

    validateConfiguration(
        settingsFile: string,
        stepsPathes: StepSettings,
        workSpaceRoot: string
    ) {
        return stepsPathes.reduce((res, path) => {
            const files = glob.sync(path);
            if (!files.length) {
                const searchTerm = path.replace(workSpaceRoot + '/', '');
                const range = getTextRange(
                    workSpaceRoot + '/' + settingsFile,
                    `"${searchTerm}"`
                );
                res.push({
                    severity: DiagnosticSeverity.Warning,
                    range: range,
                    message: 'No steps files found',
                    source: 'cucumberautocomplete',
                });
            }
            return res;
        }, new Array<Diagnostic>());
    }

    populate(root: string, stepsPathes: StepSettings): void {
        this.clearCaches();
        this.elementsHash = {};
        
        // Используем Set для дедупликации файлов
        const uniqueFiles = new Set<string>();
        
        stepsPathes.forEach(path => {
            const files = glob.sync(root + '/' + path, { absolute: true });
            files.forEach(file => uniqueFiles.add(file));
        });

        this.elements = Array.from(uniqueFiles)
            .reduce((elements, f) => {
                return elements.concat(
                    this.getFileSteps(f).reduce((steps, step) => {
                        if (!this.elementsHash[step.id]) {
                            steps.push(step);
                            this.elementsHash[step.id] = true;
                        }
                        return steps;
                    }, new Array<Step>())
                );
            }, new Array<Step>());
    }

    getStepByText(text: string, gherkin?: GherkinType) {
        return this.elements.find(
            (s) => {
                const isGherkinOk = gherkin !== undefined ? s.gherkin === gherkin : true;
                const isStepOk = s.reg.test(text);
                return isGherkinOk && isStepOk;
            }
        );
    }

    validate(line: string, lineNum: number, text: string) {
        line = line.replace(/\s*$/, '');
        const lineForError = line.replace(/^\s*/, '');
        const match = this.getGherkinMatch(line, text);
        if (!match) {
            return null;
        }
        const beforeGherkin = match[1];
        const gherkinPart = match[2];
        const gherkinWord = this.settings.strictGherkinValidation
            ? this.getStrictGherkinType(gherkinPart, lineNum, text)
            : undefined;
        const step = this.getStepByText(match[4], gherkinWord);
        if (step) {
            return null;
        } else {
            return {
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineNum, character: beforeGherkin.length },
                    end: { line: lineNum, character: line.length },
                },
                message: `Was unable to find step for "${lineForError}"`,
                source: 'cucumberautocomplete',
            } as Diagnostic;
        }
    }

    getDefinition(line: string, text: string): Definition | null {
        const match = this.getGherkinMatch(line, text);
        if (!match) {
            return null;
        }
        const step = this.getStepByText(match[4]);
        return step ? step.def : null;
    }

    getStrictGherkinType(gherkinPart: string, lineNumber: number, text: string) {
        const gherkinType = getGherkinType(gherkinPart);
        if (gherkinType === GherkinType.And || gherkinType === GherkinType.But) {
            return text
                .split(/\r?\n/g)
                .slice(0, lineNumber)
                .reduceRight((res, val) => {
                    if (res === GherkinType.Other) {
                        const match = this.getGherkinMatch(val, text);
                        if (match) {
                            const [, , prevGherkinPart] = match;
                            const prevGherkinPartType = getGherkinTypeLower(prevGherkinPart);
                            if (
                                ~[
                                    GherkinType.Given,
                                    GherkinType.When,
                                    GherkinType.Then,
                                ].indexOf(prevGherkinPartType)
                            ) {
                                res = prevGherkinPartType;
                            }
                        }
                    }
                    return res;
                }, GherkinType.Other);
        } else {
            return getGherkinTypeLower(gherkinPart);
        }
    }



    /**
     * Detect programming language from step definition files
     */
    private detectLanguage(): string {
        const { steps } = this.settings;
        for (const stepPattern of steps) {
            if (stepPattern.includes('*.ts')) return 'typescript';
            if (stepPattern.includes('*.js')) return 'javascript';
            if (stepPattern.includes('*.rb')) return 'ruby';
            if (stepPattern.includes('*.java')) return 'java';
            if (stepPattern.includes('*.py')) return 'python';
            if (stepPattern.includes('*.kt')) return 'kotlin';
        }
        return 'javascript'; // default
    }

    /**
     * Count parameter types in a step pattern and generate parameter names
     */
    private generateParameterList(parameterTypesPattern: string): string {
        const parameterTypes = parameterTypesPattern.match(/\{(string|int|float|word)\}/g) || [];
        if (parameterTypes.length === 0) {
            return '';
        }
        
        // Count occurrences of each parameter type
        const typeCounts = new Map<string, number>();
        
        const parameters = parameterTypes.map((match) => {
            const type = match.slice(1, -1); // Remove { and }
            const count = typeCounts.get(type) || 0;
            typeCounts.set(type, count + 1);
            
            // Generate appropriate parameter name based on type
            switch (type) {
            case 'string':
                return count === 0 ? 'str1' : `str${count + 1}`;
            case 'int':
                return count === 0 ? 'int1' : `int${count + 1}`;
            case 'float':
                return count === 0 ? 'float1' : `float${count + 1}`;
            case 'word':
                return count === 0 ? 'word1' : `word${count + 1}`;
            default:
                return count === 0 ? 'param1' : `param${count + 1}`;
            }
        });
        
        return ', ' + parameters.join(', ');
    }

    /**
     * Generate step definition template for given language
     */
    generateStepDefinition(stepText: string, gherkinType: string): string {
        const language = this.detectLanguage();
        const normalizedGherkinType = gherkinType.toLowerCase();
        
        // Convert step text to parameter types pattern
        const parameterTypesPattern = this.convertStepTextToParameterTypes(stepText);
        
        const capitalizedGherkinType = normalizedGherkinType.charAt(0).toUpperCase() + normalizedGherkinType.slice(1);
        
        // Check if custom step template is provided in settings
        if (this.settings.stepTemplate) {
            // For custom templates, use the appropriate case based on language
            const language = this.detectLanguage();
            const gherkinForTemplate = (language === 'javascript' || language === 'typescript') ? 
                capitalizedGherkinType : normalizedGherkinType;
            
            const parameterList = this.generateParameterList(parameterTypesPattern);
            
            return this.settings.stepTemplate
                .replace(/\{gherkinType\}/g, gherkinForTemplate)
                .replace(/\{stepPattern\}/g, parameterTypesPattern)
                .replace(/\{parameterList\}/g, parameterList);
        }
        
        // Generate parameters for JS/TS
        const parameterList = this.generateParameterList(parameterTypesPattern);
        
        const templates: {[key: string]: string} = {
            javascript: `${capitalizedGherkinType}('${parameterTypesPattern}', async ({page}${parameterList}) => {
    // TODO: implement step
    throw new Error('Step not implemented');
});`,
            typescript: `${capitalizedGherkinType}('${parameterTypesPattern}', async ({page}${parameterList}) => {
    // TODO: implement step
    throw new Error('Step not implemented');
});`,
            ruby: `${normalizedGherkinType}('${parameterTypesPattern}') do
    # TODO: implement step
    raise NotImplementedError, 'Step not implemented'
end`,
            java: `@${capitalizedGherkinType}("${parameterTypesPattern}")
public void stepMethod() {
    // TODO: implement step
    throw new RuntimeException("Step not implemented");
}`,
            python: `@${normalizedGherkinType}('${parameterTypesPattern}')
def step_method(context):
    # TODO: implement step
    raise NotImplementedError('Step not implemented')`,
            kotlin: `@${capitalizedGherkinType}("${parameterTypesPattern}")
fun stepMethod() {
    // TODO: implement step
    throw NotImplementedError("Step not implemented")
}`
        };

        return templates[language] || templates.javascript;
    }

    /**
     * Convert step text to parameter types pattern for step definition
     */
    private convertStepTextToParameterTypes(stepText: string): string {
        let result = stepText;
        
        // Replace quoted strings with {string} parameter type
        result = result.replace(/"([^"]*)"/g, '{string}');
        
        // Replace single quoted strings with {string} parameter type  
        result = result.replace(/'([^']*)'/g, '{string}');
        
        // Replace floating point numbers with {float} parameter type (must come before int)
        result = result.replace(/\b\d+\.\d+\b/g, '{float}');
        
        // Replace numbers with {int} parameter type
        result = result.replace(/\b\d+\b/g, '{int}');
        
        return result;
    }

    /**
     * Get list of step definition files for user selection
     */
    getStepDefinitionFiles(): Array<{label: string, path: string}> {
        const { steps } = this.settings;
        const files: Array<{label: string, path: string}> = [];
        
        steps.forEach(pattern => {
            const globPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;
            const matchedFiles = glob.sync(this.workspaceRoot + globPattern);
            
            matchedFiles.forEach(filePath => {
                const relativePath = filePath.replace(this.workspaceRoot + '/', '');
                files.push({
                    label: relativePath.split('/').pop() || relativePath,
                    path: filePath
                });
            });
        });
        
        return files;
    }

    /**
     * Get completion items for the current line
     */
    getCompletionItems(line: string, position: number, document: string): CompletionItem[] {
        const match = this.getGherkinMatch(line, document);
        if (!match) {
            return [];
        }

        const beforeGherkin = match[1];
        const gherkinWord = match[2];
        const afterGherkin = match[3];
        let stepText = match[4];

        // Debug logging
        if (stepText.includes('Chat Context Menu')) {
            console.log('DEBUG getCompletionItems - start:');
            console.log('  line:', line);
            console.log('  stepText:', stepText);
            console.log('  match:', match);
        }

        // Special handling for quotes in step text
        // If the step text ends with a quote followed by optional space, we need special handling
        const endsWithQuote = /"\s*$/.test(stepText);
        let originalStepText = stepText; // Keep original for regex matching
        
        if (endsWithQuote) {
            // Only remove quotes if it's a simple case (not part of a complex pattern)
            const hasMultipleQuotes = (stepText.match(/"/g) || []).length > 2;
            
            // Don't remove quotes if they appear to be part of a regex pattern like "([^"]*)"
            // Check if the text contains patterns that suggest it's a regex parameter
            const isRegexPattern = /"\([^"]*\)/.test(stepText) || /"\[[^\]]*\]/.test(stepText);
            
            // Don't remove quotes if this looks like a parameter for step completion
            // Check if there's a partial quoted parameter (like "Chat Context Menu")
            const looksLikeParameterCompletion = /"\w+[^"]*"$/.test(stepText);
            
            if (originalStepText.includes('Chat Context Menu')) {
                console.log('  hasMultipleQuotes:', hasMultipleQuotes);
                console.log('  isRegexPattern:', isRegexPattern);
                console.log('  looksLikeParameterCompletion:', looksLikeParameterCompletion);
                console.log('  will remove quote:', !hasMultipleQuotes && !isRegexPattern && !looksLikeParameterCompletion);
            }
            
            if (!hasMultipleQuotes && !isRegexPattern && !looksLikeParameterCompletion) {
                stepText = stepText.replace(/"\s*$/, '').trim();
            }
        }

        // Debug logging after quote processing
        if (originalStepText.includes('Chat Context Menu')) {
            console.log('DEBUG getCompletionItems - after quote processing:');
            console.log('  stepText:', stepText);
            console.log('  originalStepText:', originalStepText);
            console.log('  endsWithQuote:', endsWithQuote);
            console.log('  stepText was modified:', originalStepText !== stepText);
        }

        // Remove incomplete last word for better matching
        const cursorPosition = position - beforeGherkin.length - gherkinWord.length - afterGherkin.length;
        if (cursorPosition > 0 && cursorPosition <= stepText.length) {
            const beforeCursor = stepText.substring(0, cursorPosition);
            const afterCursor = stepText.substring(cursorPosition);
            
            // Only remove the last word if cursor is in the middle of a word
            // or if cursor is at the end and the last character is not a space
            const isAtEnd = cursorPosition === stepText.length;
            const isInMiddleOfWord = !isAtEnd && beforeCursor.length > 0 && 
                                   beforeCursor[beforeCursor.length - 1] !== ' ' &&
                                   afterCursor.length > 0 && 
                                   afterCursor[0] !== ' ';
            
            if (isInMiddleOfWord) {
                // Cursor is in the middle of a word, remove the incomplete word
                const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
                if (lastSpaceIndex !== -1) {
                    stepText = beforeCursor.substring(0, lastSpaceIndex);
                } else {
                    stepText = '';
                }
            } else if (isAtEnd && !endsWithQuote) {
                // Cursor is at the end - keep the full text, but not if we had quotes
                stepText = beforeCursor;
            } else {
                // Cursor is at word boundary but not at end - use text before cursor
                stepText = beforeCursor;
            }
        }

        const gherkinType = getGherkinType(gherkinWord);
        const targetGherkinType = this.getCompletionGherkinType(gherkinType, line, document);

        // Filter candidate steps
        // Use original step text for regex matching, processed step text for regular matching
        const candidateSteps = this.filterCandidateSteps(stepText, targetGherkinType, originalStepText);
        
        // Generate completion items
        const completionItems: CompletionItem[] = [];
        
        for (const step of candidateSteps) {
            const variants = this.expandStepVariants(step);
            for (const variant of variants) {
                const insertText = this.getInsertText(stepText, variant, position);
                if (insertText) {
                    completionItems.push(this.createCompletionItem(variant, insertText));
                }
            }
        }

        // Sort by usage count (most used first)
        completionItems.sort((a, b) => {
            const aCount = this.getElementCount((a.data && a.data.stepId) || '');
            const bCount = this.getElementCount((b.data && b.data.stepId) || '');
            return bCount - aCount;
        });

        return completionItems;
    }

    /**
     * Determine the effective Gherkin type for completion
     */
    private getCompletionGherkinType(gherkinType: GherkinType, line: string, document: string): GherkinType {
        // For And/But, find the previous step type
        if (gherkinType === GherkinType.And || gherkinType === GherkinType.But) {
            return this.getStrictGherkinType(
                gherkinType === GherkinType.And ? 'And' : 'But',
                this.getLineNumber(line, document),
                document
            );
        }
        return gherkinType;
    }

    /**
     * Get line number in document
     */
    private getLineNumber(line: string, document: string): number {
        const lines = document.split(/\r?\n/g);
        return lines.indexOf(line);
    }

    /**
     * Filter candidate steps based on text and gherkin type
     */
    private filterCandidateSteps(stepText: string, targetGherkinType: GherkinType, originalStepText?: string): Step[] {
        const { strictGherkinCompletion } = this.settings;
        
        // Debug logging
        if (stepText.includes('Chat Context Menu')) {
            console.log('DEBUG filterCandidateSteps:');
            console.log('  stepText:', stepText);
            console.log('  originalStepText:', originalStepText);
            console.log('  targetGherkinType:', targetGherkinType);
            console.log('  strictGherkinCompletion:', strictGherkinCompletion);
            console.log('  elements count:', this.elements.length);
            
            // Check if the target step exists
            const targetSteps = this.elements.filter(step => step.reg.source === '^the "([^"]*)" (.+)$');
            console.log('  target steps found:', targetSteps.length);
            targetSteps.forEach((targetStep, index) => {
                console.log(`  target step ${index + 1} gherkin type:`, targetStep.gherkin);
                console.log(`  target step ${index + 1} text:`, targetStep.text);
                console.log(`  target step ${index + 1} id:`, targetStep.id);
            });
        }
        
        const filteredResult = this.elements.filter(step => {
            // Debug logging for each step
            if (stepText.includes('Chat Context Menu')) {
                console.log('    checking step:', step.text, 'regSource:', step.reg.source);
            }
            
            // Special debug logging for our target step
            const isTargetStep = step.reg.source === '^the "([^"]*)" (.+)$';
            if (isTargetStep && stepText.includes('Chat Context Menu')) {
                console.log('    TARGET STEP FOUND, starting checks');
                console.log('    stepText:', stepText);
                console.log('    step.partialReg:', step.partialReg);
                console.log('    step.partialReg.source:', step.partialReg.source);
            }
            
            // Check Gherkin type matching
            if (strictGherkinCompletion && targetGherkinType !== GherkinType.Other) {
                if (step.gherkin !== targetGherkinType) {
                    if (stepText.includes('Chat Context Menu')) {
                        console.log('      rejected by gherkin type');
                    }
                    return false;
                }
            }

            // Check if step matches the entered text
            if (stepText.trim()) {
                // First check basic partial regex
                const partialRegTest = step.partialReg.test(stepText);
                if (stepText.includes('Chat Context Menu')) {
                    console.log('      partialReg test:', partialRegTest);
                    if (isTargetStep) {
                        console.log('      TARGET STEP partialReg test:', partialRegTest);
                        console.log('      partialReg.source:', step.partialReg.source);
                        console.log('      stepText:', stepText);
                    }
                }
                
                if (!partialRegTest) {
                    // Special handling for regex patterns with quoted parameters
                    // Try with original step text first (for complex regex patterns)
                    if (originalStepText && originalStepText !== stepText) {
                        const regexMatch = this.validateRegexStepMatch(originalStepText, step);
                        if (stepText.includes('Chat Context Menu')) {
                            console.log('      validateRegexStepMatch (originalStepText):', regexMatch);
                        }
                        if (!regexMatch) {
                            return false;
                        }
                    } else {
                        const regexMatch = this.validateRegexStepMatch(stepText, step);
                        if (stepText.includes('Chat Context Menu')) {
                            console.log('      validateRegexStepMatch (stepText):', regexMatch);
                        }
                        if (!regexMatch) {
                            return false;
                        }
                    }
                } else {
                    // Additional validation to prevent false positives
                    const stepMatch = this.validateStepMatch(stepText, step);
                    if (stepText.includes('Chat Context Menu')) {
                        console.log('      validateStepMatch:', stepMatch);
                    }
                    if (!stepMatch) {
                        return false;
                    }
                }
            }

            if (stepText.includes('Chat Context Menu')) {
                console.log('      step accepted');
            }
            return true;
        });
        
        // Debug logging for filtered result
        if (stepText.includes('Chat Context Menu')) {
            console.log('  filterCandidateSteps result count:', filteredResult.length);
            filteredResult.forEach((step, index) => {
                console.log(`    result ${index + 1}: ${step.text} (${step.reg.source})`);
            });
            
            // If no results, log why
            if (filteredResult.length === 0) {
                console.log('  NO RESULTS - debugging input params:');
                console.log('    stepText:', stepText);
                console.log('    originalStepText:', originalStepText);
                console.log('    targetGherkinType:', targetGherkinType);
                console.log('    strictGherkinCompletion:', strictGherkinCompletion);
            }
        }
        
        return filteredResult;
    }

    /**
     * Validate if a step with regex pattern matches the entered text
     * Handles cases like 'Then the "Chat Context Menu" ' matching '^the "([^"]*)" (.+)$'
     */
    private validateRegexStepMatch(stepText: string, step: Step): boolean {
        try {
            // Get the original regex pattern
            const regexSource = step.reg.source;
            
            // Debug logging
            if (stepText.includes('Chat Context Menu')) {
                console.log('DEBUG validateRegexStepMatch:');
                console.log('  stepText:', stepText);
                console.log('  regexSource:', regexSource);
                console.log('  step.text:', step.text);
                
                const result = this.matchesRegexStart(stepText, regexSource);
                console.log('  matchesRegexStart result:', result);
                
                return result;
            }
            
            // Simple approach: check if the entered text matches the beginning of the regex pattern
            // Handle common cases like 'the "([^"]*)" (.+)' with 'the "Chat Context Menu" '
            if (this.matchesRegexStart(stepText, regexSource)) {
                return true;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if the entered text matches the start of a regex pattern
     */
    private matchesRegexStart(stepText: string, regexSource: string): boolean {
        try {
            // Remove anchors
            let pattern = regexSource.replace(/^\^/, '').replace(/\$$/, '');
            
            // Debug logging
            if (stepText.includes('Chat Context Menu')) {
                console.log('DEBUG matchesRegexStart:');
                console.log('  original pattern:', regexSource);
                console.log('  pattern after anchor removal:', pattern);
                console.log('  ends with (.+):', pattern.endsWith('(.+)'));
            }
            
            // For patterns that end with (.+), we need to check if the text matches up to that point
            // Example: pattern = 'the "([^"]*)" (.+)' and stepText = 'the "Chat Context Menu" '
            
            // If pattern ends with (.+), remove it and make the match optional
            if (pattern.endsWith('(.+)')) {
                pattern = pattern.substring(0, pattern.length - 4); // Remove '(.+)'
                
                if (stepText.includes('Chat Context Menu')) {
                    console.log('  pattern after removing (.+):', pattern);
                }
                
                // Create a regex that matches the beginning part
                // Add optional trailing space for better matching
                const testRegex = new RegExp('^' + pattern + '\\s*', 'i');
                
                if (stepText.includes('Chat Context Menu')) {
                    console.log('  test regex:', testRegex);
                }
                
                // Test if the step text matches the pattern up to the (.+) part
                const matches = testRegex.test(stepText);
                
                if (stepText.includes('Chat Context Menu')) {
                    console.log('  matches:', matches);
                    if (!matches) {
                        console.log('  FAILED MATCH - debugging:');
                        console.log('    testRegex source:', testRegex.source);
                        console.log('    stepText:', JSON.stringify(stepText));
                        console.log('    stepText length:', stepText.length);
                        
                        // Try alternative approach for quoted parameters
                        const alternativeRegex = new RegExp('^' + pattern, 'i');
                        const alternativeMatches = alternativeRegex.test(stepText.trim());
                        console.log('    alternative matches (no trailing space):', alternativeMatches);
                        
                        if (alternativeMatches) {
                            return true;
                        }
                    }
                }
                
                return matches;
            }
            
            // For other patterns, replace (.+) with (.*) to allow partial matches
            pattern = pattern.replace(/\(\.\+\)/g, '(.*)');
            
            // Create a regex that matches the beginning of the step
            const testRegex = new RegExp('^' + pattern, 'i');
            
            // Test if the step text matches the pattern
            const matches = testRegex.test(stepText);
            
            return matches;
        } catch (e) {
            // If regex fails, return false
            return false;
        }
    }

    /**
     * Create a partial regex pattern that can match partially completed text
     */
    private createPartialRegexPattern(regexSource: string, stepText: string): string | null {
        // Remove ^ and $ anchors
        let pattern = regexSource.replace(/^\^/, '').replace(/\$$/, '');
        
        // For patterns with quoted parameters, try to match step by step
        // Example: 'the "([^"]*)" (.+)' with 'the "Chat Context Menu" '
        
        // Find quoted sections in the pattern
        const quoteMatches = pattern.match(/"\([^)]+\)"/g);
        if (quoteMatches) {
            // Try to match each quoted section
            let remainingText = stepText;
            let remainingPattern = pattern;
            
            for (const quoteMatch of quoteMatches) {
                // Find the position of this quote in the pattern
                const beforeQuote = remainingPattern.substring(0, remainingPattern.indexOf(quoteMatch));
                
                // Check if the text starts with the part before the quote
                if (beforeQuote && !remainingText.startsWith(beforeQuote)) {
                    return null;
                }
                
                // Skip the part before the quote
                remainingText = remainingText.substring(beforeQuote.length);
                remainingPattern = remainingPattern.substring(beforeQuote.length);
                
                // Look for the closing quote in the remaining text
                const quoteStart = remainingText.indexOf('"');
                if (quoteStart !== 0) {
                    return null;
                }
                
                const quoteEnd = remainingText.indexOf('"', 1);
                if (quoteEnd === -1) {
                    // Quote is not closed, allow partial matching
                    return '^' + pattern.substring(0, pattern.indexOf(quoteMatch) + quoteMatch.length - 1);
                }
                
                // Move past the quoted section
                remainingText = remainingText.substring(quoteEnd + 1);
                remainingPattern = remainingPattern.substring(quoteMatch.length);
            }
            
            // If we have remaining text, allow partial matching for the rest
            if (remainingText.trim()) {
                const trimmedText = remainingText.trim();
                // Create a pattern that allows partial matching
                return '^' + pattern + '|^' + stepText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
            
            // Text matches the pattern up to this point
            return '^' + stepText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        return null;
    }

    /**
     * Validate if a step truly matches the entered text
     * This prevents false positives from partial regex matching
     */
    private validateStepMatch(stepText: string, step: Step): boolean {
        // If stepText is empty or only whitespace, allow all steps
        if (!stepText.trim()) {
            return true;
        }
        
        // Special handling for text ending with quote followed by space or at end
        // This ensures completion works after patterns like 'I activate "' or 'I activate " '
        const endsWithQuote = /"\s*$/.test(stepText);
        
        if (endsWithQuote) {
            // Remove the quote and any trailing space for comparison
            const textWithoutQuote = stepText.replace(/"\s*$/, '').trim();
            if (textWithoutQuote) {
                const stepWords = step.text.split(/\s+/);
                const enteredWords = textWithoutQuote.split(/\s+/);
                
                // Check if entered words match the beginning of step
                for (let i = 0; i < enteredWords.length; i++) {
                    if (i >= stepWords.length) {
                        return false; // More entered words than step words
                    }
                    
                    const enteredWord = enteredWords[i];
                    const stepWord = stepWords[i];
                    
                    // Skip empty words
                    if (!enteredWord) {
                        continue;
                    }
                    
                    // For the last entered word, check if it's a prefix of the step word
                    if (i === enteredWords.length - 1) {
                        if (!stepWord.startsWith(enteredWord)) {
                            return false;
                        }
                    } else {
                        // For non-last words, they must match exactly
                        if (enteredWord !== stepWord) {
                            return false;
                        }
                    }
                }
                
                return true;
            }
        }
        
        const stepWords = step.text.split(/\s+/);
        const enteredWords = stepText.split(/\s+/);
        
        // Check if entered words match the beginning of step
        for (let i = 0; i < enteredWords.length; i++) {
            if (i >= stepWords.length) {
                return false; // More entered words than step words
            }
            
            const enteredWord = enteredWords[i];
            const stepWord = stepWords[i];
            
            // Skip empty words
            if (!enteredWord) {
                continue;
            }
            
            // For the last entered word, check if it's a prefix of the step word
            if (i === enteredWords.length - 1) {
                if (!stepWord.startsWith(enteredWord)) {
                    return false;
                }
            } else {
                // For non-last words, they must match exactly
                if (enteredWord !== stepWord) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Expand step variants for stepsInvariants
     */
    private expandStepVariants(step: Step): Step[] {
        if (!this.settings.stepsInvariants) {
            return [step];
        }

        const variants: Step[] = [];
        const orPattern = /\(([^)]+)\)/g;
        let match;
        const orGroups: Array<{match: string, options: string[]}> = [];

        // Find all OR groups
        while ((match = orPattern.exec(step.text)) !== null) {
            const options = match[1].split('|').map(opt => opt.trim());
            orGroups.push({
                match: match[0],
                options: options
            });
        }

        if (orGroups.length === 0) {
            return [step];
        }

        // Generate all combinations
        const generateCombinations = (text: string, groupIndex: number): string[] => {
            if (groupIndex >= orGroups.length) {
                return [text];
            }

            const group = orGroups[groupIndex];
            const results: string[] = [];
            
            for (const option of group.options) {
                const newText = text.replace(group.match, option);
                results.push(...generateCombinations(newText, groupIndex + 1));
            }
            
            return results;
        };

        const combinations = generateCombinations(step.text, 0);
        
        for (const combination of combinations) {
            const regText = this.getRegTextForStep(combination);
            const variant: Step = {
                ...step,
                text: combination,
                reg: this.getRegExpCached(regText),
                partialReg: this.getPartialRegExpCached(combination, regText)
            };
            variants.push(variant);
        }

        return variants;
    }

    /**
     * Get insert text for completion
     */
    private getInsertText(enteredText: string, step: Step, position: number): string | null {
        const stepText = step.text;
        
        // If entered text is empty, return full step
        if (!enteredText.trim()) {
            return this.processInsertText(stepText);
        }

        // Check if the step matches the entered text
        if (!step.partialReg.test(enteredText)) {
            return null;
        }

        // Find the common prefix
        const commonLength = this.getCommonPrefixLength(enteredText, stepText);
        if (commonLength >= stepText.length) {
            return null; // Step is already fully typed
        }

        // Return the remaining part
        const remainingText = stepText.substring(commonLength);
        return this.processInsertText(remainingText);
    }

    /**
     * Get common prefix length between entered text and step text
     */
    private getCommonPrefixLength(enteredText: string, stepText: string): number {
        const normalizedEntered = enteredText.trim().toLowerCase();
        const normalizedStep = stepText.trim().toLowerCase();
        
        // If entered text is empty, return 0
        if (!normalizedEntered) {
            return 0;
        }
        
        // Special handling for text ending with quote followed by space or at end
        // This ensures completion works after patterns like 'I activate "' or 'I activate " '
        const endsWithQuote = /"\s*$/.test(enteredText);
        
        if (endsWithQuote) {
            // Remove the quote and any trailing space for comparison
            const textWithoutQuote = enteredText.replace(/"\s*$/, '').trim();
            const normalizedWithoutQuote = textWithoutQuote.toLowerCase();
            
            // Check if step starts with the text before the quote
            if (normalizedWithoutQuote && normalizedStep.startsWith(normalizedWithoutQuote)) {
                return textWithoutQuote.length;
            }
        }
        
        // If step doesn't start with entered text, return 0
        if (!normalizedStep.startsWith(normalizedEntered)) {
            return 0;
        }
        
        // For very short entered text (like "I"), return full step instead of partial
        // But only if we're not looking for a specific completion and there's no space after
        if (normalizedEntered.length <= 1 && !enteredText.endsWith(' ')) {
            return 0;
        }
        
        // Use original entered text length, not normalized
        const commonLength = enteredText.length;
        
        // If the entered text ends with a space, use it as is
        if (enteredText.endsWith(' ')) {
            return commonLength;
        }
        
        // If we're at the end of the step text, use the full length
        if (commonLength >= normalizedStep.length) {
            return commonLength;
        }
        
        // If the next character in step is a space, include the space in common prefix
        if (normalizedStep[commonLength] === ' ') {
            return commonLength + 1;
        }
        
        // Find the last complete word boundary
        const lastSpaceIndex = normalizedEntered.lastIndexOf(' ');
        return lastSpaceIndex >= 0 ? lastSpaceIndex + 1 : 0;
    }

    /**
     * Process insert text with smart snippets or simple placeholders
     */
    private processInsertText(text: string): string {
        let result = text;
        let placeholderCounter = 1;

        // Handle specific patterns in order of specificity to avoid conflicts
        
        // 1. Parameter types
        result = result.replace(/\{string\}/g, '""');
        result = result.replace(/\{int\}/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\{float\}/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\{word\}/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\{\}/g, () => `\${${placeholderCounter++}:}`);
        
        // 2. Most specific: quoted strings with capturing groups containing character classes
        result = result.replace(/"\(\[\^"\]\*\)"/g, '""');
        result = result.replace(/"\(\[\^"\]\+\)"/g, '""');
        result = result.replace(/'\(\[\^']\*\)'/g, "''");
        result = result.replace(/'\(\[\^']\+\)'/g, "''");
        
        // 3. Character class patterns in capturing groups (without quotes)
        result = result.replace(/\(\[\^"\]\*\)/g, '""');
        result = result.replace(/\(\[\^"\]\+\)/g, '""');
        result = result.replace(/\(\[\^']\*\)/g, "''");
        result = result.replace(/\(\[\^']\+\)/g, "''");
        result = result.replace(/\(\[\^\\s\]\+\)/g, () => `\${${placeholderCounter++}:}`);
        
        // 4. Digit patterns in capturing groups
        result = result.replace(/\(\\d\+\)/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\(\\d\*\)/g, () => `\${${placeholderCounter++}:}`);
        
        // 5. Common regex patterns
        result = result.replace(/\(\.\*\?\)/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\(\.\*\)/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\(\.\+\?\)/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\(\.\+\)/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\(\\w\+\)/g, () => `\${${placeholderCounter++}:}`);
        
        // 6. Generic quoted strings (for any remaining cases)
        result = result.replace(/"([^"]*?)"/g, '""');
        result = result.replace(/'([^']*?)'/g, "''");
        
        // 7. Character classes without parentheses
        result = result.replace(/\[a-z\]\+/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\\w\*/g, () => `\${${placeholderCounter++}:}`);
        result = result.replace(/\[.*?\]/g, () => `\${${placeholderCounter++}:}`);
        
        // 8. Generic capturing groups (should be last)
        result = result.replace(/\(([^)]+)\)/g, () => `\${${placeholderCounter++}:}`);

        // Clean up any remaining regex artifacts
        result = result
            .replace(/\(\?:[^)]*\)/g, '') // Remove non-capturing groups (fixed colon escaping)
            .replace(/\\\./g, '.') // Unescape dots
            .replace(/\\\(/g, '(') // Unescape parentheses
            .replace(/\\\)/g, ')') // Unescape parentheses
            .replace(/\\\|/g, '|') // Unescape pipes
            .replace(/\\\+/g, '+') // Unescape plus
            .replace(/\\\*/g, '*') // Unescape asterisk
            .replace(/\\\?/g, '?') // Unescape question mark
            .replace(/\\\^/g, '^') // Unescape caret
            .replace(/\\\$/g, '$') // Unescape dollar
            .replace(/\\\[/g, '[') // Unescape square brackets
            .replace(/\\\]/g, ']') // Unescape square brackets
            .replace(/\\\{/g, '{') // Unescape curly brackets
            .replace(/\\\}/g, '}') // Unescape curly brackets
            .replace(/\\\\/g, '\\') // Unescape backslashes
            .replace(/"\?"/g, '""'); //Fix for "([^"]*)"

        return result;
    }

    /**
     * Create completion item
     */
    private createCompletionItem(step: Step, insertText: string): CompletionItem {
        return {
            label: step.text,
            kind: CompletionItemKind.Snippet,
            insertText: insertText,
            documentation: step.documentation || step.desc,
            sortText: getSortPrefix(step.count, 3) + step.text,
            data: {
                stepId: step.id,
                stepDef: step.def
            }
        };
    }

    /**
     * Legacy method for backward compatibility with tests
     */
    getCompletion(line: string, position: number, document: string): Array<{label: string, insertText: string, sortText: string}> | null {
        // Debug logging
        if (line.includes('Chat Context Menu')) {
            console.log('DEBUG getCompletion called with:', line);
        }
        
        const completionItems = this.getCompletionItems(line, position, document);
        
        if (line.includes('Chat Context Menu')) {
            console.log('DEBUG getCompletion items:', completionItems);
        }
        
        if (completionItems.length === 0) {
            return null;
        }
        
        return completionItems.map(item => ({
            label: item.label,
            insertText: item.insertText || '',
            sortText: item.sortText || ''
        }));
    }

    /**
     * Legacy method for backward compatibility with tests
     */
    getCompletionInsertText(regExpText: string, enteredText: string): string | null {
        // Find step with matching regex text by checking if the regex matches the original pattern
        const step = this.elements.find(s => {
            // Check if the step's regex source matches the expected pattern
            try {
                const stepRegSource = s.reg.source;
                const expectedRegSource = `^${regExpText}$`;
                return stepRegSource === expectedRegSource;
            } catch (e) {
                return false;
            }
        });
        
        if (!step) {
            return null;
        }
        
        return this.getInsertText(enteredText, step, 0);
    }

    /**
     * Legacy method for backward compatibility with tests
     */
    getCompletionOptimized(line: string, position: number, document: string): Promise<Array<{label: string, insertText: string, sortText: string}> | null> {
        return Promise.resolve(this.getCompletion(line, position, document));
    }

}
