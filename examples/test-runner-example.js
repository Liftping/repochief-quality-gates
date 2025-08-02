/**
 * Example: Using TestRunnerGate to validate test code
 */

const { TestRunnerGate } = require('../src');

async function validateTestCode() {
    const gate = new TestRunnerGate({
        timeout: 30000 // 30 seconds timeout
    });
    
    // Example 1: Jest test code
    const jestTestCode = `
        const add = (a, b) => a + b;
        const subtract = (a, b) => a - b;
        
        describe('Math operations', () => {
            test('addition works correctly', () => {
                expect(add(2, 3)).toBe(5);
                expect(add(-1, 1)).toBe(0);
            });
            
            test('subtraction works correctly', () => {
                expect(subtract(5, 3)).toBe(2);
                expect(subtract(0, 5)).toBe(-5);
            });
        });
    `;
    
    console.log('Validating Jest test code...');
    const jestResult = await gate.execute(jestTestCode, {
        fileName: 'math.test.js',
        language: 'javascript'
    });
    
    console.log('Jest Validation Result:', JSON.stringify(jestResult, null, 2));
    
    // Example 2: Mocha test code
    const mochaTestCode = `
        const assert = require('assert');
        
        function multiply(a, b) {
            return a * b;
        }
        
        describe('Multiplication', function() {
            it('should multiply positive numbers', function() {
                assert.equal(multiply(3, 4), 12);
            });
            
            it('should handle zero', function() {
                assert.equal(multiply(5, 0), 0);
                assert.equal(multiply(0, 10), 0);
            });
            
            it('should handle negative numbers', function() {
                assert.equal(multiply(-2, 3), -6);
                assert.equal(multiply(-2, -3), 6);
            });
        });
    `;
    
    console.log('\nValidating Mocha test code...');
    const mochaResult = await gate.execute(mochaTestCode, {
        fileName: 'multiply.test.js',
        language: 'javascript'
    });
    
    console.log('Mocha Validation Result:', JSON.stringify(mochaResult, null, 2));
    
    // Example 3: Code without tests (should skip)
    const regularCode = `
        class Calculator {
            add(a, b) {
                return a + b;
            }
            
            multiply(a, b) {
                return a * b;
            }
        }
        
        module.exports = Calculator;
    `;
    
    console.log('\nValidating regular code (no tests)...');
    const skipResult = await gate.execute(regularCode, {
        fileName: 'calculator.js',
        language: 'javascript'
    });
    
    console.log('Skip Result:', JSON.stringify(skipResult, null, 2));
}

// Run the example
validateTestCode().catch(console.error);