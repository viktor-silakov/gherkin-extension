import { getOSPath, getFileContent, clearComments, getMD5Id } from './util';

import {
    Definition,
    Position,
    Location,
    Range,
    Diagnostic,
    DiagnosticSeverity,
    TextEdit,
    CompletionItem,
    CompletionItemKind,
    Command,
} from 'vscode-languageserver';

import * as glob from 'glob';

import { Settings, PagesSettings } from './types';

export type Page = {
  id: string;
  text: string;
  desc: string;
  def: Definition;
  objects: PageObject[];
};

export type PageObject = {
  id: string;
  text: string;
  desc: string;
  def: Definition;
};

type FeaturePosition =
  | { page: string; object: string }
  | { page: string; object: null }
  | null;

export default class PagesHandler {
    elements: Page[] = [];

    constructor(root: string, settings: Settings) {
        this.populate(root, settings.pages);
    }

    getPageElement(page: string) {
        const pageElement = this.elements.find((e) => e.text === page);
        return pageElement || null;
    }

    getPageObjectElement(page: string, pageObject: string) {
        const pageElement = this.getPageElement(page);
        const pageObjectElement = pageElement?.objects.find(
            (e) => e.text === pageObject
        );
        return pageObjectElement || null;
    }

    getPoMatch(line: string) {
        return line.match(/^(?:(?:.*?[\s.])|.{0})([a-zA-z][^\s.]*)\s*[:=(]/);
    }

    getPageObjects(text: string, path: string) {
        const textArr = text.split(/\r?\n/g);
        return textArr.reduce((res, line, i) => {
            const poMatch = this.getPoMatch(line);
            if (poMatch) {
                const pos = Position.create(i, 0);
                const text = poMatch[1];
                if (!res.find((v) => v.text === text)) {
                    res.push({
                        id: 'pageObject' + getMD5Id(text),
                        text: text,
                        desc: line,
                        def: Location.create(getOSPath(path), Range.create(pos, pos)),
                    });
                }
            }
            return res;
        }, new Array<PageObject>());
    }

    getPage(name: string, path: string) {
        const files = glob.sync(path);
        if (files.length) {
            const file = files[0];
            const text = clearComments(getFileContent(files[0]));
            const zeroPos = Position.create(0, 0);
            return {
                id: 'page' + getMD5Id(name),
                text: name,
                desc: text.split(/\r?\n/g).slice(0, 10).join('\r\n'),
                def: Location.create(getOSPath(file), Range.create(zeroPos, zeroPos)),
                objects: this.getPageObjects(text, file),
            };
        }
        return null;
    }

    populate(root: string, settings: PagesSettings) {
        this.elements = Object.keys(settings).reduce((res, p) => {
            const page = this.getPage(p, root + '/' + settings[p]);
            page && res.push(page);
            return res;
        }, new Array<Page>());
    }

    validate(line: string, lineNum: number) {
        if (~line.search(/"[^"]*"."[^"]*"/)) {
            return line.split('"').reduce((res, l, i, lineArr) => {
                if (l === '.') {
                    const curr = lineArr
                        .slice(0, i)
                        .reduce((a, b, j) => a + b.length + 1, 0);
                    const page = lineArr[i - 1];
                    const pageObject = lineArr[i + 1];
                    if (!this.getPageElement(page)) {
                        res.push({
                            severity: DiagnosticSeverity.Warning,
                            range: {
                                start: { line: lineNum, character: curr - page.length - 1 },
                                end: { line: lineNum, character: curr - 1 },
                            },
                            message: `Was unable to find page "${page}"`,
                            source: 'cucumberautocomplete',
                        });
                    } else if (!this.getPageObjectElement(page, pageObject)) {
                        res.push({
                            severity: DiagnosticSeverity.Warning,
                            range: {
                                start: { line: lineNum, character: curr + 2 },
                                end: {
                                    line: lineNum,
                                    character: curr + 3 + pageObject.length - 1,
                                },
                            },
                            message: `Was unable to find page object "${pageObject}" for page "${page}"`,
                            source: 'cucumberautocomplete',
                        });
                    }
                }
                return res;
            }, new Array<Diagnostic>());
        } else {
            return [];
        }
    }

    getFeaturePosition(line: string, char: number) {
        const startLine = line.slice(0, char);
        const endLine = line.slice(char).replace(/".*/, '');
        const match = startLine.match(/"/g);
        if (match && match.length % 2) {
            const [, page, object] =
        startLine.match(/"(?:([^"]*)"\.")?([^"]*)$/) || [];
            if (page) {
                return {
                    page: page,
                    object: object + endLine,
                };
            }
            return {
                page: object + endLine,
            };
        } else {
            return null;
        }
    }

    getDefinition(line: string, char: number): Definition | null {
        const position = this.getFeaturePosition(line, char);
        if (position) {
            if (position.object) {
                const el = this.getPageObjectElement(
                    position['page'],
                    position['object']
                );
                return el ? el.def : null;
            } else {
                const el = this.getPageElement(position['page']);
                return el ? el.def : null;
            }
        } else {
            return null;
        }
    }

    getCompletion(line: string, position: Position): CompletionItem[] | null {
        const featurePosition = this.getFeaturePosition(line, position.character);
        if (!featurePosition) {
            return null;
        }

        const completionItems: CompletionItem[] = [];

        if (featurePosition.object !== undefined) {
            // We're completing a page object
            const page = this.getPageElement(featurePosition.page);
            if (page) {
                const enteredText = featurePosition.object || '';
                const matchingObjects = page.objects.filter(obj => 
                    obj.text.startsWith(enteredText)
                );
                
                for (const obj of matchingObjects) {
                    const insertText = obj.text.substring(enteredText.length);
                    const item: CompletionItem = {
                        label: obj.text,
                        kind: CompletionItemKind.Property,
                        documentation: obj.desc,
                        data: obj.id
                    };
                    
                    // Handle insertText based on line ending
                    if (line.endsWith('"."')) {
                        // Standard case like "page"."" 
                        item.insertText = insertText;
                    } else if (line.endsWith('."')) {
                        // Smart case like "page"."a" needs to add '" '
                        item.insertText = insertText + '" ';
                    } else {
                        item.insertText = insertText;
                    }
                    
                    completionItems.push(item);
                }
            }
        } else {
            // We're completing a page
            const enteredText = featurePosition.page || '';
            const matchingPages = this.elements.filter(page => 
                page.text.startsWith(enteredText)
            );
            
            for (const page of matchingPages) {
                const insertText = page.text.substring(enteredText.length);
                const item: CompletionItem = {
                    label: page.text,
                    kind: CompletionItemKind.Module,
                    documentation: page.desc,
                    data: page.id
                };
                
                // Handle different cases
                if (line.endsWith('"."')) {
                    // Standard case like "".""
                    // No insertText property
                } else if (line.endsWith('"')) {
                    // Smart case like ""
                    item.insertText = insertText + '".';
                    item.command = {
                        title: 'Suggest page objects',
                        command: 'editor.action.triggerSuggest'
                    };
                } else {
                    item.insertText = insertText;
                }
                
                completionItems.push(item);
            }
        }

        return completionItems.length > 0 ? completionItems : null;
    }


}
