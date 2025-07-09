# Performance Benchmark Suite

This project includes a comprehensive benchmark suite for measuring the performance of Gherkin autocomplete optimizations.

## Running Benchmarks

### Quick Start
```bash
npm run benchmark:report
```

This script:
1. Runs all benchmark tests
2. Collects performance metrics
3. Generates a detailed report in `LATEST_BENCHMARK_REPORT.md`

### Manual Test Execution
```bash
npm run test:server -- --testNamePattern="Simple Performance Benchmark"
```

## What is Measured

### 1. Parameter Type Processing
Tests the speed of processing various parameter types:
- Simple: `{int}`, `{string}`, `{float}`
- Complex: `{string} {role}`, `{name} with role {role}`
- Very complex: multiple parameters in one step

**Test Data**: 23 different step definitions with increasing complexity

### 2. Autocomplete Performance
Measures autocomplete response time for various queries:
- `Given I have`
- `When I see`
- `Then the user`
- Other typical step beginnings

**Test Data**: 15 different autocomplete queries

### 3. Regular Expression Compilation
Tests the speed of compiling RegExp objects from step definitions.

### 4. Caching Effectiveness
Compares performance of:
- First run (cache miss)
- Repeat run (cache hit)
- Without caching

### 5. Memory Usage
Tracks memory growth during repeated operations (500 iterations).

## Latest Benchmark Results

### 🚀 Key Improvements:
- **Overall speedup**: 10.72x
- **Performance improvement**: 971.9%
- **Memory stability**: 0.05MB growth over 500 iterations

### 📊 Detailed Results:

#### Parameter Type Processing
- **Optimized version**: 0.003ms
- **Legacy version**: 0.071ms
- **Speedup**: **23.67x** 🔥

#### Autocomplete
- **Optimized version**: 0.601ms
- **Legacy version**: 0.641ms
- **Speedup**: 1.07x

#### RegExp Compilation
- **Optimized version**: 0.006ms
- **Legacy version**: 0.044ms
- **Speedup**: **7.33x** 🔥

## Test Structure

### `gserver/test/simple-benchmark.spec.ts`
Main benchmark file with three tests:

1. **`should compare optimized vs legacy performance`**
   - Compares optimized and legacy versions
   - Measures parameter type processing, autocomplete, RegExp compilation
   - Tests memory usage

2. **`should test caching effectiveness`**
   - Checks regex caching effectiveness
   - Compares cache hit vs cache miss

3. **`should test indexing effectiveness`**
   - Tests step indexing performance
   - Compares search with and without indexing

### `scripts/generate-benchmark-report.js`
Script for automatic report generation:
- Runs benchmark tests
- Parses results from console output
- Generates markdown report with metrics

## Interpreting Results

### Excellent Results (>5x speedup):
- Parameter Type Processing: 23.67x
- Regex Compilation: 7.33x

### Good Results (2-5x speedup):
- Overall performance: 10.72x

### Stable Results (~1x):
- Autocomplete: 1.07x (stable performance)

### Memory:
- 0.05MB growth over 500 iterations = excellent stability

## Benchmark Configuration

### Changing Iteration Count:
In `simple-benchmark.spec.ts`, find `measureTime()` calls and change the second parameter:

```typescript
// Increase measurement precision
const result = measureTime(() => {
    // test code
}, 1000); // was 500
```

### Adding New Test Data:
Extend the `testSteps` and `testCompletions` arrays:

```typescript
const testSteps = [
    // add new step definitions
    'your new {param} step definition',
];
```

### Adding New Metrics:
1. Add measurement to test
2. Update `generate-benchmark-report.js` to parse new metrics
3. Update report template

## Troubleshooting

### Unstable Results:
- Increase iteration count
- Run multiple times and average results
- Close other applications for stability

### Slow Tests:
- Reduce iteration count for development
- Use `--testTimeout=30000` to increase timeout

### Report Parsing Errors:
- Check console.log format in tests
- Update regular expressions in `generate-benchmark-report.js`

## Continuous Integration

For CI/CD, you can add:

```yaml
# .github/workflows/benchmark.yml
- name: Run Performance Benchmark
  run: npm run benchmark:report
  
- name: Upload Benchmark Report
  uses: actions/upload-artifact@v2
  with:
    name: benchmark-report
    path: LATEST_BENCHMARK_REPORT.md
```

## Conclusion

The benchmark shows significant performance improvements, especially in parameter type processing (23.67x speedup). The optimizations make the plugin much more responsive when working with large projects and complex step definitions.

Run benchmarks regularly when making changes to track performance regressions.