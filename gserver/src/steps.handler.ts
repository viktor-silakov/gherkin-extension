import * as glob from 'glob';
import * as commentParser from 'doctrine';

import {
    Definition,
    CompletionItem,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Location,
    Range,
    CompletionItemKind,
    InsertTextFormat,
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

    // Кэши для оптимизации производительности
    private regexCache = new Map<string, RegExp>();
    private partialRegexCache = new Map<string, RegExp>();
    private processedStepCache = new Map<string, string>();
    private stepsByGherkin = new Map<GherkinType, Step[]>();
    private stepsByPrefix = new Map<string, Step[]>();

    // Дебаунсинг для автокомплита
    private debounceTimer: NodeJS.Timeout | null = null;
    private static readonly DEFAULT_DEBOUNCE_DELAY = 100; // ms
    private static readonly DEFAULT_MAX_COMPLETION_ITEMS = 50;

    // Кэшированная версия создания RegExp
    private getRegExpCached(regText: string): RegExp {
        if (this.settings.enableRegexCaching && this.regexCache.has(regText)) {
            return this.regexCache.get(regText)!;
        }

        const regex = new RegExp(regText);
        if (this.settings.enableRegexCaching) {
            this.regexCache.set(regText, regex);
        }
        return regex;
    }

    // Кэшированная версия partial RegExp
    private getPartialRegExpCached(step: string): RegExp {
        if (this.settings.enableRegexCaching && this.partialRegexCache.has(step)) {
            return this.partialRegexCache.get(step)!;
        }

        try {
            const partialRegText = this.getPartialRegText(step);
            const regex = new RegExp(partialRegText);
            if (this.settings.enableRegexCaching) {
                this.partialRegexCache.set(step, regex);
            }
            return regex;
        } catch (err) {
            // Fallback to main regex
            const regText = this.getRegTextForStepCached(step);
            const regex = this.getRegExpCached(regText);
            if (this.settings.enableRegexCaching) {
                this.partialRegexCache.set(step, regex);
            }
            return regex;
        }
    }

    // Очистка всех кэшей
    private clearCaches(): void {
        this.regexCache.clear();
        this.partialRegexCache.clear();
        this.processedStepCache.clear();
        this.stepsByGherkin.clear();
        this.stepsByPrefix.clear();
    }

    constructor(root: string, settings: Settings) {
        const { syncfeatures, steps } = settings;
        this.settings = settings;
        
        // Применяем настройки оптимизации по умолчанию
        if (this.settings.enablePerformanceOptimizations !== false) {
            this.settings.enablePerformanceOptimizations = true;
            this.settings.maxCompletionItems = this.settings.maxCompletionItems || StepsHandler.DEFAULT_MAX_COMPLETION_ITEMS;
            this.settings.debounceDelay = this.settings.debounceDelay || StepsHandler.DEFAULT_DEBOUNCE_DELAY;
            this.settings.enableRegexCaching = this.settings.enableRegexCaching !== false;
            this.settings.enableStepIndexing = this.settings.enableStepIndexing !== false;
        }
        
        this.populate(root, steps);
        if (syncfeatures === true) {
            this.setElementsHash(`${root}/**/*.feature`);
        } else if (typeof syncfeatures === 'string') {
            this.setElementsHash(`${root}/${syncfeatures}`);
        }
        
        if (this.settings.enableStepIndexing) {
            this.buildIndices();
        }
    }

    // Построение индексов для быстрого поиска
    private buildIndices(): void {
        this.stepsByGherkin.clear();
        this.stepsByPrefix.clear();

        this.elements.forEach(step => {
            // Индекс по типу Gherkin
            const gherkinSteps = this.stepsByGherkin.get(step.gherkin) || [];
            gherkinSteps.push(step);
            this.stepsByGherkin.set(step.gherkin, gherkinSteps);

            // Индекс по префиксу (первые 3 символа)
            const prefix = step.text.substring(0, 3).toLowerCase();
            const prefixSteps = this.stepsByPrefix.get(prefix) || [];
            prefixSteps.push(step);
            this.stepsByPrefix.set(prefix, prefixSteps);
        });
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
    // But we should not touch /()/ RegEx elements
        text = this.settings.pureTextSteps
            ? this.getRegTextForPureStep(text)
            : this.getRegTextForStep(text);
        let currString = '';
        let bracesMode = false;
        let openingBracesNum = 0;
        let closingBracesNum = 0;
        const res = [];
        for (let i = 0; i <= text.length; i++) {
            const currSymbol = text[i];
            if (i === text.length) {
                res.push(currString);
            } else if (bracesMode) {
                //We should do this hard check to avoid circular braces errors
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
                } else {
                    currString += currSymbol;
                }
            }
        }
        return res;
    }

    getPartialRegText(regText: string): string {
    //Same with main reg, only differ is match any string that same or less that current one
        return this.getPartialRegParts(regText)
            .map((el) => `(${el}|$)`)
            .join('( |$)')
            .replace(/^\^|^/, '^');
    }

    getTextForStep(step: string): string {
    //Remove all the backslashes
        step = step.replace(/\\/g, '');

        //Remove "string start" and "string end" RegEx symbols
        step = step.replace(/^\^|\$$/g, '');

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

    getCompletionInsertText(step: string, stepPart: string): string {
    // Return only part we need for our step
        let res = step;
        const strArray = this.getPartialRegParts(res);
        const currArray = new Array<string>();
        const { length } = strArray;
        for (let i = 0; i < length; i++) {
            currArray.push(strArray.shift()!);
            try {
                const r = new RegExp('^' + escapeRegExp(currArray.join(' ')));
                if (!r.test(stepPart)) {
                    res = new Array<string>()
                        .concat(currArray.slice(-1), strArray)
                        .join(' ');
                    break;
                }
            } catch (err) {
                //TODO - show some warning
            }
        }

        if (this.settings.smartSnippets) {
            /*
                Now we should change all the 'user input' items to some snippets
                Create our regexp for this:
                1) \(? - we be started from opening brace
                2) \\.|\[\[^\]]\] - [a-z] or \w or .
                3) \*|\+|\{[^\}]+\} - * or + or {1, 2}
                4) \)? - could be finished with opening brace
            */
            const match = res.match(
                /((?:\()?(?:\\.|\.|\[[^\]]+\])(?:\*|\+|\{[^}]+\})(?:\)?))/g
            );
            if (match) {
                for (let i = 0; i < match.length; i++) {
                    const num = i + 1;
                    res = res.replace(match[i], () => '${' + num + ':}');
                }
            }
        } else {
            //We can replace some outputs, ex. strings in brackets to make insert strings more neat
            res = res.replace(/"\[\^"\]\+"/g, '""');
        }

        if (this.settings.pureTextSteps) {
            // Replace all the escape chars for now
            res = res.replace(/\\/g, '');
            // Also remove start and end of the string - we don't need them in the completion
            res = res.replace(/^\^/, '');
            res = res.replace(/\$$/, '');
        }

        return res;
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
                const partialReg = this.getPartialRegExpCached(step);
                
                //Todo we should store full value here
                const text = this.settings.pureTextSteps
                    ? step
                    : this.getTextForStep(step);
                const id = 'step' + getMD5Id(text);
                const count = this.getElementCount(id);
                return {
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
                    
                    // Use original line number for position and comment lookup
                    const originalLineIndex = lineMapping[lineIndex] !== undefined ? lineMapping[lineIndex] : lineIndex;
                    const pos = Position.create(originalLineIndex, beforeGherkin.length);
                    const def = Location.create(
                        getOSPath(filePath),
                        Range.create(pos, pos)
                    );
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

        if (this.settings.enableStepIndexing) {
            this.buildIndices();
        }
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

    // Оптимизированный метод автокомплита с дебаунсингом
    getCompletionOptimized(
        line: string,
        lineNumber: number,
        text: string
    ): Promise<CompletionItem[] | null> {
        return new Promise((resolve) => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(() => {
                resolve(this.getCompletionSync(line, lineNumber, text));
            }, this.settings.debounceDelay || StepsHandler.DEFAULT_DEBOUNCE_DELAY);
        });
    }

    // Синхронная версия автокомплита с оптимизациями
    private getCompletionSync(
        line: string,
        lineNumber: number,
        text: string
    ): CompletionItem[] | null {
        const match = this.getGherkinMatch(line, text);
        if (!match) {
            return null;
        }

        const [, , gherkinPart, , stepPartBase] = match;
        let stepPart = stepPartBase || '';
        stepPart = stepPart.replace(/[^\s]+$/, '');

        // Получаем релевантные steps через индексы (если включено индексирование)
        let candidateSteps: Step[] = [];

        if (this.settings.enableStepIndexing) {
            if (this.settings.strictGherkinCompletion) {
                const strictGherkinPart = this.getStrictGherkinType(
                    gherkinPart,
                    lineNumber,
                    text
                );
                candidateSteps = this.stepsByGherkin.get(strictGherkinPart) || [];
            } else {
                // Используем индекс по префиксу для ускорения поиска
                const prefix = stepPart.trim().substring(0, 3).toLowerCase();
                if (prefix.length >= 3) {
                    candidateSteps = this.stepsByPrefix.get(prefix) || this.elements;
                } else {
                    candidateSteps = this.elements;
                }
            }
        } else {
            // Оригинальная логика без индексирования
            candidateSteps = this.elements.filter((step) => {
                if (this.settings.strictGherkinCompletion) {
                    const strictGherkinPart = this.getStrictGherkinType(
                        gherkinPart,
                        lineNumber,
                        text
                    );
                    return step.gherkin === strictGherkinPart;
                } else {
                    return true;
                }
            });
        }

        // Фильтрация и маппинг с ограничением количества результатов
        const results = candidateSteps
            .filter((step) => {
                try {
                    return step.partialReg.test(stepPart);
                } catch {
                    return false;
                }
            })
            .sort((a, b) => b.count - a.count) // Сортировка по частоте использования
            .slice(0, this.settings.maxCompletionItems || StepsHandler.DEFAULT_MAX_COMPLETION_ITEMS)
            .map((step) => ({
                label: step.text,
                kind: CompletionItemKind.Snippet,
                data: step.id,
                documentation: step.documentation,
                sortText: getSortPrefix(step.count, 5) + '_' + step.text,
                insertText: this.getCompletionInsertText(step.text, stepPart),
                insertTextFormat: InsertTextFormat.Snippet,
            }));

        return results.length ? results : null;
    }

    getCompletion(
        line: string,
        lineNumber: number,
        text: string
    ): CompletionItem[] | null {
        // Используем синхронную версию для обратной совместимости
        return this.getCompletionSync(line, lineNumber, text);
    }

    getCompletionResolve(item: CompletionItem): CompletionItem {
        this.incrementElementCount(item.data);
        return item;
    }
}
