#!/bin/bash

# RepoChief Quality Gates Test Runner

echo "🧪 Running RepoChief Quality Gates tests..."
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run tests with coverage
echo "🏃 Running tests with coverage..."
npx mocha tests/**/*.test.js \
    --reporter spec \
    --timeout 10000 \
    --exit

# Check test result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
else
    echo ""
    echo "❌ Some tests failed!"
    exit 1
fi