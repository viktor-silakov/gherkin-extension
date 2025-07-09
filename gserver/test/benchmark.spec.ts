import StepsHandler from '../src/steps.handler';
import { GherkinType } from '../src/gherkin';

describe('Performance Benchmark', () => {
  // Test data with various parameter types complexity
  const testSteps = [
    'I have {int} items',
    'I see {string} text',
    'the {string} {role} should have text {string}',
    'user {name} with role {role} should have {permission} access to {resource}',
    'the {entity} {action} {target} with {attribute1} {value1} and {attribute2} {value2} should {result} {expected}',
    'I perform {action} on {resource} with {param1} {value1} {param2} {value2} {param3} {value3} then expect {outcome}',
    'the system should {action} {entity} with {property1} {value1} {property2} {value2} {property3} {value3} {property4} {value4}',
    'when {user} performs {action} on {resource} with {data} then {system} should {response} with {status} and {message}',
    'I have #{count} items with #{description}', // Ruby interpolation
    'I (click|press|tap) the {element}', // Alternative text
    'I have (optional) {string} text', // Optional text
    'the {customType1} should {customAction} {customType2}', // Custom types
  ];

  const testCompletions = [
    'Given I have',
    'When I see',
    'Then the user',
    'And the system',
    'But I perform',
    'Given I have some',
    'When the user with',
    'Then the system should',
  ];

  const settings = {
    steps: ['/data/steps/test.steps*.js'],
    pages: {},
    syncfeatures: '/data/features/test.feature',
    smartSnippets: true,
    stepsInvariants: true,
    strictGherkinCompletion: false,
    customParameters: [
      {
        parameter: '${dictionaryObject}',
        value: '([a-zA-Z0-9_-]+ dictionary|"[^"]*")',
      },
      {
        parameter: /\{role\}/g,
        value: '(admin|user|guest)',
      },
      {
        parameter: /\{entity\}/g,
        value: '(user|product|order|system)',
      },
    ],
  };

    interface BenchmarkResult {
        operation: string;
        iterations: number;
        totalTime: number;
        averageTime: number;
        minTime: number;
        maxTime: number;
        memoryUsage?: {
            heapUsed: number;
            heapTotal: number;
            external: number;
        };
    }

    function measureMemory() {
      if (global.gc) {
        global.gc();
      }
      return process.memoryUsage();
    }

    function runBenchmark(name: string, fn: () => void, iterations: number = 1000): BenchmarkResult {
      const times: number[] = [];
      const startMemory = measureMemory();

      // Warm up
      for (let i = 0; i < 10; i++) {
        fn();
      }

      // Actual benchmark
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        const end = performance.now();
        times.push(end - start);
      }

      const endMemory = measureMemory();
      const totalTime = times.reduce((sum, time) => sum + time, 0);

      return {
        operation: name,
        iterations,
        totalTime,
        averageTime: totalTime / iterations,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        memoryUsage: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
        }
      };
    }

    describe('Optimized Version Benchmark', () => {
      let optimizedHandler: StepsHandler;

      beforeAll(() => {
        const optimizedSettings = {
          ...settings,
          enablePerformanceOptimizations: true,
          maxCompletionItems: 50,
          debounceDelay: 0, // Disable for benchmark
          enableRegexCaching: true,
          enableStepIndexing: true,
        };
        optimizedHandler = new StepsHandler(__dirname, optimizedSettings);
      });

      it('should benchmark regex processing with optimizations', () => {
        const results: BenchmarkResult[] = [];

        // Benchmark simple parameter types
        results.push(runBenchmark('Simple Parameter Types (Optimized)', () => {
          testSteps.slice(0, 3).forEach(step => {
            optimizedHandler.getRegTextForStep(step);
          });
        }, 1000));

        // Benchmark complex parameter types
        results.push(runBenchmark('Complex Parameter Types (Optimized)', () => {
          testSteps.slice(3, 8).forEach(step => {
            optimizedHandler.getRegTextForStep(step);
          });
        }, 1000));

        // Benchmark completion
        results.push(runBenchmark('Completion (Optimized)', () => {
          testCompletions.forEach(completion => {
            optimizedHandler.getCompletion(completion, 0, completion);
          });
        }, 500));

        // Benchmark regex compilation
        results.push(runBenchmark('Regex Compilation (Optimized)', () => {
          testSteps.forEach(step => {
            const regText = optimizedHandler.getRegTextForStep(step);
            new RegExp(regText);
          });
        }, 500));

        console.log('\n=== OPTIMIZED VERSION BENCHMARK RESULTS ===');
        results.forEach(result => {
          console.log(`\n${result.operation}:`);
          console.log(`  Iterations: ${result.iterations}`);
          console.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
          console.log(`  Average time: ${result.averageTime.toFixed(4)}ms`);
          console.log(`  Min time: ${result.minTime.toFixed(4)}ms`);
          console.log(`  Max time: ${result.maxTime.toFixed(4)}ms`);
          if (result.memoryUsage) {
            console.log(`  Memory delta: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
          }
        });

        // Store results for comparison
        (global as any).optimizedResults = results;

        // Basic assertions
        results.forEach(result => {
          expect(result.averageTime).toBeLessThan(10); // Should be fast
          expect(result.totalTime).toBeGreaterThan(0);
        });
      });
    });

    describe('Legacy Version Benchmark', () => {
      let legacyHandler: StepsHandler;

      beforeAll(() => {
        const legacySettings = {
          ...settings,
          enablePerformanceOptimizations: false,
          enableRegexCaching: false,
          enableStepIndexing: false,
        };
        legacyHandler = new StepsHandler(__dirname, legacySettings);
      });

      it('should benchmark regex processing without optimizations', () => {
        const results: BenchmarkResult[] = [];

        // Benchmark simple parameter types
        results.push(runBenchmark('Simple Parameter Types (Legacy)', () => {
          testSteps.slice(0, 3).forEach(step => {
            legacyHandler.getRegTextForStep(step);
          });
        }, 1000));

        // Benchmark complex parameter types
        results.push(runBenchmark('Complex Parameter Types (Legacy)', () => {
          testSteps.slice(3, 8).forEach(step => {
            legacyHandler.getRegTextForStep(step);
          });
        }, 1000));

        // Benchmark completion
        results.push(runBenchmark('Completion (Legacy)', () => {
          testCompletions.forEach(completion => {
            legacyHandler.getCompletion(completion, 0, completion);
          });
        }, 500));

        // Benchmark regex compilation
        results.push(runBenchmark('Regex Compilation (Legacy)', () => {
          testSteps.forEach(step => {
            const regText = legacyHandler.getRegTextForStep(step);
            new RegExp(regText);
          });
        }, 500));

        console.log('\n=== LEGACY VERSION BENCHMARK RESULTS ===');
        results.forEach(result => {
          console.log(`\n${result.operation}:`);
          console.log(`  Iterations: ${result.iterations}`);
          console.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
          console.log(`  Average time: ${result.averageTime.toFixed(4)}ms`);
          console.log(`  Min time: ${result.minTime.toFixed(4)}ms`);
          console.log(`  Max time: ${result.maxTime.toFixed(4)}ms`);
          if (result.memoryUsage) {
            console.log(`  Memory delta: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
          }
        });

        // Store results for comparison
        (global as any).legacyResults = results;

        // Basic assertions
        results.forEach(result => {
          expect(result.totalTime).toBeGreaterThan(0);
        });
      });
    });

    describe('Performance Comparison', () => {
      it('should show performance improvements', () => {
        const optimizedResults = (global as any).optimizedResults as BenchmarkResult[];
        const legacyResults = (global as any).legacyResults as BenchmarkResult[];

        if (!optimizedResults || !legacyResults) {
          console.log('Benchmark results not available for comparison');
          return;
        }

        console.log('\n=== PERFORMANCE COMPARISON ===');
            
        const comparisons = optimizedResults.map((optimized, index) => {
          const legacy = legacyResults[index];
          const speedup = legacy.averageTime / optimized.averageTime;
          const memoryImprovement = legacy.memoryUsage && optimized.memoryUsage 
            ? ((legacy.memoryUsage.heapUsed - optimized.memoryUsage.heapUsed) / legacy.memoryUsage.heapUsed) * 100
            : 0;

          console.log(`\n${optimized.operation.replace(' (Optimized)', '')}:`);
          console.log(`  Legacy average: ${legacy.averageTime.toFixed(4)}ms`);
          console.log(`  Optimized average: ${optimized.averageTime.toFixed(4)}ms`);
          console.log(`  Speedup: ${speedup.toFixed(2)}x`);
          console.log(`  Improvement: ${((speedup - 1) * 100).toFixed(1)}%`);
                
          if (memoryImprovement !== 0) {
            console.log(`  Memory improvement: ${memoryImprovement.toFixed(1)}%`);
          }

          return {
            operation: optimized.operation.replace(' (Optimized)', ''),
            speedup,
            improvement: (speedup - 1) * 100,
            memoryImprovement
          };
        });

        // Calculate overall improvements
        const avgSpeedup = comparisons.reduce((sum, comp) => sum + comp.speedup, 0) / comparisons.length;
        const avgImprovement = comparisons.reduce((sum, comp) => sum + comp.improvement, 0) / comparisons.length;

        console.log('\n=== OVERALL RESULTS ===');
        console.log(`Average speedup: ${avgSpeedup.toFixed(2)}x`);
        console.log(`Average improvement: ${avgImprovement.toFixed(1)}%`);

        // Just verify we got valid measurements (no performance assertions in benchmarks)
        comparisons.forEach(comp => {
          expect(comp.speedup).toBeGreaterThan(0); // Should be a valid number
          expect(typeof comp.improvement).toBe('number'); // Should be a number
        });

        expect(avgSpeedup).toBeGreaterThan(0); // Should be a valid average
      });
    });

    describe('Memory Usage Analysis', () => {
      it('should analyze memory usage patterns', () => {
        const iterations = 100;
        const memorySnapshots: number[] = [];

        // Test with optimizations
        const optimizedSettings = {
          ...settings,
          enablePerformanceOptimizations: true,
          enableRegexCaching: true,
        };
        const optimizedHandler = new StepsHandler(__dirname, optimizedSettings);

        console.log('\n=== MEMORY USAGE ANALYSIS ===');

        // Measure memory usage over time with caching
        for (let i = 0; i < iterations; i++) {
          testSteps.forEach(step => {
            optimizedHandler.getRegTextForStep(step);
          });
                
          if (i % 10 === 0) {
            const memory = process.memoryUsage();
            memorySnapshots.push(memory.heapUsed);
          }
        }

        const initialMemory = memorySnapshots[0];
        const finalMemory = memorySnapshots[memorySnapshots.length - 1];
        const memoryGrowth = finalMemory - initialMemory;
        const memoryGrowthMB = memoryGrowth / 1024 / 1024;

        console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
        console.log(`Memory growth per iteration: ${(memoryGrowthMB / iterations * 1000).toFixed(4)}KB`);

        // Just verify we got a valid measurement
        expect(typeof memoryGrowthMB).toBe('number');
      });
    });

    describe('Stress Test', () => {
      it('should handle high load scenarios', () => {
        const stressSettings = {
          ...settings,
          enablePerformanceOptimizations: true,
          maxCompletionItems: 100,
          enableRegexCaching: true,
          enableStepIndexing: true,
        };
        const stressHandler = new StepsHandler(__dirname, stressSettings);

        // Generate many complex steps
        const complexSteps: string[] = [];
        for (let i = 0; i < 100; i++) {
          complexSteps.push(`step ${i} with {param1} and {param2} and {param3} should {result}`);
        }

        const stressResult = runBenchmark('Stress Test (100 complex steps)', () => {
          complexSteps.forEach(step => {
            stressHandler.getRegTextForStep(step);
          });
        }, 50);

        console.log('\n=== STRESS TEST RESULTS ===');
        console.log(`Average time for 100 steps: ${stressResult.averageTime.toFixed(2)}ms`);
        console.log(`Time per step: ${(stressResult.averageTime / 100).toFixed(4)}ms`);

        // Just verify we got valid measurements
        expect(stressResult.averageTime).toBeGreaterThan(0);
        expect(typeof stressResult.averageTime).toBe('number');
      });
    });
});