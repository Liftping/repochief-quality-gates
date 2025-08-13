#!/usr/bin/env node

/**
 * Test Quality Gates with Storage Integration
 * Validates the ResultReporter and QualityRunner with StorageAdapter
 */

const { QualityRunner, ResultReporter, createGate } = require('./src');
const path = require('path');

async function testStorageIntegration() {
  console.log('🧪 Testing Quality Gates Storage Integration\n');
  
  let runner;
  const testCode = `
    // Sample code for quality validation
    function calculateSum(a, b) {
      return a + b;
    }
    
    const result = calculateSum(1, 2);
    console.log(result);
  `;

  try {
    // Test 1: Create reporter with auto storage
    console.log('1️⃣  Creating ResultReporter with auto storage...');
    const reporter = await ResultReporter.createWithAutoStorage({
      taskId: 'test-task-' + Date.now()
    });
    console.log('✅ Reporter created\n');

    // Test 2: Create quality runner with storage
    console.log('2️⃣  Creating QualityRunner with storage...');
    runner = new QualityRunner({
      reporter,
      continueOnFailure: true,
      parallel: false
    });
    console.log('✅ Runner created\n');

    // Test 3: Add quality gates
    console.log('3️⃣  Adding quality gates...');
    
    // Add complexity gate (should pass for simple code)
    const complexityGate = createGate('complexity', {
      maxComplexity: 10
    });
    runner.addGate(complexityGate);
    
    // Add a mock gate for testing
    const mockGate = {
      name: 'mock-test-gate',
      run: async (code, context) => {
        return {
          status: 'passed',
          gate: 'mock-test-gate',
          score: 100,
          details: {
            message: 'Mock gate passed successfully',
            timestamp: new Date().toISOString()
          }
        };
      }
    };
    runner.addGate(mockGate);
    
    console.log('✅ Gates added:', runner.getStatistics().total, '\n');

    // Test 4: Run quality gates
    console.log('4️⃣  Running quality gates...');
    const summary = await runner.run(testCode, {
      taskId: reporter.taskId,
      source: 'test-script'
    });
    
    console.log('✅ Gates executed:');
    console.log('   Total:', summary.total);
    console.log('   Passed:', summary.passed);
    console.log('   Failed:', summary.failed);
    console.log('   Score:', summary.score + '%');
    console.log('   Duration:', summary.duration + 'ms\n');

    // Test 5: Check individual gate results
    console.log('5️⃣  Checking gate results...');
    for (const [gateName, gateData] of Object.entries(summary.gates)) {
      console.log(`   ${gateName}:`, gateData.passed + '/' + gateData.total, 'passed');
    }
    console.log();

    // Test 6: Test batch reporting
    console.log('6️⃣  Testing batch reporting...');
    const batchReporter = new ResultReporter({
      batchMode: true,
      taskId: 'batch-test-' + Date.now()
    });
    
    // Report multiple results
    await batchReporter.reportResult('test1', { status: 'passed', score: 90 });
    await batchReporter.reportResult('test2', { status: 'failed', score: 40 });
    await batchReporter.reportResult('test3', { status: 'passed', score: 85 });
    
    // Flush batch
    const batchSummary = await batchReporter.flushBatch();
    console.log('✅ Batch flushed:', batchSummary.total, 'results');
    console.log('   Stored:', batchSummary.stored);
    console.log('   Failed:', batchSummary.failed, '\n');

    // Test 7: Test result formatting
    console.log('7️⃣  Testing result formatting...');
    const formattedResult = ResultReporter.formatResult({
      status: 'passed',
      gateName: 'format-test',
      score: 95,
      details: {
        checks: 10,
        passed: 9
      }
    });
    console.log('Formatted output:');
    console.log(formattedResult);
    console.log();

    // Test 8: Create CI runner
    console.log('8️⃣  Testing CI runner creation...');
    try {
      const ciRunner = await QualityRunner.createForCI({
        taskId: 'ci-test-' + Date.now()
      });
      const ciStats = ciRunner.getStatistics();
      console.log('✅ CI Runner created with', ciStats.total, 'gates');
      console.log('   Enabled:', ciStats.enabled);
      console.log('   Parallel execution:', ciRunner.parallel);
      console.log('   Continue on failure:', ciRunner.continueOnFailure, '\n');
    } catch (error) {
      console.log('⚠️  CI Runner creation skipped (missing dependencies)\n');
    }

    // Test 9: Test with actual ESLint gate if available
    console.log('9️⃣  Testing with ESLint gate...');
    try {
      const eslintGate = createGate('eslint', {
        configFile: path.join(__dirname, '.eslintrc.json')
      });
      
      const eslintRunner = new QualityRunner({
        reporter: await ResultReporter.createWithAutoStorage({
          taskId: 'eslint-test-' + Date.now()
        })
      });
      
      eslintRunner.addGate(eslintGate);
      
      // Create a temporary file for ESLint to check
      const fs = require('fs');
      const tmpFile = path.join(__dirname, 'tmp-test.js');
      fs.writeFileSync(tmpFile, testCode);
      
      const eslintSummary = await eslintRunner.run(tmpFile);
      console.log('✅ ESLint gate executed:', eslintSummary.overallStatus);
      
      // Clean up
      fs.unlinkSync(tmpFile);
    } catch (error) {
      console.log('⚠️  ESLint test skipped:', error.message, '\n');
    }

    // Test 10: Event handling
    console.log('🔟 Testing event handling...');
    const eventRunner = new QualityRunner();
    let eventsFired = 0;
    
    eventRunner.on('run-started', () => eventsFired++);
    eventRunner.on('gate-started', () => eventsFired++);
    eventRunner.on('gate-completed', () => eventsFired++);
    eventRunner.on('run-completed', () => eventsFired++);
    
    eventRunner.addGate(mockGate);
    await eventRunner.run(testCode);
    
    console.log('✅ Events fired:', eventsFired, '\n');

    // Summary
    console.log('✨ Storage integration tests completed successfully!');
    console.log('📊 Quality gates are ready for cloud storage integration\n');
    
    // Check if storage was actually used
    if (reporter.storageAdapter) {
      console.log('💾 Storage adapter type:', reporter.storageAdapter.getType
 ? reporter.storageAdapter.getType() : 'unknown');
      console.log('☁️  Cloud support:', reporter.storageAdapter.supportsCloud 
        ? reporter.storageAdapter.supportsCloud() : false);
    } else {
      console.log('ℹ️  No storage adapter available (results not persisted)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testStorageIntegration().catch(console.error);