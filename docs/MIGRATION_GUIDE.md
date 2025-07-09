# Migration Guide to Optimized Version

## Overview of Changes

This version includes significant performance optimizations for working with parameter types in step definitions. All changes are backward compatible.

## Automatic Improvements

After updating, you automatically get:

1. **Fast autocomplete** - 4-10x improvement
2. **Stable memory consumption** - thanks to caching
3. **Smooth UI experience** - thanks to debouncing

## Recommended Settings

### For All Projects (add to `.vscode/settings.json`):

```json
{
  "cucumberautocomplete.enablePerformanceOptimizations": true,
  "cucumberautocomplete.maxCompletionItems": 50,
  "cucumberautocomplete.debounceDelay": 100
}
```

### For Large Projects (>500 steps):

```json
{
  "cucumberautocomplete.maxCompletionItems": 30,
  "cucumberautocomplete.debounceDelay": 150,
  "cucumberautocomplete.enableRegexCaching": true,
  "cucumberautocomplete.enableStepIndexing": true
}
```

### For Slower Machines:

```json
{
  "cucumberautocomplete.maxCompletionItems": 20,
  "cucumberautocomplete.debounceDelay": 200
}
```

## New Features

### 1. Optimized Parameter Type Processing

These step definitions now work much faster:

```typescript
// Multiple parameter types
Then('the {string} {role} should have text {string}', () => {});
Then('user {name} with role {role} should have {permission} access to {resource}', () => {});

// Complex combinations
Then('the {entity} {action} {target} with {attribute1} {value1} and {attribute2} {value2}', () => {});
```

### 2. Smart Autocomplete

- Results sorted by usage frequency
- Limited number of results for better performance
- Debouncing for smooth experience

### 3. Caching System

- Regular expressions are cached
- Processed step patterns are cached
- Automatic cache cleanup on changes

## Troubleshooting

### If Autocomplete is Slow:

1. Increase debounce delay:
```json
{
  "cucumberautocomplete.debounceDelay": 200
}
```

2. Reduce number of results:
```json
{
  "cucumberautocomplete.maxCompletionItems": 20
}
```

### If High Memory Usage:

1. Ensure caching is enabled:
```json
{
  "cucumberautocomplete.enableRegexCaching": true
}
```

2. Restart VS Code to clear caches

### If Compatibility Issues:

Temporarily disable optimizations:
```json
{
  "cucumberautocomplete.enablePerformanceOptimizations": false
}
```

## Performance Monitoring

### Measuring Autocomplete Time:

1. Open Developer Tools (`Help > Toggle Developer Tools`)
2. Go to Console tab
3. Start typing in a .feature file
4. Observe execution time

### Expected Results:

- **First autocomplete**: 50-100ms (compilation and caching)
- **Subsequent calls**: 20-50ms (from cache)
- **Complex step definitions**: 30-80ms

## Feedback

If you notice:
- Performance issues
- Inaccurate autocomplete results
- High memory usage
- Other problems

Please create an issue with:
1. VS Code version
2. Number of step definitions
3. Example of problematic step definition
4. Settings from `.vscode/settings.json`

## Rollback to Previous Version

If you need to return to old behavior:

```json
{
  "cucumberautocomplete.enablePerformanceOptimizations": false,
  "cucumberautocomplete.enableRegexCaching": false,
  "cucumberautocomplete.enableStepIndexing": false
}
```

## Additional Resources

- `PERFORMANCE_OPTIMIZATIONS_EN.md` - detailed description of optimizations
- `USAGE_EXAMPLE_EN.md` - usage examples
- `BENCHMARK_RESULTS.md` - performance measurement results