import * as path from 'path';
import * as fs from 'fs';

import { workspace, ExtensionContext, commands, window, Uri, Position, Selection, Range } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Node server module
    const serverModule = context.asAbsolutePath(
        path.join('gserver', 'out', 'server.js')
    );

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
    // Register the server for Cucumber feature files
        documentSelector: [{ scheme: 'file', language: 'feature' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'cucumberautocomplete-client',
        'Cucumber auto complete plugin',
        serverOptions,
        clientOptions
    );

    // Register command for generating step definitions
    const generateStepDefinitionCommand = commands.registerCommand(
        'cucumberautocomplete.generateStepDefinition',
        async (documentUri: string, stepText: string, gherkinType: string) => {
            await handleGenerateStepDefinition(documentUri, stepText, gherkinType);
        }
    );

    context.subscriptions.push(generateStepDefinitionCommand);

    // Start the client. This will also launch the server
    client.start();
}

async function handleGenerateStepDefinition(documentUri: string, stepText: string, gherkinType: string) {
    try {
        // Request step definition files from server
        const response = await client.sendRequest('cucumberautocomplete/getStepDefinitionFiles');
        const stepFiles = response as Array<{label: string, path: string}>;
        
        if (stepFiles.length === 0) {
            window.showErrorMessage('No step definition files found. Please check your cucumberautocomplete.steps settings.');
            return;
        }

        // Show quick pick to select file
        const selectedFile = await window.showQuickPick(
            stepFiles.map(file => ({
                label: file.label,
                description: file.path,
                detail: 'Step definition file'
            })),
            {
                placeHolder: 'Select file to generate step definition',
                title: 'Generate Step Definition'
            }
        );

        if (!selectedFile) {
            return; // User cancelled
        }

        // Request step definition template from server
        const stepDefinition = await client.sendRequest('cucumberautocomplete/generateStepDefinition', {
            stepText,
            gherkinType
        });

        // Append step definition to selected file
        const filePath = selectedFile.description;
        const content = stepDefinition as string;
        
        // Read existing file content
        let existingContent = '';
        if (fs.existsSync(filePath)) {
            existingContent = fs.readFileSync(filePath, 'utf-8');
        }

        // Append new step definition with proper spacing
        const separator = existingContent.length > 0 ? '\n\n' : '';
        const newContent = existingContent + separator + content + '\n';
        
        // Write to file
        fs.writeFileSync(filePath, newContent, 'utf-8');

        // Open the file and show the generated step
        const document = await workspace.openTextDocument(filePath);
        const editor = await window.showTextDocument(document);
        
        // Jump to the generated step definition
        const lines = newContent.split('\n');
        const stepLineIndex = lines.findIndex(line => line.includes(stepText));
        if (stepLineIndex >= 0) {
            const position = new Position(stepLineIndex, 0);
            const selection = new Selection(position, position);
            editor.selection = selection;
            editor.revealRange(new Range(position, position));
        }

        window.showInformationMessage(`Step definition generated successfully in ${path.basename(filePath)}`);
        
    } catch (error) {
        console.error('Error generating step definition:', error);
        window.showErrorMessage(`Error generating step definition: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
