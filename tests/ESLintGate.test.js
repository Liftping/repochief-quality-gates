const { expect } = require('chai');
const ESLintGate = require('../src/gates/ESLintGate');

describe('ESLintGate', () => {
    let eslintGate;
    
    beforeEach(() => {
        eslintGate = new ESLintGate();
    });
    
    describe('execute', () => {
        it('should pass valid JavaScript code', async () => {
            const validCode = `function greet(name) {
    return 'Hello, ' + name + '!';
}

function farewell(name) {
    return 'Goodbye, ' + name + '!';
}

module.exports = { greet, farewell };`;
            
            const result = await eslintGate.execute(validCode);
            expect(result.status).to.equal('pass');
            expect(result.issues).to.be.an('array').with.lengthOf(0);
            expect(result.stats.errors).to.equal(0);
        });
        
        it('should fail code with errors', async () => {
            const invalidCode = `
                // Missing variable declaration
                message = 'Hello World';
                
                // Unused variable
                const unused = 42;
                
                // Using var instead of const/let
                var oldStyle = 'bad';
                
                // Missing semicolon
                const noSemi = 'missing'
                
                // Using eval
                eval('console.log("dangerous")');
            `;
            
            const result = await eslintGate.execute(invalidCode);
            expect(result.status).to.equal('fail');
            expect(result.issues).to.be.an('array');
            expect(result.stats.errors).to.be.greaterThan(0);
        });
        
        it('should handle TypeScript context', async () => {
            const tsCode = `
                const message: string = 'Hello TypeScript';
                console.log(message);
            `;
            
            const result = await eslintGate.execute(tsCode, { language: 'typescript' });
            expect(result.status).to.exist;
            expect(result.details.fileName).to.include('.ts');
        });
        
        it('should detect fixable issues', async () => {
            const fixableCode = `
                const message = "double quotes";
                const value=42;  // Missing spaces
            `;
            
            const result = await eslintGate.execute(fixableCode);
            expect(result.stats.fixable).to.be.greaterThan(0);
        });
        
        it('should handle syntax errors gracefully', async () => {
            const syntaxErrorCode = `
                const broken = {
                    // Missing closing brace
            `;
            
            const result = await eslintGate.execute(syntaxErrorCode);
            expect(result.status).to.equal('fail');
            expect(result.issues).to.be.an('array');
        });
    });
    
    describe('fix', () => {
        it('should automatically fix fixable issues', async () => {
            const codeToFix = `
                const message = "double quotes";
                var oldVar = 42;
                const unused = 'remove me';
            `;
            
            const result = await eslintGate.fix(codeToFix);
            expect(result.fixed).to.be.true;
            expect(result.code).to.include("'double quotes'"); // Fixed to single quotes
            expect(result.code).to.include('const oldVar'); // Fixed var to const
        });
    });
    
    describe('custom configuration', () => {
        it('should accept custom ESLint rules', async () => {
            const customGate = new ESLintGate({
                rules: {
                    'no-console': 'off',
                    'indent': ['error', 2]
                }
            });
            
            const code = `
console.log('This should be allowed');
    const indentedWrong = true; // 4 spaces instead of 2
            `;
            
            const result = await customGate.execute(code);
            const consoleWarnings = result.issues.filter(i => i.rule === 'no-console');
            const indentErrors = result.issues.filter(i => i.rule === 'indent');
            
            expect(consoleWarnings).to.have.lengthOf(0);
            expect(indentErrors).to.have.lengthOf.above(0);
        });
    });
});