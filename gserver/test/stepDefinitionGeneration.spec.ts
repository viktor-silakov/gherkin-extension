import StepsHandler from '../src/steps.handler';
import { GherkinType } from '../src/gherkin';
import * as fs from 'fs';
import * as path from 'path';

const testSettings = {
    steps: ['/data/steps/*.js', '/data/steps/*.ts'],
    pages: {},
    syncfeatures: false,
    smartSnippets: false,
    stepsInvariants: false,
    strictGherkinCompletion: false,
    customParameters: [],
    enablePerformanceOptimizations: true,
    enableRegexCaching: true,
    enableStepIndexing: true
};

describe('Step Definition Generation', () => {
    let stepsHandler: StepsHandler;

    beforeEach(() => {
        stepsHandler = new StepsHandler(__dirname, testSettings);
    });

    describe('Language Detection', () => {
        it('should detect JavaScript from .js patterns', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.js']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('Given(');
            expect(stepDef).toContain('async ({page}) =>');
        });

        it('should detect TypeScript from .ts patterns', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.ts']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('Given(');
            expect(stepDef).toContain('async ({page}) =>');
        });

        it('should detect Ruby from .rb patterns', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.rb']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('given(');
            expect(stepDef).toContain('do');
            expect(stepDef).toContain('end');
        });

        it('should detect Java from .java patterns', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.java']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('@Given');
            expect(stepDef).toContain('public void');
        });
    });

    describe('Step Text to Parameter Types Conversion', () => {
        it('should convert quoted strings to {string} parameter type', () => {
            const stepDef = stepsHandler.generateStepDefinition('I enter "test value" in field', 'When');
            expect(stepDef).toContain('I enter {string} in field');
        });

        it('should convert single quoted strings to {string} parameter type', () => {
            const stepDef = stepsHandler.generateStepDefinition("I enter 'test value' in field", 'When');
            expect(stepDef).toContain('I enter {string} in field');
        });

        it('should convert numbers to {int} parameter type', () => {
            const stepDef = stepsHandler.generateStepDefinition('I wait 5 seconds', 'When');
            expect(stepDef).toContain('I wait {int} seconds');
        });

        it('should convert floating point numbers to {float} parameter type', () => {
            const stepDef = stepsHandler.generateStepDefinition('I wait 5.5 seconds', 'When');
            expect(stepDef).toContain('I wait {float} seconds');
        });

        it('should handle mixed patterns', () => {
            const stepDef = stepsHandler.generateStepDefinition('I enter "test" and wait 10 seconds', 'When');
            expect(stepDef).toContain('I enter {string} and wait {int} seconds');
        });

        it('should preserve text without parameters', () => {
            const stepDef = stepsHandler.generateStepDefinition('I click on button', 'When');
            expect(stepDef).toContain('I click on button');
        });
    });

    describe('Step Definition Templates', () => {
        it('should generate JavaScript template', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.js']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            
            expect(stepDef).toContain('Given(');
            expect(stepDef).toContain('async ({page}) =>');
            expect(stepDef).toContain('// TODO: implement step');
            expect(stepDef).toContain('throw new Error(\'Step not implemented\')');
        });

        it('should generate TypeScript template', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.ts']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            
            expect(stepDef).toContain('Given(');
            expect(stepDef).toContain('async ({page}) =>');
            expect(stepDef).toContain('// TODO: implement step');
            expect(stepDef).toContain('throw new Error(\'Step not implemented\')');
        });

        it('should normalize gherkin types to lowercase', () => {
            const stepDef = stepsHandler.generateStepDefinition('I do something', 'GIVEN');
            expect(stepDef).toContain('Given(');
        });

        it('should handle different gherkin types', () => {
            const givenStep = stepsHandler.generateStepDefinition('I have something', 'Given');
            const whenStep = stepsHandler.generateStepDefinition('I do something', 'When');
            const thenStep = stepsHandler.generateStepDefinition('I see something', 'Then');
            
            expect(givenStep).toContain('Given(');
            expect(whenStep).toContain('When(');
            expect(thenStep).toContain('Then(');
        });

        it('should generate parameters for JS/TS steps with parameter types', () => {
            const stepDef = stepsHandler.generateStepDefinition('I enter "value" and wait 5 seconds', 'Given');
            
            expect(stepDef).toContain('Given(\'I enter {string} and wait {int} seconds\', async ({page}, str1, int1) => {');
            expect(stepDef).toContain('// TODO: implement step');
        });

        it('should generate no additional parameters for steps without parameter types', () => {
            const stepDef = stepsHandler.generateStepDefinition('I click button', 'When');
            
            expect(stepDef).toContain('When(\'I click button\', async ({page}) => {');
            expect(stepDef).not.toContain('str1');
        });

        it('should generate typed parameters for complex steps', () => {
            const stepDef = stepsHandler.generateStepDefinition('I activate2 "feature" for 5 second and 3 times', 'When');
            
            expect(stepDef).toContain('When(\'I activate2 {string} for {int} second and {int} times\', async ({page}, str1, int1, int2) => {');
            expect(stepDef).toContain('// TODO: implement step');
        });

        it('should generate appropriate parameter names for different types', () => {
            const stepDef = stepsHandler.generateStepDefinition('I wait 2.5 seconds and enter "value" in "field"', 'Given');
            
            expect(stepDef).toContain('Given(\'I wait {float} seconds and enter {string} in {string}\', async ({page}, float1, str1, str2) => {');
            expect(stepDef).toContain('// TODO: implement step');
        });
    });

    describe('Step Definition Files', () => {
        it('should return available step definition files', () => {
            const files = stepsHandler.getStepDefinitionFiles();
            expect(Array.isArray(files)).toBe(true);
            
            files.forEach(file => {
                expect(file).toHaveProperty('label');
                expect(file).toHaveProperty('path');
                expect(typeof file.label).toBe('string');
                expect(typeof file.path).toBe('string');
            });
        });

        it('should handle empty step patterns', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: []
            });
            const files = handler.getStepDefinitionFiles();
            expect(files).toEqual([]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty step text', () => {
            const stepDef = stepsHandler.generateStepDefinition('', 'Given');
            expect(stepDef).toContain('Given(');
            expect(stepDef).toContain("''");
            expect(stepDef).toContain('async ({page}) =>');
        });

        it('should handle step text with only whitespace', () => {
            const stepDef = stepsHandler.generateStepDefinition('   ', 'Given');
            expect(stepDef).toContain('Given(');
            expect(stepDef).toContain('async ({page}) =>');
        });

        it('should handle complex step patterns', () => {
            const stepDef = stepsHandler.generateStepDefinition(
                'I enter "value" in field "name" and wait 5 seconds then check "result"',
                'Given'
            );
            expect(stepDef).toContain('I enter {string} in field {string} and wait {int} seconds then check {string}');
        });

        it('should handle unsupported language gracefully', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.unknown']
            });
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('Given('); // Should fallback to JavaScript
            expect(stepDef).toContain('async ({page}) =>');
        });
    });

    describe('Custom Step Templates', () => {
        it('should use custom step template when provided', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                stepTemplate: '{gherkinType}(\'{stepPattern}\', async () => {\n    // Custom implementation\n});'
            });
            
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('Given(\'I do something\', async () => {');
            expect(stepDef).toContain('// Custom implementation');
        });

        it('should replace gherkinType placeholder in custom template', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                stepTemplate: '{gherkinType}(\'{stepPattern}\', ({page}{parameterList}) => {});'
            });
            
            const whenStep = handler.generateStepDefinition('I click button', 'When');
            const thenStep = handler.generateStepDefinition('I see result', 'Then');
            
            expect(whenStep).toContain('When(\'I click button\', ({page}) => {});');
            expect(thenStep).toContain('Then(\'I see result\', ({page}) => {});');
        });

        it('should replace stepPattern placeholder in custom template', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                stepTemplate: '{gherkinType}(\'{stepPattern}\', ({page}{parameterList}) => {});'
            });
            
            const stepDef = handler.generateStepDefinition('I enter "value" and wait 5 seconds', 'Given');
            expect(stepDef).toContain('Given(\'I enter {string} and wait {int} seconds\', ({page}, str1, int1) => {});');
        });

        it('should prioritize custom template over default language templates', () => {
            const handler = new StepsHandler(__dirname, {
                ...testSettings,
                steps: ['**/*.ts'],
                stepTemplate: 'CUSTOM_{gherkinType}(\'{stepPattern}\');'
            });
            
            const stepDef = handler.generateStepDefinition('I do something', 'Given');
            expect(stepDef).toContain('CUSTOM_Given(\'I do something\');');
            expect(stepDef).not.toContain('async ({page}) =>');
        });
    });
});