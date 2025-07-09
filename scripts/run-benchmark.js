#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Performance Benchmark...\n');

// Enable garbage collection for memory measurements
process.env.NODE_OPTIONS = '--expose-gc';

try {
    // Run the benchmark
    const result = execSync('npm run test:server -- --testNamePattern="Performance Benchmark" --verbose', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe'
    });

    console.log(result);

    // Extract benchmark results from output
    const lines = result.split('\n');
    let inBenchmarkSection = false;
    let benchmarkOutput = [];

    lines.forEach(line => {
        if (line.includes('=== OPTIMIZED VERSION BENCHMARK RESULTS ===') || 
            line.includes('=== LEGACY VERSION BENCHMARK RESULTS ===') ||
            line.includes('=== PERFORMANCE COMPARISON ===') ||
            line.includes('=== OVERALL RESULTS ===') ||
            line.includes('=== MEMORY USAGE ANALYSIS ===') ||
            line.includes('=== STRESS TEST RESULTS ===')) {
            inBenchmarkSection = true;
        }
        
        if (inBenchmarkSection) {
            benchmarkOutput.push(line);
        }
    });

    // Save benchmark results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const benchmarkFile = path.join(__dirname, '..', `benchmark-results-${timestamp}.txt`);
    
    const fullReport = [
        '# Performance Benchmark Results',
        `Generated: ${new Date().toISOString()}`,
        `Node.js: ${process.version}`,
        `Platform: ${process.platform} ${process.arch}`,
        '',
        ...benchmarkOutput
    ].join('\n');

    fs.writeFileSync(benchmarkFile, fullReport);
    
    console.log(`\n📊 Benchmark results saved to: ${benchmarkFile}`);
    console.log('✅ Benchmark completed successfully!');

} catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    
    if (error.stdout) {
        console.log('\nStdout:', error.stdout);
    }
    
    if (error.stderr) {
        console.error('\nStderr:', error.stderr);
    }
    
    process.exit(1);
}