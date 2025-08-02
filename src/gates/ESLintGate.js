/**
 * ESLint Quality Gate
 * Validates JavaScript/TypeScript code using ESLint
 */

const BaseQualityGate = require('../BaseQualityGate');
const { ESLint } = require('eslint');
const path = require('path');
const fs = require('fs').promises;

class ESLintGate extends BaseQualityGate {
    constructor(options = {}) {
        super(options);
        
        // ESLint configuration
        this.eslintConfig = {
            useEslintrc: false,
            baseConfig: this.getDefaultConfig(),
            ignore: false, // Don't ignore any files
            ...options.eslintConfig
        };
        
        // Override with custom rules if provided
        if (options.rules) {
            this.eslintConfig.baseConfig.rules = {
                ...this.eslintConfig.baseConfig.rules,
                ...options.rules
            };
        }
        
        // Create ESLint instance
        this.eslint = new ESLint(this.eslintConfig);
    }
    
    /**
     * Execute ESLint validation
     */
    async execute(code, context = {}) {
        try {
            // Determine file extension
            const fileExt = context.language === 'typescript' ? '.ts' : '.js';
            const fileName = context.fileName || `temp${fileExt}`;
            
            // Create temporary file for linting
            const tempFile = path.join(process.cwd(), `.temp-eslint-${Date.now()}${fileExt}`);
            
            try {
                // Write code to temp file
                await fs.writeFile(tempFile, code);
                
                // Run ESLint
                const results = await this.eslint.lintFiles([tempFile]);
                
                // Process results
                const issues = this.processResults(results);
                
                // Determine status
                const errors = issues.filter(i => i.severity === 'error');
                const warnings = issues.filter(i => i.severity === 'warning');
                
                const status = this.shouldFail(issues) ? 'fail' : 'pass';
                
                return {
                    status,
                    issues,
                    stats: {
                        errors: errors.length,
                        warnings: warnings.length,
                        fixable: issues.filter(i => i.fixable).length
                    },
                    details: {
                        fileName,
                        rulesApplied: Object.keys(this.eslintConfig.baseConfig.rules).length
                    }
                };
                
            } finally {
                // Clean up temp file
                try {
                    await fs.unlink(tempFile);
                } catch (err) {
                    // Ignore cleanup errors
                }
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
     * Process ESLint results
     */
    processResults(results) {
        const issues = [];
        
        for (const result of results) {
            for (const message of result.messages) {
                issues.push({
                    line: message.line,
                    column: message.column,
                    severity: message.severity === 2 ? 'error' : 'warning',
                    message: message.message,
                    rule: message.ruleId,
                    fixable: message.fix !== undefined
                });
            }
        }
        
        return issues;
    }
    
    /**
     * Get default ESLint configuration
     */
    getDefaultConfig() {
        return {
            env: {
                es2021: true,
                node: true
            },
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module'
            },
            rules: {
                // Error prevention
                'no-unused-vars': 'error',
                'no-undef': 'error',
                'no-console': 'error',
                'no-debugger': 'error',
                
                // Best practices
                'eqeqeq': ['error', 'smart'],
                'curly': 'error',
                'no-eval': 'error',
                'no-implied-eval': 'error',
                'no-return-await': 'error',
                'require-await': 'error',
                
                // Style (minimal)
                'indent': ['error', 4],
                'quotes': ['error', 'single', { avoidEscape: true }],
                'semi': ['error', 'always'],
                
                // ES6
                'prefer-const': 'error',
                'no-var': 'error',
                'arrow-body-style': ['error', 'as-needed']
            }
        };
    }
    
    /**
     * Apply automatic fixes (optional feature)
     */
    async fix(code, context = {}) {
        try {
            const fileExt = context.language === 'typescript' ? '.ts' : '.js';
            const tempFile = path.join(process.cwd(), `.temp-eslint-fix-${Date.now()}${fileExt}`);
            
            try {
                await fs.writeFile(tempFile, code);
                
                // Create ESLint instance with fix enabled
                const eslintFixer = new ESLint({
                    ...this.eslintConfig,
                    fix: true
                });
                
                const results = await eslintFixer.lintFiles([tempFile]);
                
                // Get fixed code
                let fixedCode = code;
                if (results[0] && results[0].output) {
                    fixedCode = results[0].output;
                }
                
                return {
                    fixed: true,
                    code: fixedCode,
                    changes: results[0]?.output ? 'Code was automatically fixed' : 'No fixes applied'
                };
                
            } finally {
                try {
                    await fs.unlink(tempFile);
                } catch (err) {
                    // Ignore
                }
            }
            
        } catch (error) {
            return {
                fixed: false,
                error: error.message
            };
        }
    }
}

module.exports = ESLintGate;