#!/bin/bash

# MarinaMatch Tier 2 Upgrade - Setup Script
# This script prepares your Replit environment for the upgrade

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Banner
clear
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            MarinaMatch Security & Scale Package                ║"
echo "║                     Tier 2 Upgrade                             ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if running in Replit
if [ -z "$REPL_ID" ]; then
    print_warning "Not running in Replit environment"
    print_info "This script is optimized for Replit but can work elsewhere"
    echo ""
fi

# Step 1: Check Node.js version
print_header "Step 1: Checking Environment"
node_version=$(node --version)
print_info "Node.js version: $node_version"

if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    print_success "npm version: $npm_version"
else
    print_error "npm not found"
    exit 1
fi

# Step 2: Check for required secrets
print_header "Step 2: Validating Secrets"

check_secret() {
    if [ -z "${!1}" ]; then
        print_error "Missing: $1"
        return 1
    else
        print_success "Found: $1"
        return 0
    fi
}

missing_secrets=0

# Required secrets
check_secret "DATABASE_URL" || ((missing_secrets++))
check_secret "AWS_ACCESS_KEY_ID" || ((missing_secrets++))
check_secret "AWS_SECRET_ACCESS_KEY" || ((missing_secrets++))
check_secret "S3_BUCKET_NAME" || ((missing_secrets++))
check_secret "REDIS_URL" || ((missing_secrets++))

if [ $missing_secrets -gt 0 ]; then
    echo ""
    print_error "Missing $missing_secrets required secret(s)"
    print_info "Please add these in the Replit Secrets tab (🔒 icon)"
    echo ""
    print_info "Need help? Check INSTALL.md for detailed instructions"
    exit 1
fi

print_success "All required secrets found"

# Step 3: Test database connection
print_header "Step 3: Testing Database Connection"
print_info "Attempting to connect to database..."

# Try to connect (using a simple query)
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
        print_info "Check your DATABASE_URL in Secrets"
        exit 1
    fi
else
    print_warning "psql not found, skipping database test"
    print_info "Database connection will be tested during migration"
fi

# Step 4: Install dependencies
print_header "Step 4: Installing Dependencies"
print_info "Installing new npm packages..."

npm install --save \
  @aws-sdk/client-s3 \
  @aws-sdk/s3-request-presigner \
  file-type \
  ioredis \
  express-rate-limit \
  rate-limit-redis

npm install --save-dev \
  @types/ioredis

print_success "Dependencies installed"

# Step 5: Test S3 connection
print_header "Step 5: Testing S3 Connection"
print_info "Attempting to connect to S3..."

node -e "
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const command = new ListObjectsV2Command({
  Bucket: process.env.S3_BUCKET_NAME,
  MaxKeys: 1
});
client.send(command)
  .then(() => {
    console.log('✓ S3 connection successful');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ S3 connection failed:', err.message);
    process.exit(1);
  });
" || {
    print_error "S3 connection failed"
    print_info "Check your AWS credentials and S3 bucket name in Secrets"
    exit 1
}

# Step 6: Test Redis connection
print_header "Step 6: Testing Redis Connection"
print_info "Attempting to connect to Redis..."

node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 1
});
redis.ping()
  .then(() => {
    console.log('✓ Redis connection successful');
    redis.quit();
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Redis connection failed:', err.message);
    redis.quit();
    process.exit(1);
  });
" || {
    print_error "Redis connection failed"
    print_info "Check your REDIS_URL in Secrets"
    exit 1
}

# Step 7: Create backups directory
print_header "Step 7: Creating Backup Directories"
mkdir -p ~/backups
mkdir -p ~/.logs
print_success "Backup directories created"

# Step 8: Summary
print_header "Setup Complete!"
echo ""
print_success "Environment validated successfully"
print_info "Next steps:"
echo ""
echo "  1. Review INSTALL.md for detailed instructions"
echo "  2. Create a database backup (see Step 1 in INSTALL.md)"
echo "  3. Run database migrations:"
echo "     cd ~/upgrade/database/migrations"
echo "     node run-migrations.ts"
echo ""
print_warning "IMPORTANT: Create a database backup before proceeding!"
echo ""
print_info "Estimated time to complete upgrade: 2 days"
echo ""

# Ask if user wants to continue
echo -e "${YELLOW}Ready to proceed with installation? (y/n)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    print_success "Great! Open INSTALL.md to begin"
else
    print_info "Setup complete. Run this script again when ready."
fi

echo ""
