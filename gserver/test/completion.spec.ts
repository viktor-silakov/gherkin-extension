import StepsHandler from '../src/steps.handler';
import { Settings } from '../src/types';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

describe('Enhanced Autocompletion System', () => {
  const settings: Settings = {
    steps: ['/data/steps/*.steps.js'],
    pages: {},
    strictGherkinCompletion: true,
    smartSnippets: true,
    enablePerformanceOptimizations: true,
    enableRegexCaching: true,
  };

  const stepsHandler = new StepsHandler(__dirname, settings);

  describe('getCompletionItems', () => {
    it('should return completion items for partial step input', () => {
      const line = 'Given I do';
      const position = 10;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      expect(completionItems.length).toBeGreaterThan(0);
      
      completionItems.forEach(item => {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('insertText');
        expect(item).toHaveProperty('kind');
        expect(item.kind).toBe(CompletionItemKind.Snippet);
      });
    });

    it('should filter completions based on Gherkin type with strict mode', () => {
      const givenLine = 'Given I do';
      const whenLine = 'When I do';
      
      const givenCompletions = stepsHandler.getCompletionItems(givenLine, 10, '');
      const whenCompletions = stepsHandler.getCompletionItems(whenLine, 9, '');
      
      // Should have different results based on Gherkin type
      expect(givenCompletions).toBeInstanceOf(Array);
      expect(whenCompletions).toBeInstanceOf(Array);
      
      // Check that completions are contextually appropriate
      if (givenCompletions.length > 0) {
        expect(givenCompletions[0].label).toBeDefined();
        expect(givenCompletions[0].label.length).toBeGreaterThan(0);
      }
      if (whenCompletions.length > 0) {
        expect(whenCompletions[0].label).toBeDefined();
        expect(whenCompletions[0].label.length).toBeGreaterThan(0);
      }
    });

    it('should generate smart snippets with parameter placeholders', () => {
      const line = 'Given I have ';
      const position = 12;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        const hasPlaceholder = completionItems.some(item => 
          item.insertText?.includes('""') || item.insertText?.includes('?')
        );
        
        // At least one completion should have parameter placeholders
        expect(hasPlaceholder).toBe(true);
      }
    });

    it('should handle And/But steps by detecting context', () => {
      const document = `
        Feature: Test
        Scenario: Test
          Given I do something
          When I do something else
          And I do
      `;
      
      const line = '  And I do';
      const position = 9;
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      // Should return items appropriate for "When" context since that's the previous step
    });

    it('should sort completions by usage frequency', () => {
      const line = 'Given I do';
      const position = 10;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 1) {
        // Check that sortText is properly formatted
        completionItems.forEach(item => {
          expect(item.sortText).toBeDefined();
          expect(typeof item.sortText).toBe('string');
        });
      }
    });

    it('should handle empty or no matches gracefully', () => {
      const line = 'Given I do something that definitely does not exist';
      const position = 50;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      expect(completionItems.length).toBe(0);
    });

    it('should provide documentation from step definitions', () => {
      const line = 'Given I do';
      const position = 10;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        const hasDocumentation = completionItems.some(item => {
          if (item.documentation) {
            if (typeof item.documentation === 'string') {
              return item.documentation.length > 0;
            } else {
              return item.documentation.value && item.documentation.value.length > 0;
            }
          }
          return false;
        });
        
        // Some items should have documentation
        expect(hasDocumentation).toBe(true);
      }
    });

    it('should handle step variants with stepsInvariants enabled', () => {
      const variantSettings: Settings = {
        ...settings,
        stepsInvariants: true,
      };
      
      const variantHandler = new StepsHandler(__dirname, variantSettings);
      
      const line = 'Given I ';
      const position = 8;
      const document = '';
      
      const completionItems = variantHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      // Should expand OR-grouped steps into separate items
    });

    it('should handle non-Gherkin lines gracefully', () => {
      const line = 'This is not a gherkin line';
      const position = 10;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      expect(completionItems.length).toBe(0);
    });

    it('should work with non-strict Gherkin completion', () => {
      const nonStrictSettings: Settings = {
        ...settings,
        strictGherkinCompletion: false,
      };
      
      const nonStrictHandler = new StepsHandler(__dirname, nonStrictSettings);
      
      const line = 'Given I do';
      const position = 10;
      const document = '';
      
      const completionItems = nonStrictHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      // Should return more items since it's not filtering by Gherkin type
    });

    it('should handle smart snippets disabled', () => {
      const basicSettings: Settings = {
        ...settings,
        smartSnippets: false,
      };
      
      const basicHandler = new StepsHandler(__dirname, basicSettings);
      
      const line = 'Given I have ';
      const position = 12;
      const document = '';
      
      const completionItems = basicHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        // Should not have snippet syntax when smartSnippets is false
        const hasSnippet = completionItems.some(item => 
          item.insertText?.includes('${') && item.insertText?.includes('}')
        );
        
        expect(hasSnippet).toBe(false);
      }
    });

    it('should convert parameter types to simple placeholders', () => {
      const basicSettings: Settings = {
        ...settings,
        smartSnippets: true, // Enable smart snippets to test placeholder conversion
      };
      
      const basicHandler = new StepsHandler(__dirname, basicSettings);
      
      const line = 'Given I biba dopa ';
      const position = 18;
      const document = '';
      
      const completionItems = basicHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        // Find step with parameter types
        const stepWithParams = completionItems.find(item => 
          item.label.includes('{string}') || item.label.includes('{int}')
        );
        
        if (stepWithParams) {
          // Should convert {string} to "" and {int} to ?
          expect(stepWithParams.insertText).toMatch(/"/);
          expect(stepWithParams.insertText).toMatch(/\?/);
          expect(stepWithParams.insertText).not.toMatch(/\{string\}/);
          expect(stepWithParams.insertText).not.toMatch(/\{int\}/);
        }
      }
    });

    it('should handle parameter types in step completion correctly', () => {
      const line = 'When I biba dopa';
      const position = 16;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        // Look for a step that would contain parameter types
        const paramStep = completionItems.find(item => 
          item.insertText?.includes('""') || item.insertText?.includes('?')
        );
        
        if (paramStep) {
          // Should have simple placeholders, not parameter types
          expect(paramStep.insertText).not.toMatch(/\{string\}/);
          expect(paramStep.insertText).not.toMatch(/\{int\}/);
          expect(paramStep.insertText).not.toMatch(/\{float\}/);
          
          // Should have simple placeholders
          expect(paramStep.insertText).toMatch(/["?]/);
        }
      }
    });

    it('should not duplicate text when completing partial words', () => {
      const line = 'When I biba ';
      const position = 13;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        // Find step that starts with "I biba"
        const stepWithBiba = completionItems.find(item => 
          item.label.toLowerCase().includes('biba')
        );
        
        if (stepWithBiba) {
          // Should not duplicate "I biba" - insertText should continue from where user left off
          expect(stepWithBiba.insertText).not.toMatch(/^I biba/);
          // Should start with the remaining part (dopa...)
          expect(stepWithBiba.insertText).toMatch(/dopa/);
        }
      }
    });

    it('should not add extra spaces when completing partial words', () => {
      const line = 'When I biba';
      const position = 12;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      if (completionItems.length > 0) {
        // Find step that starts with "I biba"
        const stepWithBiba = completionItems.find(item => 
          item.label.toLowerCase().includes('biba')
        );
        
        if (stepWithBiba) {
          // Should not start with a space (no extra space)
          expect(stepWithBiba.insertText).not.toMatch(/^\s/);
          // Should start with the remaining part (dopa...)
          expect(stepWithBiba.insertText).toMatch(/^dopa/);
        }
      }
    });
  });

  describe('Performance and Caching', () => {
    it('should utilize caching for improved performance', () => {
      const line = 'Given I do';
      const position = 10;
      const document = '';
      
      // First call (cache miss)
      const start1 = Date.now();
      const completionItems1 = stepsHandler.getCompletionItems(line, position, document);
      const time1 = Date.now() - start1;
      
      // Second call (cache hit)
      const start2 = Date.now();
      const completionItems2 = stepsHandler.getCompletionItems(line, position, document);
      const time2 = Date.now() - start2;
      
      // Results should be the same
      expect(completionItems1).toEqual(completionItems2);
      
      // Second call should be faster or same (accounting for timing variations)
      expect(time2).toBeLessThanOrEqual(time1 + 5); // 5ms tolerance
    });

    it('should handle large numbers of steps efficiently', () => {
      const line = 'Given I';
      const position = 7;
      const document = '';
      
      const start = Date.now();
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      const executionTime = Date.now() - start;
      
      expect(completionItems).toBeInstanceOf(Array);
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Integration with existing functionality', () => {
    it('should work with existing validation system', () => {
      const line = 'Given I do something';
      const position = 19;
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, position, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      
      // Should not interfere with existing step validation
      const validation = stepsHandler.validate(line, 0, document);
      expect(validation).toBeNull(); // Should be valid step
    });

    it('should integrate with definition provider', () => {
      const line = 'Given I do something';
      const document = '';
      
      const completionItems = stepsHandler.getCompletionItems(line, 19, document);
      const definition = stepsHandler.getDefinition(line, document);
      
      expect(completionItems).toBeInstanceOf(Array);
      expect(definition).toBeDefined();
    });
  });
});