/**
 * Quality Runner with Storage Integration
 * Orchestrates multiple quality gates and reports results
 * 
 * This runner provides a high-level interface for running quality gates
 * with optional result persistence via StorageAdapter
 */

const EventEmitter = require('events');
const ResultReporter = require('./ResultReporter');

class QualityRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.gates = [];
    this.reporter = options.reporter || new ResultReporter(options);
    this.continueOnFailure = options.continueOnFailure !== false;
    this.parallel = options.parallel || false;
    this.timeout = options.timeout || 60000; // 60 seconds default
  }

  /**
   * Add a quality gate to the runner
   * @param {BaseQualityGate} gate - Quality gate instance
   * @param {Object} options - Gate-specific options
   */
  addGate(gate, options = {}) {
    this.gates.push({
      gate,
      options,
      enabled: options.enabled !== false
    });
    return this;
  }

  /**
   * Remove a quality gate
   * @param {string} gateName - Name of gate to remove
   */
  removeGate(gateName) {
    this.gates = this.gates.filter(g => g.gate.name !== gateName);
    return this;
  }

  /**
   * Run all configured quality gates
   * @param {string|Object} code - Code to validate
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution summary
   */
  async run(code, context = {}) {
    const startTime = Date.now();
    const results = [];
    
    // Set task context if provided
    if (context.taskId) {
      this.reporter.setTaskContext(context.taskId);
    }

    // Enable batch mode for efficiency
    this.reporter.batchMode = true;

    this.emit('run-started', {
      gates: this.gates.length,
      context
    });

    if (this.parallel) {
      // Run gates in parallel
      await this._runParallel(code, context, results);
    } else {
      // Run gates sequentially
      await this._runSequential(code, context, results);
    }

    // Flush batch results to storage
    await this.reporter.flushBatch();

    // Generate summary
    const summary = this.reporter.generateSummary(results);
    summary.duration = Date.now() - startTime;
    
    // Store summary if storage is available
    await this.reporter.storeSummary(summary);

    this.emit('run-completed', summary);

    return summary;
  }

  /**
   * Run gates sequentially
   */
  async _runSequential(code, context, results) {
    for (const { gate, options, enabled } of this.gates) {
      if (!enabled) {
        const skipped = {
          status: 'skipped',
          gate: gate.name,
          reason: 'Gate disabled'
        };
        results.push(skipped);
        await this.reporter.reportResult(gate.name, skipped);
        continue;
      }

      try {
        this.emit('gate-started', gate.name);
        
        const result = await this._runGateWithTimeout(gate, code, context);
        results.push(result);
        
        await this.reporter.reportResult(gate.name, result);
        
        this.emit('gate-completed', {
          gate: gate.name,
          result
        });

        // Stop on failure if configured
        if (!this.continueOnFailure && result.status === 'failed') {
          this.emit('run-stopped', {
            reason: 'Gate failed',
            gate: gate.name
          });
          break;
        }
      } catch (error) {
        const errorResult = {
          status: 'error',
          gate: gate.name,
          error: error.message,
          stack: error.stack
        };
        results.push(errorResult);
        
        await this.reporter.reportResult(gate.name, errorResult);
        
        this.emit('gate-error', {
          gate: gate.name,
          error
        });

        if (!this.continueOnFailure) {
          break;
        }
      }
    }
  }

  /**
   * Run gates in parallel
   */
  async _runParallel(code, context, results) {
    const promises = this.gates.map(async ({ gate, options, enabled }) => {
      if (!enabled) {
        const skipped = {
          status: 'skipped',
          gate: gate.name,
          reason: 'Gate disabled'
        };
        await this.reporter.reportResult(gate.name, skipped);
        return skipped;
      }

      try {
        this.emit('gate-started', gate.name);
        
        const result = await this._runGateWithTimeout(gate, code, context);
        
        await this.reporter.reportResult(gate.name, result);
        
        this.emit('gate-completed', {
          gate: gate.name,
          result
        });
        
        return result;
      } catch (error) {
        const errorResult = {
          status: 'error',
          gate: gate.name,
          error: error.message,
          stack: error.stack
        };
        
        await this.reporter.reportResult(gate.name, errorResult);
        
        this.emit('gate-error', {
          gate: gate.name,
          error
        });
        
        return errorResult;
      }
    });

    const parallelResults = await Promise.all(promises);
    results.push(...parallelResults);
  }

  /**
   * Run a gate with timeout
   */
  async _runGateWithTimeout(gate, code, context) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Gate ${gate.name} timed out after ${this.timeout}ms`));
      }, this.timeout);

      try {
        const result = await gate.run(code, context);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Create a runner with pre-configured gates
   * @param {Array<string>} gateTypes - Gate types to include
   * @param {Object} options - Runner options
   * @returns {Promise<QualityRunner>} Configured runner
   */
  static async createWithGates(gateTypes = ['eslint', 'complexity'], options = {}) {
    const runner = new QualityRunner(options);
    
    // Create reporter with auto storage
    runner.reporter = await ResultReporter.createWithAutoStorage(options);
    
    // Load gate registry
    const { createGate } = require('./index');
    
    // Add requested gates
    for (const type of gateTypes) {
      try {
        const gate = createGate(type, options[type] || {});
        runner.addGate(gate);
      } catch (error) {
        console.warn(`Failed to create gate ${type}: ${error.message}`);
      }
    }
    
    return runner;
  }

  /**
   * Create a runner for CI/CD environments
   * @param {Object} options - Runner options
   * @returns {Promise<QualityRunner>} CI-optimized runner
   */
  static async createForCI(options = {}) {
    const ciOptions = {
      continueOnFailure: false,
      parallel: true,
      timeout: 120000, // 2 minutes for CI
      ...options
    };
    
    // Standard CI gates
    const gateTypes = ['eslint', 'test', 'security', 'complexity'];
    
    return QualityRunner.createWithGates(gateTypes, ciOptions);
  }

  /**
   * Get gate statistics
   * @returns {Object} Statistics about configured gates
   */
  getStatistics() {
    const stats = {
      total: this.gates.length,
      enabled: this.gates.filter(g => g.enabled).length,
      disabled: this.gates.filter(g => !g.enabled).length,
      gates: this.gates.map(g => ({
        name: g.gate.name,
        enabled: g.enabled,
        timeout: g.gate.timeout
      }))
    };
    
    return stats;
  }
}

module.exports = QualityRunner;