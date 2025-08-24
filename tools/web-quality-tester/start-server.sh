#!/bin/bash

# Web Quality Tester Startup Script
# This script starts the web interface for AI quality testing

echo "🧠 Starting AI Quality Tester Web Interface..."
echo "=================================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Check if multiAIManager exists in parent directory
if [ ! -f "../../multiAIManager.js" ]; then
    echo "❌ multiAIManager.js not found in parent directory"
    echo "Please ensure you're running this from the correct location"
    exit 1
fi

# Start the server
echo "🚀 Starting server on http://localhost:3900"
echo "📱 Open your browser and navigate to: http://localhost:3900"
echo "⭐ Press Ctrl+C to stop the server"
echo ""

# Start with nodemon if available, otherwise use node
if command -v nodemon &> /dev/null; then
    nodemon server.js
else
    node server.js
fi
