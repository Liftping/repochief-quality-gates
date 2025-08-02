/**
 * Complexity Quality Gate
 * Analyzes code complexity metrics
 */

const BaseQualityGate = require('../BaseQualityGate');

class ComplexityGate extends BaseQualityGate {
    constructor(options = {}) {
        super(options);
        
        // Complexity thresholds
        this.thresholds = {
            maxCyclomaticComplexity: options.maxCyclomaticComplexity || 10,
            maxDepth: options.maxDepth || 4,
            maxLinesPerFunction: options.maxLinesPerFunction || 50,
            maxParametersPerFunction: options.maxParametersPerFunction || 5
        };
    }
    
    /**
     * Execute complexity analysis
     */
    async execute(code, context = {}) {
        try {
            const issues = [];
            const functions = this.extractFunctions(code);
            
            for (const func of functions) {
                // Check cyclomatic complexity
                const complexity = this.calculateCyclomaticComplexity(func.body);
                if (complexity > this.thresholds.maxCyclomaticComplexity) {
                    issues.push({
                        line: func.line,
                        column: 1,
                        severity: 'warning',
                        message: `Function '${func.name}' has cyclomatic complexity of ${complexity} (max: ${this.thresholds.maxCyclomaticComplexity})`,
                        rule: 'cyclomatic-complexity'
                    });
                }
                
                // Check function length
                const lines = func.body.split('\n').length;
                if (lines > this.thresholds.maxLinesPerFunction) {
                    issues.push({
                        line: func.line,
                        column: 1,
                        severity: 'warning',
                        message: `Function '${func.name}' has ${lines} lines (max: ${this.thresholds.maxLinesPerFunction})`,
                        rule: 'function-length'
                    });
                }
                
                // Check parameter count
                if (func.params > this.thresholds.maxParametersPerFunction) {
                    issues.push({
                        line: func.line,
                        column: 1,
                        severity: 'warning',
                        message: `Function '${func.name}' has ${func.params} parameters (max: ${this.thresholds.maxParametersPerFunction})`,
                        rule: 'parameter-count'
                    });
                }
            }
            
            const status = issues.length === 0 ? 'pass' : 'warning';
            
            return {
                status,
                issues,
                stats: {
                    functionsAnalyzed: functions.length,
                    avgComplexity: this.calculateAverageComplexity(functions),
                    maxComplexity: Math.max(...functions.map(f => 
                        this.calculateCyclomaticComplexity(f.body)
                    ))
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
    
    /**
     * Extract functions from code (simplified)
     */
    extractFunctions(code) {
        const functions = [];
        const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/g;
        
        let match;
        while ((match = functionRegex.exec(code)) !== null) {
            const lines = code.substring(0, match.index).split('\n');
            const line = lines.length;
            const name = match[1] || match[3] || 'anonymous';
            const params = match[2] ? match[2].split(',').filter(p => p.trim()).length : 0;
            
            // Extract function body (simplified)
            const bodyStart = match.index + match[0].length;
            let bodyEnd = code.indexOf('\n}', bodyStart);
            if (bodyEnd === -1) bodyEnd = code.length;
            
            functions.push({
                name,
                line,
                params,
                body: code.substring(bodyStart, bodyEnd)
            });
        }
        
        return functions;
    }
    
    /**
     * Calculate cyclomatic complexity (simplified)
     */
    calculateCyclomaticComplexity(code) {
        let complexity = 1;
        
        // Count decision points
        const decisionPatterns = [
            /\bif\b/g,
            /\belse\s+if\b/g,
            /\bfor\b/g,
            /\bwhile\b/g,
            /\bcase\b/g,
            /\bcatch\b/g,
            /\?\s*[^:]+:/g,  // ternary operator
            /&&/g,
            /\|\|/g
        ];
        
        for (const pattern of decisionPatterns) {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }
    
    /**
     * Calculate average complexity
     */
    calculateAverageComplexity(functions) {
        if (functions.length === 0) return 0;
        
        const total = functions.reduce((sum, func) => 
            sum + this.calculateCyclomaticComplexity(func.body), 0
        );
        
        return Math.round(total / functions.length * 10) / 10;
    }
}

module.exports = ComplexityGate;