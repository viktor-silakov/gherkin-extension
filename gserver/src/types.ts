export type StepSettings = string[];

export type PagesSettings = {
    [page: string]: string
};

export type CustomParameter = {
    parameter: string | RegExp,
    value: string
};

type FormatConfVal = number | 'relative' | 'relativeUp';

export interface FormatConf {
    [key: string]: FormatConfVal
}

export interface BaseSettings {
    steps?: StepSettings,
    pages?: PagesSettings,
    syncfeatures?: boolean | string,
    strictGherkinValidation?: boolean,
    stepsInvariants?: boolean,
    customParameters?: CustomParameter[],
    skipDocStringsFormat?: boolean,
    formatConfOverride?: FormatConf,
    onTypeFormat?: boolean,
    gherkinDefinitionPart?: string,
    stepRegExSymbol?: string
    pureTextSteps?: boolean,
    // Step template settings
    stepTemplate?: string,
    // Настройки оптимизации производительности
    enablePerformanceOptimizations?: boolean,
    enableRegexCaching?: boolean,
    enableCompletionCaching?: boolean,
    // Autocompletion settings
    strictGherkinCompletion?: boolean,
}

export interface Settings {
    steps: StepSettings,
    pages: PagesSettings,
    syncfeatures?: boolean | string,
    strictGherkinValidation?: boolean,
    stepsInvariants?: boolean,
    customParameters?: CustomParameter[],
    skipDocStringsFormat?: boolean,
    formatConfOverride?: FormatConf,
    onTypeFormat?: boolean,
    gherkinDefinitionPart?: string,
    stepRegExSymbol?: string
    pureTextSteps?: boolean,
    // Step template settings
    stepTemplate?: string,
    // Настройки оптимизации производительности
    enablePerformanceOptimizations?: boolean,
    enableRegexCaching?: boolean,
    enableCompletionCaching?: boolean,
    // Autocompletion settings
    strictGherkinCompletion?: boolean,
}
