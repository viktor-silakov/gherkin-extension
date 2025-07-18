import * as glob from 'glob';
import * as fs from 'fs';

import {
    createConnection,
    TextDocuments,
    InitializeResult,
    Diagnostic,
    TextDocumentPositionParams,
    Range,
    Position,
    DocumentFormattingParams,
    TextEdit,
    DocumentRangeFormattingParams,
    FormattingOptions,
    Location,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    DocumentDiagnosticReportKind,
    DocumentDiagnosticReport,
    CodeActionParams,
    CodeAction,
    CodeActionKind,
    Command,
    CompletionParams,
    CompletionItem,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { format, clearText } from './format';
import StepsHandler from './steps.handler';
import PagesHandler from './pages.handler';
import { getOSPath, clearGherkinComments } from './util';
import { Settings, BaseSettings } from './types';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

//Path to the root of our workspace
let workspaceRoot: string;
// Object, which contains current configuration
let globalSettings: Settings | undefined;
// Elements handlers
let stepsHandler: StepsHandler;
let pagesHandler: PagesHandler;

connection.onInitialize((params: InitializeParams) => {
    workspaceRoot = params.rootPath || '';

    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            // Full text sync mode
            textDocumentSync: TextDocumentSyncKind.Full,
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
            },
            definitionProvider: true,
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            documentOnTypeFormattingProvider: {
                firstTriggerCharacter: ' ',
                moreTriggerCharacter: ['@', '#', ':'],
            },
            codeActionProvider: {
                codeActionKinds: [CodeActionKind.QuickFix]
            },
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: [' ', '"', "'"]
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

async function getSettings(forceReset?: boolean) {
    if (!globalSettings || forceReset) {
        const baseSettings = await connection.workspace.getConfiguration({
            section: 'cucumberautocomplete'
        });
        globalSettings = getSettingsFromBase(baseSettings);
    }
    return globalSettings;
}

function shouldHandleSteps(settings: Settings) {
    const s = settings.steps;
    return s && s.length ? true : false;
}

function shouldHandlePages(settings: Settings) {
    const p = settings.pages;
    return p && Object.keys(p).length ? true : false;
}



async function revalidateAllDocuments() {
    connection.languages.diagnostics.refresh();
}

function watchStepsFiles(settings: Settings) {    
    settings.steps.forEach((path) => {
        glob
            .sync(workspaceRoot + '/' + path, { ignore: '.gitignore' })
            .forEach((f) => {
                fs.unwatchFile(f);
                fs.watchFile(f, async () => {
                    const settings = await getSettings();
                    populateHandlers(settings);
                    revalidateAllDocuments();
                });
            });
    });
}

function getStepsArray(steps: BaseSettings['steps']) {
    // Set empty array as steps if they were not provided
    if (!steps) {
        return [];
    } 
    if (Array.isArray(steps)) {
        return steps;
    }
    return [steps];
}

function getSettingsFromBase(baseSettings: BaseSettings) {
    const settings: Settings = {
        ...baseSettings,
        steps: getStepsArray(baseSettings.steps),
        pages: baseSettings.pages || {},
    };
    return settings;
}

function initStepsAndPagesSetup(settings: Settings) {
    watchStepsFiles(settings);
    initHandlers(settings);
    populateHandlers(settings);
    validateStepsConfiguration(settings);
}

function validateStepsConfiguration(settings: Settings) {
    const { steps } = settings;
    if (shouldHandleSteps(settings)) {
        const sFile = '.vscode/settings.json';
        const diagnostics = stepsHandler.validateConfiguration(
            sFile,
            steps,
            workspaceRoot
        );
        connection.sendDiagnostics({
            uri: getOSPath(workspaceRoot + '/' + sFile),
            diagnostics,
        });
    }
}

connection.onDidChangeConfiguration(async (change) => {
    const settings = await getSettings(true);
    // TODO - should we check that our settings were changed before do this?
    initStepsAndPagesSetup(settings);
    revalidateAllDocuments();
});

function initHandlers(settings: Settings) {
    if (shouldHandleSteps(settings)) {
        stepsHandler = new StepsHandler(workspaceRoot, settings);
    }
    if (shouldHandlePages(settings)) {
        pagesHandler = new PagesHandler(workspaceRoot, settings);
    }
}

function populateHandlers(settings: Settings) {
    if (shouldHandleSteps(settings)) {
        stepsHandler?.populate(workspaceRoot, settings.steps);
    }
    if (shouldHandlePages(settings)) {
        pagesHandler?.populate(workspaceRoot, settings.pages);
    }
}

documents.onDidOpen(async () => {
    const settings = await getSettings(true);
    initStepsAndPagesSetup(settings);
});





function validate(text: string, settings: Settings) {
    return text.split(/\r?\n/g).reduce((res, line, i) => {
        let diagnostic;
        if (
            shouldHandleSteps(settings) &&
      stepsHandler &&
      (diagnostic = stepsHandler.validate(line, i, text))
        ) {
            res.push(diagnostic);
        } else if (shouldHandlePages(settings) && pagesHandler) {
            const pagesDiagnosticArr = pagesHandler.validate(line, i);
            res = res.concat(pagesDiagnosticArr);
        }
        return res;
    }, [] as Diagnostic[]);
}

connection.languages.diagnostics.on(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (document !== undefined) {
        const settings = await getSettings();
        const text = document.getText();
        const diagnostics = validate(clearGherkinComments(text), settings);
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: diagnostics,
        } satisfies DocumentDiagnosticReport;
    } else {
        // We don't know the document. We can either try to read it from disk
        // or we don't report problems for it.
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: []
        } satisfies DocumentDiagnosticReport;
    }
});

connection.onDefinition(async (position: TextDocumentPositionParams) => {
    const settings = await getSettings();
    const textDocument = documents.get(position.textDocument.uri);
    const text = textDocument?.getText() || '';
    const line = text.split(/\r?\n/g)[position.position.line];
    const char = position.position.character;
    const pos = position.position;
    const { uri } = position.textDocument;
    if (shouldHandlePages(settings) && pagesHandler && pagesHandler.getFeaturePosition(line, char)) {
        return pagesHandler.getDefinition(line, char);
    }
    if (shouldHandleSteps(settings) && stepsHandler) {
        return stepsHandler.getDefinition(line, text);
    }
    return Location.create(uri, Range.create(pos, pos));
});

connection.onCompletion(async (params: CompletionParams) => {
    const settings = await getSettings();
    const textDocument = documents.get(params.textDocument.uri);
    
    if (!textDocument || !shouldHandleSteps(settings) || !stepsHandler) {
        return [];
    }
    
    const text = textDocument.getText();
    const line = text.split(/\r?\n/g)[params.position.line];
    const character = params.position.character;
    
    return stepsHandler.getCompletionItems(line, character, text);
});

connection.onCodeAction(async (params: CodeActionParams) => {
    const settings = await getSettings();
    const { textDocument, range, context } = params;
    const document = documents.get(textDocument.uri);
    
    if (!document || !shouldHandleSteps(settings) || !stepsHandler) {
        return [];
    }

    const codeActions: CodeAction[] = [];
    
    // Look for diagnostics about undefined steps
    const diagnostics = context.diagnostics.filter(
        d => d.source === 'cucumberautocomplete' && 
             d.message.includes('Was unable to find step for')
    );

    for (const diagnostic of diagnostics) {
        const text = document.getText();
        const lines = text.split(/\r?\n/g);
        const line = lines[diagnostic.range.start.line];
        
        const match = stepsHandler.getGherkinMatch(line, text);
        if (match) {
            const stepText = match[4];
            const gherkinType = match[2];
            
            // Create code action for generating step definition
            const codeAction: CodeAction = {
                title: `Generate step definition for "${stepText}"`,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                command: {
                    title: 'Generate Step Definition',
                    command: 'cucumberautocomplete.generateStepDefinition',
                    arguments: [textDocument.uri, stepText, gherkinType]
                }
            };
            
            codeActions.push(codeAction);
        }
    }

    return codeActions;
});

// Custom request handlers for step definition generation
connection.onRequest('cucumberautocomplete/getStepDefinitionFiles', async () => {
    const settings = await getSettings();
    if (!shouldHandleSteps(settings) || !stepsHandler) {
        return [];
    }
    
    return stepsHandler.getStepDefinitionFiles();
});

connection.onRequest('cucumberautocomplete/generateStepDefinition', async (params: {stepText: string, gherkinType: string}) => {
    const settings = await getSettings();
    if (!shouldHandleSteps(settings) || !stepsHandler) {
        return '';
    }
    
    return stepsHandler.generateStepDefinition(params.stepText, params.gherkinType);
});

function getIndent(options: FormattingOptions) {
    const { insertSpaces, tabSize } = options;
    return insertSpaces ? ' '.repeat(tabSize) : '\t';
}

connection.onDocumentFormatting(
    async (params: DocumentFormattingParams) => {
        const settings = await getSettings();
        const textDocument = documents.get(params.textDocument.uri);
        const text = textDocument?.getText() || '';
        const textArr = text.split(/\r?\n/g);
        const indent = getIndent(params.options);
        const range = Range.create(
            Position.create(0, 0),
            Position.create(textArr.length - 1, textArr[textArr.length - 1].length)
        );
        const formattedText = format(indent, text, settings);
        const clearedText = clearText(formattedText);
        return [TextEdit.replace(range, clearedText)];
    }
);

connection.onDocumentRangeFormatting(
    async (params: DocumentRangeFormattingParams) => {
        const settings = await getSettings();
        const textDocument = documents.get(params.textDocument.uri);
        const text = textDocument?.getText() || '';
        const textArr = text.split(/\r?\n/g);
        const range = params.range;
        const indent = getIndent(params.options);
        const finalRange = Range.create(
            Position.create(range.start.line, 0),
            Position.create(range.end.line, textArr[range.end.line].length)
        );
        const finalText = textArr
            .splice(
                finalRange.start.line,
                finalRange.end.line - finalRange.start.line + 1
            )
            .join('\r\n');
        const formattedText = format(indent, finalText, settings);
        const clearedText = clearText(formattedText);
        return [TextEdit.replace(finalRange, clearedText)];
    }
);

connection.onDocumentOnTypeFormatting(
    async (params: DocumentFormattingParams) => {
        const settings = await getSettings();
        if (settings.onTypeFormat === true) {
            const textDocument = documents.get(params.textDocument.uri);
            const text = textDocument?.getText() || '';
            const textArr = text.split(/\r?\n/g);
            const indent = getIndent(params.options);
            const range = Range.create(
                Position.create(0, 0),
                Position.create(textArr.length - 1, textArr[textArr.length - 1].length)
            );
            const formattedText = format(indent, text, settings);
            return [TextEdit.replace(range, formattedText)];
        } else {
            return [];
        }
    }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
