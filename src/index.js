/**
 * RepoChief Quality Gates
 * Pluggable verification system for AI-generated code
 * 
 * Now with optional cloud storage integration via StorageAdapter
 */

const BaseQualityGate = require('./BaseQualityGate');
const ESLintGate = require('./gates/ESLintGate');
const TestRunnerGate = require('./gates/TestRunnerGate');
const SecurityGate = require('./gates/SecurityGate');
const ComplexityGate = require('./gates/ComplexityGate');
const ResultReporter = require('./ResultReporter');
const QualityRunner = require('./QualityRunner');

// Quality gate registry
const gateRegistry = new Map();

// Register built-in gates
gateRegistry.set('eslint', ESLintGate);
gateRegistry.set('test', TestRunnerGate);
gateRegistry.set('security', SecurityGate);
gateRegistry.set('complexity', ComplexityGate);

/**
 * Create a quality gate instance
 */
function createGate(type, options = {}) {
    const GateClass = gateRegistry.get(type);
    
    if (!GateClass) {
        throw new Error(`Unknown quality gate type: ${type}`);
    }
    
    return new GateClass(options);
}

/**
 * Register a custom quality gate
 */
function registerGate(type, GateClass) {
    if (!(GateClass.prototype instanceof BaseQualityGate)) {
        throw new Error('Gate must extend BaseQualityGate');
    }
    
    gateRegistry.set(type, GateClass);
}

/**
 * Get all registered gate types
 */
function getGateTypes() {
    return Array.from(gateRegistry.keys());
}

/**
 * Create a quality runner with all gates
 */
function createQualityRunner(options = {}) {
    return {
        createGate,
        registerGate,
        getGateTypes,
        gates: gateRegistry
    };
}

module.exports = {
    // Core classes
    BaseQualityGate,
    QualityGate: BaseQualityGate, // Alias for consistency
    ResultReporter,
    QualityRunner,
    
    // Gate implementations
    ESLintGate,
    TestRunnerGate,
    SecurityGate,
    ComplexityGate,
    
    // Factory functions
    createGate,
    createQualityRunner,
    registerGate,
    getGateTypes,
    
    // Convenience methods for storage integration
    createRunnerWithStorage: QualityRunner.createWithGates,
    createCIRunner: QualityRunner.createForCI
};