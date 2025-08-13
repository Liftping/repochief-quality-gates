/**
 * Result Reporter for Quality Gates
 * Provides optional persistence of quality gate results using StorageAdapter
 * 
 * This reporter enables quality gate results to be saved to cloud or local storage
 * while maintaining backward compatibility for users who don't need persistence
 */

const EventEmitter = require('events');

class ResultReporter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Storage adapter is optional - can work without persistence
    this.storageAdapter = options.storageAdapter || null;
    this.enabled = options.enabled !== false;
    this.taskId = options.taskId || null;
    this.batchMode = options.batchMode || false;
    this.batchResults = [];
    this.reportMetadata = options.metadata || {};
  }

  /**
   * Set storage adapter for persistence
   * @param {StorageAdapter} adapter - Storage adapter instance from repochief-core
   */
  setStorageAdapter(adapter) {
    this.storageAdapter = adapter;
  }

  /**
   * Set task context for results
   * @param {string} taskId - Task ID to associate results with
   */
  setTaskContext(taskId) {
    this.taskId = taskId;
  }

  /**
   * Report a quality gate result
   * @param {string} gateName - Name of the quality gate
   * @param {Object} result - Gate execution result
   * @returns {Promise<Object>} Result with optional storage confirmation
   */
  async reportResult(gateName, result) {
    if (!this.enabled) {
      return result;
    }

    // Enhance result with metadata
    const enhancedResult = {
      ...result,
      gateName,
      taskId: this.taskId,
      timestamp: new Date().toISOString(),
      metadata: {
        ...this.reportMetadata,
        ...result.metadata
      }
    };

    // Emit event for real-time monitoring
    this.emit('result', enhancedResult);

    // Handle batch mode
    if (this.batchMode) {
      this.batchResults.push(enhancedResult);
      return enhancedResult;
    }

    // Persist if storage is available
    if (this.storageAdapter && this.taskId) {
      try {
        const stored = await this.storageAdapter.storeQualityResult(
          this.taskId,
          gateName,
          result
        );
        enhancedResult.stored = true;
        enhancedResult.storageId = stored.id;
      } catch (error) {
        console.warn(`Failed to store quality result: ${error.message}`);
        enhancedResult.stored = false;
        enhancedResult.storageError = error.message;
      }
    }

    return enhancedResult;
  }

  /**
   * Report multiple gate results at once
   * @param {Array<Object>} results - Array of gate results
   * @returns {Promise<Array>} Enhanced results
   */
  async reportBatch(results) {
    const enhancedResults = [];

    for (const { gateName, result } of results) {
      const enhanced = await this.reportResult(gateName, result);
      enhancedResults.push(enhanced);
    }

    return enhancedResults;
  }

  /**
   * Flush batch results to storage
   * @returns {Promise<Object>} Batch storage summary
   */
  async flushBatch() {
    if (!this.batchMode || this.batchResults.length === 0) {
      return { flushed: 0 };
    }

    const summary = {
      total: this.batchResults.length,
      stored: 0,
      failed: 0,
      results: []
    };

    if (this.storageAdapter && this.taskId) {
      for (const result of this.batchResults) {
        try {
          const stored = await this.storageAdapter.storeQualityResult(
            this.taskId,
            result.gateName,
            result
          );
          result.stored = true;
          result.storageId = stored.id;
          summary.stored++;
        } catch (error) {
          result.stored = false;
          result.storageError = error.message;
          summary.failed++;
        }
        summary.results.push(result);
      }
    }

    // Clear batch after flush
    this.batchResults = [];
    
    // Emit summary event
    this.emit('batch-flushed', summary);

    return summary;
  }

  /**
   * Generate a summary report of all results
   * @param {Array<Object>} results - Array of gate results
   * @returns {Object} Summary report
   */
  generateSummary(results) {
    const summary = {
      total: results.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      gates: {},
      timestamp: new Date().toISOString(),
      taskId: this.taskId
    };

    for (const result of results) {
      // Count by status
      if (result.status === 'passed') summary.passed++;
      else if (result.status === 'failed') summary.failed++;
      else if (result.status === 'skipped') summary.skipped++;
      else if (result.status === 'error') summary.errors++;

      // Group by gate
      const gateName = result.gateName || result.gate;
      if (!summary.gates[gateName]) {
        summary.gates[gateName] = {
          total: 0,
          passed: 0,
          failed: 0,
          results: []
        };
      }

      summary.gates[gateName].total++;
      if (result.status === 'passed') {
        summary.gates[gateName].passed++;
      } else if (result.status === 'failed') {
        summary.gates[gateName].failed++;
      }
      summary.gates[gateName].results.push(result);
    }

    // Calculate overall status
    summary.overallStatus = summary.failed > 0 || summary.errors > 0 ? 'failed' : 'passed';
    summary.score = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

    return summary;
  }

  /**
   * Store a summary report
   * @param {Object} summary - Summary report to store
   * @returns {Promise<Object>} Stored summary
   */
  async storeSummary(summary) {
    if (!this.storageAdapter || !this.taskId) {
      return summary;
    }

    try {
      const stored = await this.storageAdapter.storeQualityResult(
        this.taskId,
        'summary',
        summary
      );
      summary.stored = true;
      summary.storageId = stored.id;
    } catch (error) {
      summary.stored = false;
      summary.storageError = error.message;
    }

    return summary;
  }

  /**
   * Create a reporter with automatic storage detection
   * @param {Object} options - Reporter options
   * @returns {Promise<ResultReporter>} Configured reporter
   */
  static async createWithAutoStorage(options = {}) {
    const reporter = new ResultReporter(options);

    // Try to load StorageFactory from repochief-core
    try {
      // Try direct local path first for development
      let StorageFactory;
      try {
        StorageFactory = require('../../repochief-core/src/storage').StorageFactory;
      } catch {
        // Fall back to npm package
        StorageFactory = require('@liftping/repochief-core/src/storage').StorageFactory;
      }
      
      const adapter = StorageFactory.create();
      await adapter.initialize();
      reporter.setStorageAdapter(adapter);
      console.log('✅ Quality gate results will be stored using', adapter.getType());
    } catch (error) {
      // Storage not available - continue without persistence
      console.log('ℹ️ Quality gate results will not be persisted (storage not available)');
    }

    return reporter;
  }

  /**
   * Format result for console output
   * @param {Object} result - Gate result
   * @returns {string} Formatted output
   */
  static formatResult(result) {
    const status = result.status.toUpperCase();
    const symbol = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' : 
                   result.status === 'skipped' ? '⏭️' : '⚠️';
    
    let output = `${symbol} ${result.gateName || result.gate}: ${status}`;
    
    if (result.score !== undefined) {
      output += ` (Score: ${result.score})`;
    }
    
    if (result.details) {
      output += '\n   Details: ' + JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ');
    }
    
    return output;
  }
}

module.exports = ResultReporter;