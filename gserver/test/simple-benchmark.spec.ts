import StepsHandler from '../src/steps.handler';

describe('Simple Performance Benchmark', () => {
  const testSteps = [
    // Simple parameter types
    'I have {int} items',
    'I see {string} text',
    'I click {word} button',
    'I wait {float} seconds',
    
    // Medium complexity
    'the {string} {role} should have text {string}',
    'user {name} with role {role} should have {permission} access',
    'I select {option} from {dropdown} menu',
    'the {element} should contain {text} message',
    
    // Complex parameter combinations
    'user {name} with role {role} should have {permission} access to {resource}',
    'the {entity} {action} {target} with {attribute1} {value1} and {attribute2} {value2}',
    'I perform {action} on {resource} with {param1} {value1} {param2} {value2} {param3} {value3}',
    'the system should {action} {entity} with {property1} {value1} {property2} {value2} {property3} {value3}',
    
    // Very complex scenarios
    'when {user} performs {action} on {resource} with {data} then {system} should {response} with {status}',
    'the {component} {state} should {behavior} {target} with {condition1} {value1} and {condition2} {value2} and {condition3} {value3}',
    'I verify that {entity1} {relation} {entity2} where {property1} is {value1} and {property2} is {value2} and {property3} is {value3} and {property4} is {value4}',
    
    // Ruby interpolation and alternatives
    'I have #{count} items with #{description}',
    'I (click|press|tap) the {element}',
    'I have (optional) {string} text',
    'the system (should|must|will) {action} {resource}',
    
    // Custom parameter types
    'the {customType1} should {customAction} {customType2}',
    'I validate {dataType} against {schema} with {rules}',
    'the {service} responds with {statusCode} and {payload}',
  ];

  const testCompletions = [
    'Given I have',
    'When I see', 
    'Then the user',
    'And the system',
    'But I click',
    'Given user',
    'When the',
    'Then I',
    'And I perform',
    'But the component',
    'Given I validate',
    'When I verify',
    'Then the service',
    'And I select',
    'But I wait',
  ];

  const baseSettings = {
    steps: ['/data/steps/test.steps*.js'],
    pages: {},
    syncfeatures: '/data/features/test.feature',
    smartSnippets: true,
    stepsInvariants: true,
    strictGherkinCompletion: false,
  };

  function measureTime(fn: () => void, iterations: number = 100): { avg: number, min: number, max: number, total: number } {
    const times: number[] = [];
        
    // Warm up
    for (let i = 0; i < 5; i++) {
      fn();
    }
        
    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }
        
    return {
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      total: times.reduce((a, b) => a + b, 0)
    };
  }

  it('should compare optimized vs legacy performance', () => {
    console.log('\n🚀 Starting Performance Benchmark...\n');

    // Test optimized version
    const optimizedSettings = {
      ...baseSettings,
      enablePerformanceOptimizations: true,
      enableRegexCaching: true,
      enableStepIndexing: true,
      maxCompletionItems: 50,
    };
    const optimizedHandler = new StepsHandler(__dirname, optimizedSettings);

    // Test legacy version  
    const legacySettings = {
      ...baseSettings,
      enablePerformanceOptimizations: false,
      enableRegexCaching: false,
      enableStepIndexing: false,
    };
    const legacyHandler = new StepsHandler(__dirname, legacySettings);

    console.log('📊 Testing Parameter Type Processing...');

    // Benchmark parameter type processing
    const optimizedRegex = measureTime(() => {
      testSteps.forEach(step => optimizedHandler.getRegTextForStep(step));
    }, 500);

    const legacyRegex = measureTime(() => {
      testSteps.forEach(step => legacyHandler.getRegTextForStep(step));
    }, 500);

    console.log(`  Optimized: ${optimizedRegex.avg.toFixed(3)}ms avg (${optimizedRegex.min.toFixed(3)}-${optimizedRegex.max.toFixed(3)}ms)`);
    console.log(`  Legacy:    ${legacyRegex.avg.toFixed(3)}ms avg (${legacyRegex.min.toFixed(3)}-${legacyRegex.max.toFixed(3)}ms)`);
    console.log(`  Speedup:   ${(legacyRegex.avg / optimizedRegex.avg).toFixed(2)}x faster`);

    console.log('\n📊 Testing Completion Performance...');

    // Benchmark completion
    const optimizedCompletion = measureTime(() => {
      testCompletions.forEach(completion => {
        optimizedHandler.getCompletion(completion, 0, completion);
      });
    }, 300);

    const legacyCompletion = measureTime(() => {
      testCompletions.forEach(completion => {
        legacyHandler.getCompletion(completion, 0, completion);
      });
    }, 300);

    console.log(`  Optimized: ${optimizedCompletion.avg.toFixed(3)}ms avg (${optimizedCompletion.min.toFixed(3)}-${optimizedCompletion.max.toFixed(3)}ms)`);
    console.log(`  Legacy:    ${legacyCompletion.avg.toFixed(3)}ms avg (${legacyCompletion.min.toFixed(3)}-${legacyCompletion.max.toFixed(3)}ms)`);
    console.log(`  Speedup:   ${(legacyCompletion.avg / optimizedCompletion.avg).toFixed(2)}x faster`);

    console.log('\n📊 Testing Regex Compilation...');

    // Benchmark regex compilation
    const optimizedCompilation = measureTime(() => {
      testSteps.forEach(step => {
        const regText = optimizedHandler.getRegTextForStep(step);
        new RegExp(regText);
      });
    }, 100);

    const legacyCompilation = measureTime(() => {
      testSteps.forEach(step => {
        const regText = legacyHandler.getRegTextForStep(step);
        new RegExp(regText);
      });
    }, 100);

    console.log(`  Optimized: ${optimizedCompilation.avg.toFixed(3)}ms avg (${optimizedCompilation.min.toFixed(3)}-${optimizedCompilation.max.toFixed(3)}ms)`);
    console.log(`  Legacy:    ${legacyCompilation.avg.toFixed(3)}ms avg (${legacyCompilation.min.toFixed(3)}-${legacyCompilation.max.toFixed(3)}ms)`);
    console.log(`  Speedup:   ${(legacyCompilation.avg / optimizedCompilation.avg).toFixed(2)}x faster`);

    // Calculate overall improvements
    const regexSpeedup = legacyRegex.avg / optimizedRegex.avg;
    const completionSpeedup = legacyCompletion.avg / optimizedCompletion.avg;
    const compilationSpeedup = legacyCompilation.avg / optimizedCompilation.avg;
    const avgSpeedup = (regexSpeedup + completionSpeedup + compilationSpeedup) / 3;

    console.log('\n🎯 Overall Results:');
    console.log(`  Average speedup: ${avgSpeedup.toFixed(2)}x`);
    console.log(`  Performance improvement: ${((avgSpeedup - 1) * 100).toFixed(1)}%`);

    // Memory usage test
    console.log('\n💾 Testing Memory Usage...');
        
    const initialMemory = process.memoryUsage().heapUsed;
        
    // Run many operations to test memory stability
    for (let i = 0; i < 500; i++) {
      testSteps.forEach(step => {
        optimizedHandler.getRegTextForStep(step);
      });
    }
        
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
        
    console.log(`  Memory growth after 500 iterations: ${memoryGrowth.toFixed(2)}MB`);
    console.log(`  Memory per operation: ${(memoryGrowth / 500 * 1000).toFixed(3)}KB`);

    // Store results for reporting (no performance assertions in benchmarks)
    console.log('\n✅ Benchmark completed successfully!\n');
    
    // Just verify that we got valid measurements
    expect(regexSpeedup).toBeGreaterThan(0);
    expect(completionSpeedup).toBeGreaterThan(0);
    expect(avgSpeedup).toBeGreaterThan(0);
    expect(typeof memoryGrowth).toBe('number');
  });

  it('should test caching effectiveness', () => {
    console.log('🔄 Testing Cache Effectiveness...\n');

    const cachedSettings = {
      ...baseSettings,
      enablePerformanceOptimizations: true,
      enableRegexCaching: true,
    };
    const cachedHandler = new StepsHandler(__dirname, cachedSettings);

    const noCacheSettings = {
      ...baseSettings,
      enablePerformanceOptimizations: true,
      enableRegexCaching: false,
    };
    const noCacheHandler = new StepsHandler(__dirname, noCacheSettings);

    // First run - cache miss
    const firstRun = measureTime(() => {
      testSteps.forEach(step => cachedHandler.getRegTextForStep(step));
    }, 50);

    // Second run - cache hit
    const secondRun = measureTime(() => {
      testSteps.forEach(step => cachedHandler.getRegTextForStep(step));
    }, 50);

    // No cache baseline
    const noCacheRun = measureTime(() => {
      testSteps.forEach(step => noCacheHandler.getRegTextForStep(step));
    }, 50);

    console.log(`  First run (cache miss):  ${firstRun.avg.toFixed(3)}ms avg`);
    console.log(`  Second run (cache hit):  ${secondRun.avg.toFixed(3)}ms avg`);
    console.log(`  No cache baseline:       ${noCacheRun.avg.toFixed(3)}ms avg`);
    console.log(`  Cache effectiveness:     ${(firstRun.avg / secondRun.avg).toFixed(2)}x faster`);

    // Just verify we got valid measurements
    expect(firstRun.avg).toBeGreaterThan(0);
    expect(secondRun.avg).toBeGreaterThan(0);
    expect(noCacheRun.avg).toBeGreaterThan(0);
  });

  it('should test indexing effectiveness', () => {
    console.log('📇 Testing Index Effectiveness...\n');

    const indexedSettings = {
      ...baseSettings,
      enablePerformanceOptimizations: true,
      enableStepIndexing: true,
      strictGherkinCompletion: true,
    };
    const indexedHandler = new StepsHandler(__dirname, indexedSettings);

    const noIndexSettings = {
      ...baseSettings,
      enablePerformanceOptimizations: true,
      enableStepIndexing: false,
      strictGherkinCompletion: true,
    };
    const noIndexHandler = new StepsHandler(__dirname, noIndexSettings);

    // Test with indexed search
    const indexedSearch = measureTime(() => {
      testCompletions.forEach(completion => {
        indexedHandler.getCompletion(completion, 0, completion);
      });
    }, 100);

    // Test without indexed search
    const linearSearch = measureTime(() => {
      testCompletions.forEach(completion => {
        noIndexHandler.getCompletion(completion, 0, completion);
      });
    }, 100);

    console.log(`  With indexing:    ${indexedSearch.avg.toFixed(3)}ms avg`);
    console.log(`  Without indexing: ${linearSearch.avg.toFixed(3)}ms avg`);
    console.log(`  Index speedup:    ${(linearSearch.avg / indexedSearch.avg).toFixed(2)}x faster`);

    // Just verify we got valid measurements
    expect(indexedSearch.avg).toBeGreaterThan(0);
    expect(linearSearch.avg).toBeGreaterThan(0);
  });
});