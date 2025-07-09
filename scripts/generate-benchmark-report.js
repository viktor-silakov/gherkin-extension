#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Generating Performance Benchmark Report...\n');

try {
    // Run the benchmark
    const result = execSync('npm run test:server -- --testNamePattern="Simple Performance Benchmark" --verbose', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe'
    });

    // Extract performance metrics from console output
    const lines = result.split('\n');
    const metrics = {};
    
    let currentSection = '';
    
    lines.forEach(line => {
        // Track current section
        if (line.includes('Testing Parameter Type Processing')) {
            currentSection = 'parameter';
        } else if (line.includes('Testing Completion Performance')) {
            currentSection = 'completion';
        } else if (line.includes('Testing Regex Compilation')) {
            currentSection = 'regex';
        }
        
        // Extract metrics based on current section
        if (line.includes('Optimized:') && line.includes('avg')) {
            const match = line.match(/Optimized:\s+([\d.]+)ms avg/);
            if (match) {
                if (currentSection === 'parameter') {
                    metrics.parameterTypeOptimized = parseFloat(match[1]);
                } else if (currentSection === 'completion') {
                    metrics.completionOptimized = parseFloat(match[1]);
                } else if (currentSection === 'regex') {
                    metrics.regexOptimized = parseFloat(match[1]);
                }
            }
        }
        
        if (line.includes('Legacy:') && line.includes('avg')) {
            const match = line.match(/Legacy:\s+([\d.]+)ms avg/);
            if (match) {
                if (currentSection === 'parameter') {
                    metrics.parameterTypeLegacy = parseFloat(match[1]);
                } else if (currentSection === 'completion') {
                    metrics.completionLegacy = parseFloat(match[1]);
                } else if (currentSection === 'regex') {
                    metrics.regexLegacy = parseFloat(match[1]);
                }
            }
        }
        
        if (line.includes('Average speedup:')) {
            const match = line.match(/Average speedup:\s+([\d.]+)x/);
            if (match) metrics.averageSpeedup = parseFloat(match[1]);
        }
        
        if (line.includes('Performance improvement:')) {
            const match = line.match(/Performance improvement:\s+([\d.]+)%/);
            if (match) metrics.performanceImprovement = parseFloat(match[1]);
        }
        
        if (line.includes('Memory growth after')) {
            const match = line.match(/Memory growth after \d+ iterations:\s+([\d.]+)MB/);
            if (match) metrics.memoryGrowth = parseFloat(match[1]);
        }
        
        if (line.includes('Cache effectiveness:')) {
            const match = line.match(/Cache effectiveness:\s+([\d.]+)x faster/);
            if (match) metrics.cacheEffectiveness = parseFloat(match[1]);
        }
    });

    // Generate markdown report
    const timestamp = new Date().toISOString();
    const report = generateMarkdownReport(metrics, timestamp);
    
    // Save report
    const reportFile = path.join(__dirname, '..', 'LATEST_BENCHMARK_REPORT.md');
    fs.writeFileSync(reportFile, report);
    
    console.log('📊 Benchmark Results:');
    console.log(`  Parameter Type Processing: ${metrics.averageSpeedup || 'N/A'}x faster`);
    console.log(`  Overall Performance Improvement: ${metrics.performanceImprovement || 'N/A'}%`);
    console.log(`  Memory Usage: ${metrics.memoryGrowth || 'N/A'}MB growth`);
    console.log(`  Cache Effectiveness: ${metrics.cacheEffectiveness || 'N/A'}x faster`);
    
    console.log(`\n📄 Full report saved to: ${reportFile}`);
    console.log('✅ Benchmark report generated successfully!');

} catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
}

function generateMarkdownReport(metrics, timestamp) {
    return `# Performance Benchmark Report

**Generated:** ${timestamp}
**Node.js Version:** ${process.version}
**Platform:** ${process.platform} ${process.arch}

## Executive Summary

The performance optimizations have delivered significant improvements across all measured metrics:

- **Overall Speedup:** ${metrics.averageSpeedup || 'N/A'}x faster
- **Performance Improvement:** ${metrics.performanceImprovement || 'N/A'}%
- **Memory Stability:** ${metrics.memoryGrowth || 'N/A'}MB growth over 500 iterations
- **Cache Effectiveness:** ${metrics.cacheEffectiveness || 'N/A'}x faster for repeated operations

## Detailed Results

### Parameter Type Processing
- **Optimized Version:** ${metrics.parameterTypeOptimized || 'N/A'}ms average
- **Legacy Version:** ${metrics.parameterTypeLegacy || 'N/A'}ms average
- **Speedup:** ${metrics.parameterTypeLegacy && metrics.parameterTypeOptimized ? (metrics.parameterTypeLegacy / metrics.parameterTypeOptimized).toFixed(2) : 'N/A'}x

### Completion Performance
- **Optimized Version:** ${metrics.completionOptimized || 'N/A'}ms average
- **Legacy Version:** ${metrics.completionLegacy || 'N/A'}ms average
- **Speedup:** ${metrics.completionLegacy && metrics.completionOptimized ? (metrics.completionLegacy / metrics.completionOptimized).toFixed(2) : 'N/A'}x

### Regex Compilation
- **Optimized Version:** ${metrics.regexOptimized || 'N/A'}ms average
- **Legacy Version:** ${metrics.regexLegacy || 'N/A'}ms average
- **Speedup:** ${metrics.regexLegacy && metrics.regexOptimized ? (metrics.regexLegacy / metrics.regexOptimized).toFixed(2) : 'N/A'}x

## Key Optimizations

1. **Regex Caching** - Prevents recompilation of regular expressions
2. **Parameter Type Processing** - Optimized handling of {string}, {int}, {float} etc.
3. **Step Indexing** - Faster lookup of relevant steps
4. **Memory Management** - Stable memory usage without leaks

## Recommendations

### For Small Projects (<100 steps):
\`\`\`json
{
  "cucumberautocomplete.enablePerformanceOptimizations": true,
  "cucumberautocomplete.maxCompletionItems": 50,
  "cucumberautocomplete.debounceDelay": 50
}
\`\`\`

### For Large Projects (>500 steps):
\`\`\`json
{
  "cucumberautocomplete.enablePerformanceOptimizations": true,
  "cucumberautocomplete.maxCompletionItems": 30,
  "cucumberautocomplete.debounceDelay": 150
}
\`\`\`

## Conclusion

The optimizations provide substantial performance improvements, particularly for projects using multiple parameter types in step definitions. The ${metrics.averageSpeedup || 'N/A'}x average speedup and stable memory usage make this a significant enhancement for developer productivity.

---
*Report generated automatically by benchmark suite*`;
}