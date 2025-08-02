/**
 * Security Quality Gate
 * Checks for common security vulnerabilities
 */

const BaseQualityGate = require('../BaseQualityGate');

class SecurityGate extends BaseQualityGate {
    constructor(options = {}) {
        super(options);
        
        // Security patterns to check
        this.securityPatterns = [
            {
                pattern: /eval\s*\(/g,
                severity: 'error',
                message: 'Use of eval() is a security risk'
            },
            {
                pattern: /innerHTML\s*=/g,
                severity: 'warning',
                message: 'Direct innerHTML assignment can lead to XSS'
            },
            {
                pattern: /process\.env\.\w+/g,
                severity: 'info',
                message: 'Environment variable usage detected - ensure secrets are not exposed'
            },
            {
                pattern: /require\s*\(\s*[^'"]/g,
                severity: 'error',
                message: 'Dynamic require() can be a security risk'
            },
            {
                pattern: /child_process|exec\(/g,
                severity: 'warning',
                message: 'Command execution detected - ensure proper input sanitization'
            }
        ];
    }
    
    /**
     * Execute security validation
     */
    async execute(code, context = {}) {
        try {
            const issues = [];
            
            // Check each security pattern
            for (const check of this.securityPatterns) {
                const matches = code.matchAll(check.pattern);
                
                for (const match of matches) {
                    const lines = code.substring(0, match.index).split('\n');
                    const line = lines.length;
                    const column = lines[lines.length - 1].length + 1;
                    
                    issues.push({
                        line,
                        column,
                        severity: check.severity,
                        message: check.message,
                        rule: 'security-check'
                    });
                }
            }
            
            const status = this.shouldFail(issues) ? 'fail' : 'pass';
            
            return {
                status,
                issues,
                stats: {
                    errors: issues.filter(i => i.severity === 'error').length,
                    warnings: issues.filter(i => i.severity === 'warning').length,
                    info: issues.filter(i => i.severity === 'info').length
                }
            };
            
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
}

module.exports = SecurityGate;