/**
 * Test Runner Quality Gate
 * Validates code by running Jest or Mocha tests
 */

const BaseQualityGate = require('../BaseQualityGate');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class TestRunnerGate extends BaseQualityGate {
    constructor(options = {}) {
        super(options);
        
        // Test runner configurations
        this.testRunners = {
            jest: {
                configFiles: ['jest.config.js', 'jest.config.json', 'package.json'],
                command: 'npx jest --json --coverage=false',
                detectPattern: /"jest":\s*{/,
                resultParser: this.parseJestResults.bind(this)
            },
            mocha: {
                configFiles: ['.mocharc.js', '.mocharc.json', '.mocharc.yml', 'package.json'],
                command: 'npx mocha --reporter json',
                detectPattern: /"mocha":|mocha\.|\.mocharc/,
                resultParser: this.parseMochaResults.bind(this)
            }
        };
        
        // Override default timeout for test execution
        this.timeout = options.timeout || 60000; // 60 seconds for tests
    }
    
    /**
     * Execute test runner validation
     */
    async execute(code, context = {}) {
        try {
            // Create temporary test environment
            const tempDir = await this.createTempTestEnvironment(code, context);
            
            try {
                // Detect test runner
                const runner = await this.detectTestRunner(tempDir);
                if (!runner) {
                    return {
                        status: 'skip',
                        message: 'No test runner detected (Jest or Mocha)',
                        details: {
                            searchedFor: Object.keys(this.testRunners)
                        }
                    };
                }
                
                // Run tests
                const testResults = await this.runTests(tempDir, runner);
                
                // Parse and analyze results
                const analysis = this.analyzeTestResults(testResults, runner);
                
                return {
                    status: analysis.allPassed ? 'pass' : 'fail',
                    issues: analysis.failures,
                    stats: {
                        total: analysis.total,
                        passed: analysis.passed,
                        failed: analysis.failed,
                        skipped: analysis.skipped,
                        duration: analysis.duration
                    },
                    details: {
                        runner,
                        testFile: context.fileName || 'generated.test.js',
                        coverage: testResults.coverage
                    }
                };
                
            } finally {
                // Clean up temp directory
                await this.cleanupTempDir(tempDir);
            }
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                details: {
                    stack: error.stack
                }
            };
        }
    }
    
    /**
     * Create temporary test environment
     */
    async createTempTestEnvironment(code, context) {
        const tempDir = path.join(os.tmpdir(), `repochief-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        
        // Determine file extension and name
        const fileExt = context.language === 'typescript' ? '.ts' : '.js';
        const isTestFile = context.fileName && context.fileName.includes('.test.');
        const fileName = isTestFile ? context.fileName : `generated.test${fileExt}`;
        
        // Write test file
        const testFile = path.join(tempDir, fileName);
        await fs.writeFile(testFile, code);
        
        // Create minimal package.json if needed
        const packageJson = {
            name: "temp-test-project",
            version: "1.0.0",
            scripts: {
                test: "echo 'Test runner will be detected'"
            }
        };
        
        await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        return tempDir;
    }
    
    /**
     * Detect which test runner to use
     */
    async detectTestRunner(tempDir) {
        // First check package.json for explicit runner
        try {
            const packageJsonPath = path.join(tempDir, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            // Check for Jest
            if (packageJson.jest || (packageJson.devDependencies && packageJson.devDependencies.jest)) {
                return 'jest';
            }
            
            // Check for Mocha
            if (packageJson.mocha || (packageJson.devDependencies && packageJson.devDependencies.mocha)) {
                return 'mocha';
            }
            
            // Check test script
            if (packageJson.scripts && packageJson.scripts.test) {
                const testScript = packageJson.scripts.test.toLowerCase();
                if (testScript.includes('jest')) return 'jest';
                if (testScript.includes('mocha')) return 'mocha';
            }
        } catch (error) {
            // Continue to file-based detection
        }
        
        // Check for config files
        for (const [runner, config] of Object.entries(this.testRunners)) {
            for (const configFile of config.configFiles) {
                try {
                    await fs.access(path.join(tempDir, configFile));
                    return runner;
                } catch (error) {
                    // File doesn't exist, continue
                }
            }
        }
        
        // Default to Jest if no runner detected but tests exist
        const files = await fs.readdir(tempDir);
        const hasTests = files.some(f => f.includes('.test.') || f.includes('.spec.'));
        
        return hasTests ? 'jest' : null;
    }
    
    /**
     * Run tests using detected runner
     */
    async runTests(tempDir, runner) {
        const runnerConfig = this.testRunners[runner];
        const command = runnerConfig.command.split(' ');
        const cmd = command[0];
        const args = command.slice(1);
        
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            
            const testProcess = spawn(cmd, args, {
                cwd: tempDir,
                shell: true,
                env: {
                    ...process.env,
                    CI: 'true',
                    NODE_ENV: 'test'
                }
            });
            
            testProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            testProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            testProcess.on('close', (code) => {
                // Tests may fail (code !== 0) but we still want the results
                try {
                    const results = runnerConfig.resultParser(stdout, stderr);
                    resolve(results);
                } catch (error) {
                    // If parsing fails, create a basic result
                    resolve({
                        success: code === 0,
                        total: 0,
                        passed: 0,
                        failed: 0,
                        failures: [],
                        output: stdout,
                        error: stderr
                    });
                }
            });
            
            testProcess.on('error', (error) => {
                reject(new Error(`Failed to run ${runner}: ${error.message}`));
            });
        });
    }
    
    /**
     * Parse Jest JSON output
     */
    parseJestResults(stdout, stderr) {
        try {
            // Jest outputs JSON to stdout when --json flag is used
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON output from Jest');
            }
            
            const results = JSON.parse(jsonMatch[0]);
            const testResults = results.testResults || [];
            
            const failures = [];
            let totalTests = 0;
            let passedTests = 0;
            let failedTests = 0;
            let skippedTests = 0;
            
            for (const fileResult of testResults) {
                for (const assertionResult of fileResult.assertionResults || []) {
                    totalTests++;
                    
                    if (assertionResult.status === 'passed') {
                        passedTests++;
                    } else if (assertionResult.status === 'failed') {
                        failedTests++;
                        failures.push({
                            test: assertionResult.fullName,
                            message: assertionResult.failureMessages.join('\n'),
                            location: fileResult.name
                        });
                    } else if (assertionResult.status === 'skipped' || assertionResult.status === 'pending') {
                        skippedTests++;
                    }
                }
            }
            
            return {
                success: results.success,
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                skipped: skippedTests,
                duration: results.totalTime,
                failures,
                coverage: results.coverageMap
            };
            
        } catch (error) {
            // Fallback to parsing text output
            return this.parseTextOutput(stdout, stderr, 'jest');
        }
    }
    
    /**
     * Parse Mocha JSON output
     */
    parseMochaResults(stdout, stderr) {
        try {
            // Mocha reporter json outputs to stdout
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON output from Mocha');
            }
            
            const results = JSON.parse(jsonMatch[0]);
            
            const failures = (results.failures || []).map(failure => ({
                test: failure.fullTitle,
                message: failure.err.message,
                location: failure.file || 'unknown'
            }));
            
            return {
                success: results.stats.failures === 0,
                total: results.stats.tests,
                passed: results.stats.passes,
                failed: results.stats.failures,
                skipped: results.stats.pending,
                duration: results.stats.duration,
                failures
            };
            
        } catch (error) {
            // Fallback to parsing text output
            return this.parseTextOutput(stdout, stderr, 'mocha');
        }
    }
    
    /**
     * Parse text output as fallback
     */
    parseTextOutput(stdout, stderr, runner) {
        const output = stdout + stderr;
        
        // Common patterns for test results
        const patterns = {
            jest: {
                total: /Tests:\s*(\d+)\s*total/,
                passed: /(\d+)\s*passed/,
                failed: /(\d+)\s*failed/,
                skipped: /(\d+)\s*skipped/
            },
            mocha: {
                total: /(\d+)\s*tests?/,
                passed: /(\d+)\s*passing/,
                failed: /(\d+)\s*failing/,
                skipped: /(\d+)\s*pending/
            }
        };
        
        const runnerPatterns = patterns[runner] || patterns.jest;
        
        const extractNumber = (pattern) => {
            const match = output.match(pattern);
            return match ? parseInt(match[1], 10) : 0;
        };
        
        const failed = extractNumber(runnerPatterns.failed);
        
        return {
            success: failed === 0 && output.toLowerCase().includes('pass'),
            total: extractNumber(runnerPatterns.total),
            passed: extractNumber(runnerPatterns.passed),
            failed: failed,
            skipped: extractNumber(runnerPatterns.skipped),
            failures: [],
            output
        };
    }
    
    /**
     * Analyze test results
     */
    analyzeTestResults(testResults, runner) {
        const issues = [];
        
        // Convert failures to issues
        for (const failure of testResults.failures || []) {
            issues.push({
                severity: 'error',
                message: `Test failed: ${failure.test}`,
                details: failure.message,
                location: failure.location,
                line: 0, // Test frameworks don't always provide line numbers
                column: 0
            });
        }
        
        return {
            allPassed: testResults.success && testResults.failed === 0,
            total: testResults.total,
            passed: testResults.passed,
            failed: testResults.failed,
            skipped: testResults.skipped,
            duration: testResults.duration,
            failures: issues
        };
    }
    
    /**
     * Clean up temporary directory
     */
    async cleanupTempDir(tempDir) {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Log but don't throw - cleanup is best effort
            console.error(`Failed to cleanup temp dir ${tempDir}:`, error.message);
        }
    }
}

module.exports = TestRunnerGate;