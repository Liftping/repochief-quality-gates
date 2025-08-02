/**
 * Base Quality Gate
 * Abstract class for all quality verification gates
 */

const EventEmitter = require('events');

class BaseQualityGate extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.name = options.name || this.constructor.name;
        this.enabled = options.enabled !== false;
        this.config = options.config || {};
        this.timeout = options.timeout || 30000; // 30 seconds default
        this.retryCount = options.retryCount || 0;
        this.failureThreshold = options.failureThreshold || 1;
    }
    
    /**
     * Execute the quality gate
     * Must be implemented by subclasses
     */
    async execute(code, context = {}) {
        throw new Error('execute() must be implemented by subclass');
    }
    
    /**
     * Run the gate with error handling and retries
     */
    async run(code, context = {}) {
        if (!this.enabled) {
            return {
                status: 'skipped',
                gate: this.name,
                reason: 'Gate is disabled'
            };
        }
        
        let lastError;
        let attempts = 0;
        
        while (attempts <= this.retryCount) {
            try {
                const startTime = Date.now();
                
                // Run with timeout
                const result = await this.executeWithTimeout(code, context);
                
                const duration = Date.now() - startTime;
                
                // Emit result
                this.emit('complete', {
                    gate: this.name,
                    status: result.status,
                    duration,
                    attempts: attempts + 1
                });
                
                return {
                    ...result,
                    gate: this.name,
                    duration,
                    attempts: attempts + 1
                };
                
            } catch (error) {
                lastError = error;
                attempts++;
                
                if (attempts <= this.retryCount) {
                    this.emit('retry', {
                        gate: this.name,
                        attempt: attempts,
                        error: error.message
                    });
                    
                    // Wait before retry
                    await this.sleep(1000 * attempts);
                }
            }
        }
        
        // All attempts failed
        return {
            status: 'error',
            gate: this.name,
            error: lastError.message,
            details: {
                attempts,
                lastError: lastError.stack
            }
        };
    }
    
    /**
     * Execute with timeout
     */
    async executeWithTimeout(code, context) {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Gate ${this.name} timed out after ${this.timeout}ms`));
            }, this.timeout);
            
            try {
                const result = await this.execute(code, context);
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }
    
    /**
     * Validate configuration
     */
    validateConfig() {
        // Override in subclasses if needed
        return true;
    }
    
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Parse severity levels
     */
    parseSeverity(level) {
        const severityMap = {
            'error': 3,
            'warning': 2,
            'info': 1,
            'hint': 0
        };
        
        return severityMap[level.toLowerCase()] || 0;
    }
    
    /**
     * Check if gate should fail based on issues
     */
    shouldFail(issues) {
        const errors = issues.filter(i => this.parseSeverity(i.severity) >= 3);
        return errors.length >= this.failureThreshold;
    }
}

module.exports = BaseQualityGate;