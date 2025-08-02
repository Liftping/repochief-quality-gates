# RepoChief Quality Gates

> Automated quality verification system for RepoChief - AI Agent Orchestration Engine

RepoChief Quality Gates provides a comprehensive verification pipeline to ensure AI-generated code meets quality standards before deployment.

## Features

- **🧪 Test Runner Integration**: Jest, Mocha, Pytest, Go test
- **🔍 Static Analysis**: ESLint, Pylint, Golint
- **🔒 Security Scanning**: npm audit, Bandit, OWASP checks
- **📊 Complexity Analysis**: Cyclomatic complexity detection
- **📈 Coverage Enforcement**: Code coverage requirements
- **⚡ Performance Gates**: O(n²) pattern detection
- **🎯 Custom Gates**: Extensible gate framework

## Installation

```bash
npm install @liftping/repochief-quality-gates
```

## Quick Start

```javascript
const { createQualityRunner, QualityGates } = require('@liftping/repochief-quality-gates');

// Create quality runner
const runner = createQualityRunner({
  parallel: true,
  stopOnFailure: false
});

// Run quality gates on generated code
const results = await runner.runAll(generatedCode, {
  language: 'javascript',
  projectPath: './project',
  requirements: {
    coverage: 80,
    complexity: 10
  }
});

console.log('Quality check results:', results);
```

## Built-in Quality Gates

### Test Runners

#### Jest Gate
```javascript
const { JestGate } = require('@liftping/repochief-quality-gates');

const jestGate = new JestGate({
  configPath: './jest.config.js',
  coverageThreshold: 80
});

const result = await jestGate.execute(code, context);
```

#### Mocha Gate
```javascript
const { MochaGate } = require('@liftping/repochief-quality-gates');

const mochaGate = new MochaGate({
  timeout: 10000,
  reporter: 'json'
});
```

### Static Analysis

#### ESLint Gate
```javascript
const { ESLintGate } = require('@liftping/repochief-quality-gates');

const eslintGate = new ESLintGate({
  configFile: '.eslintrc.js',
  fix: false
});
```

### Security Gates

#### NPM Audit Gate
```javascript
const { NpmAuditGate } = require('@liftping/repochief-quality-gates');

const auditGate = new NpmAuditGate({
  level: 'moderate', // low, moderate, high, critical
  production: true
});
```

### Performance Gates

#### Complexity Gate
```javascript
const { ComplexityGate } = require('@liftping/repochief-quality-gates');

const complexityGate = new ComplexityGate({
  maxComplexity: 10,
  detectPatterns: ['O(n²)', 'nested-loops']
});
```

## Custom Quality Gates

Create your own quality gates by extending the base class:

```javascript
const { QualityGate } = require('@liftping/repochief-quality-gates');

class CustomGate extends QualityGate {
  constructor(options = {}) {
    super('custom-gate', options);
  }

  async execute(code, context) {
    try {
      // Your validation logic here
      const issues = await this.validateCode(code);
      
      return {
        status: issues.length === 0 ? 'pass' : 'fail',
        details: {
          issues,
          metrics: {
            totalIssues: issues.length
          }
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: { error: error.message }
      };
    }
  }
  
  async validateCode(code) {
    // Implementation
    return [];
  }
}

// Register custom gate
runner.register('custom', new CustomGate());
```

## Quality Gate Pipeline

Configure a complete verification pipeline:

```javascript
const pipeline = createQualityRunner({
  gates: [
    { name: 'eslint', enabled: true },
    { name: 'jest', enabled: true },
    { name: 'complexity', enabled: true },
    { name: 'security', enabled: true }
  ],
  parallel: true,
  stopOnFailure: false,
  timeout: 60000
});

// Run pipeline
const results = await pipeline.runAll(code, {
  language: 'javascript',
  requirements: {
    coverage: 80,
    complexity: 10,
    security: 'moderate'
  }
});

// Check overall status
if (results.overallStatus === 'pass') {
  console.log('All quality gates passed!');
} else {
  console.log('Quality issues found:', results.failedGates);
}
```

## Integration with RepoChief Core

Quality gates integrate seamlessly with the orchestrator:

```javascript
const { createOrchestrator } = require('@liftping/repochief-core');
const { createQualityRunner } = require('@liftping/repochief-quality-gates');

const orchestrator = createOrchestrator({
  qualityGates: createQualityRunner({
    gates: ['eslint', 'jest', 'security']
  })
});

// Quality gates run automatically after code generation
orchestrator.on('taskCompleted', async ({ task, result }) => {
  if (result.qualityStatus === 'fail') {
    console.log('Quality issues:', result.qualityDetails);
  }
});
```

## Configuration

### Global Configuration

```javascript
const runner = createQualityRunner({
  // Global options
  parallel: true,
  stopOnFailure: false,
  timeout: 60000,
  retries: 2,
  
  // Default gate configurations
  gateDefaults: {
    eslint: {
      fix: false,
      cache: true
    },
    jest: {
      coverage: true,
      verbose: false
    }
  }
});
```

### Per-Gate Configuration

```javascript
// Configure individual gates
runner.configure('jest', {
  testMatch: ['**/*.test.js'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
});
```

## Gate Results Schema

All gates return a standardized result format:

```javascript
{
  gate: 'jest',
  status: 'pass' | 'fail' | 'error' | 'skipped',
  duration: 1234, // milliseconds
  timestamp: '2024-01-15T10:30:00Z',
  details: {
    // Gate-specific details
    coverage: {
      lines: 85.5,
      branches: 78.2,
      functions: 90.1,
      statements: 84.3
    },
    tests: {
      total: 45,
      passed: 43,
      failed: 2,
      skipped: 0
    }
  }
}
```

## CLI Usage

Quality gates can be run from the command line:

```bash
# Run all gates
repochief-quality check ./generated-code

# Run specific gates
repochief-quality check ./generated-code --gates eslint,jest

# With custom config
repochief-quality check ./generated-code --config quality.config.js
```

## Performance Considerations

- **Parallel Execution**: Run independent gates concurrently
- **Caching**: Cache results for unchanged code
- **Early Exit**: Stop on first failure to save time
- **Selective Gates**: Run only relevant gates based on code type

```javascript
const runner = createQualityRunner({
  parallel: true,
  cache: {
    enabled: true,
    ttl: 3600 // 1 hour
  },
  stopOnFailure: true,
  gateSelector: (code, context) => {
    // Run only relevant gates
    if (context.language === 'python') {
      return ['pylint', 'pytest', 'bandit'];
    }
    return ['eslint', 'jest', 'npm-audit'];
  }
});
```

## Error Handling

```javascript
try {
  const results = await runner.runAll(code, context);
} catch (error) {
  if (error.code === 'GATE_TIMEOUT') {
    console.error('Quality gates timed out');
  } else if (error.code === 'GATE_NOT_FOUND') {
    console.error('Unknown gate:', error.gate);
  }
}

// Handle individual gate errors
runner.on('gateError', ({ gate, error }) => {
  console.error(`Gate ${gate} failed:`, error);
});
```

## Events

The quality runner emits various events:

```javascript
runner.on('gateStarted', ({ gate }) => {
  console.log(`Running ${gate}...`);
});

runner.on('gateCompleted', ({ gate, result }) => {
  console.log(`${gate}: ${result.status}`);
});

runner.on('pipelineCompleted', ({ results, duration }) => {
  console.log(`Pipeline completed in ${duration}ms`);
});
```

## Best Practices

1. **Configure Appropriately**: Set thresholds based on project maturity
2. **Use Caching**: Enable caching for faster subsequent runs
3. **Parallelize**: Run independent gates concurrently
4. **Custom Gates**: Create project-specific validation gates
5. **Progressive Enhancement**: Start with basic gates, add more over time

## Troubleshooting

### Gate Timeouts
```javascript
// Increase timeout for slow gates
runner.configure('jest', {
  timeout: 120000 // 2 minutes
});
```

### Missing Dependencies
```bash
# Install gate dependencies
npm install --save-dev jest eslint
```

### Configuration Issues
```javascript
// Validate configuration
const isValid = runner.validateConfig();
if (!isValid) {
  console.error('Invalid configuration:', runner.getConfigErrors());
}
```

## Security

- Never commit API keys to the repository
- Use environment variables for sensitive configuration
- Report security vulnerabilities to: security@liftping.com

## Contributing

See the main [RepoChief repository](https://github.com/liftping/repochief) for contribution guidelines.

## License

MIT