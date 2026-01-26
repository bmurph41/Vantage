#!/bin/bash

# Multi-Tenant Isolation Test Runner
# Runs comprehensive tenant isolation tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}         Multi-Tenant Isolation Test Suite${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from project root directory${NC}"
    exit 1
fi

# Check if Jest is installed
if ! npm list jest &> /dev/null; then
    echo -e "${YELLOW}Installing test dependencies...${NC}"
    npm install --save-dev jest @jest/globals @types/jest supertest @types/supertest ts-jest
fi

# Check if database is accessible
echo -e "${BLUE}Testing database connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
    echo -e "${RED}✗ Database connection failed${NC}"
    echo -e "${RED}  Check DATABASE_URL environment variable${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Check if server is running
echo -e "${BLUE}Checking if server is running...${NC}"
if curl -s http://localhost:5000/health &> /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${YELLOW}⚠  Server is not running${NC}"
    echo -e "${YELLOW}  Starting server in background...${NC}"
    npm run dev &> /tmp/test-server.log &
    SERVER_PID=$!
    sleep 5
    
    if ! curl -s http://localhost:5000/health &> /dev/null; then
        echo -e "${RED}✗ Failed to start server${NC}"
        cat /tmp/test-server.log
        exit 1
    fi
    echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
fi
echo ""

# Run tests
echo -e "${BLUE}Running isolation tests...${NC}"
echo ""

# Configure Jest
export NODE_OPTIONS="--experimental-vm-modules"

# Run tests with coverage
npx jest testing/isolation-tests.ts \
    --verbose \
    --coverage \
    --coverageDirectory=./coverage/isolation \
    --testTimeout=30000 \
    --detectOpenHandles

TEST_EXIT_CODE=$?

# Kill background server if we started it
if [ ! -z "$SERVER_PID" ]; then
    echo ""
    echo -e "${YELLOW}Stopping test server...${NC}"
    kill $SERVER_PID 2>/dev/null || true
fi

# Report results
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ ALL TESTS PASSED${NC}"
    echo -e "${GREEN}  Multi-tenant isolation is secure!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ✗ TESTS FAILED${NC}"
    echo -e "${RED}  Tenant isolation issues detected - see failures above${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
echo -e "${BLUE}Coverage report: ./coverage/isolation/index.html${NC}"
echo ""

exit $TEST_EXIT_CODE
