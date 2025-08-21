#!/bin/bash

# Atomic Guide D1 Database Setup Script
# This script creates and configures D1 databases for development and production

set -e

echo "🚀 Atomic Guide D1 Database Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if wrangler is installed
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
        echo "npm install -g wrangler"
        exit 1
    fi
}

# Function to create a D1 database
create_database() {
    local db_name=$1
    local env=$2
    
    echo -e "${YELLOW}Creating D1 database: ${db_name}${NC}"
    
    # Create the database
    output=$(wrangler d1 create ${db_name} 2>&1)
    
    # Extract database ID from output
    db_id=$(echo "$output" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
    
    if [ -z "$db_id" ]; then
        echo -e "${RED}❌ Failed to create database or extract ID${NC}"
        echo "$output"
        return 1
    fi
    
    echo -e "${GREEN}✅ Created database with ID: ${db_id}${NC}"
    echo "$db_id"
}

# Function to apply schema to database
apply_schema() {
    local db_name=$1
    local schema_file=$2
    
    echo -e "${YELLOW}Applying schema to ${db_name}...${NC}"
    
    if [ ! -f "$schema_file" ]; then
        echo -e "${RED}❌ Schema file not found: ${schema_file}${NC}"
        return 1
    fi
    
    # Apply the schema
    wrangler d1 execute ${db_name} --file=${schema_file}
    
    echo -e "${GREEN}✅ Schema applied successfully${NC}"
}

# Main setup process
main() {
    echo "Checking prerequisites..."
    check_wrangler
    
    # Check if we're in the project root
    if [ ! -f "wrangler.jsonc" ]; then
        echo -e "${RED}❌ Please run this script from the project root directory${NC}"
        exit 1
    fi
    
    # Create production database
    echo ""
    echo "Step 1: Creating production D1 database"
    echo "----------------------------------------"
    prod_db_id=$(create_database "atomic-guide-db")
    
    # Create preview/development database
    echo ""
    echo "Step 2: Creating preview/development D1 database"
    echo "-------------------------------------------------"
    preview_db_id=$(create_database "atomic-guide-db-preview")
    
    # Apply schema to both databases
    echo ""
    echo "Step 3: Applying schema to databases"
    echo "-------------------------------------"
    
    # Apply to production
    apply_schema "atomic-guide-db" "src/db/schema.sql"
    
    # Apply to preview
    apply_schema "atomic-guide-db-preview" "src/db/schema.sql"
    
    # Update wrangler.jsonc with the IDs
    echo ""
    echo "Step 4: Updating wrangler.jsonc"
    echo "--------------------------------"
    
    # Create backup of wrangler.jsonc
    cp wrangler.jsonc wrangler.jsonc.backup
    
    # Update the placeholder IDs in wrangler.jsonc
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/YOUR_DATABASE_ID_HERE/${prod_db_id}/g" wrangler.jsonc
        sed -i '' "s/YOUR_PREVIEW_DATABASE_ID_HERE/${preview_db_id}/g" wrangler.jsonc
    else
        # Linux
        sed -i "s/YOUR_DATABASE_ID_HERE/${prod_db_id}/g" wrangler.jsonc
        sed -i "s/YOUR_PREVIEW_DATABASE_ID_HERE/${preview_db_id}/g" wrangler.jsonc
    fi
    
    echo -e "${GREEN}✅ Updated wrangler.jsonc with database IDs${NC}"
    
    # Create a tenant for local development
    echo ""
    echo "Step 5: Creating development tenant"
    echo "------------------------------------"
    
    # Create SQL for dev tenant
    cat > /tmp/dev_tenant.sql << EOF
INSERT INTO tenant_config (
    tenant_id,
    institution_name,
    lms_type,
    lms_url
) VALUES (
    'dev_tenant_001',
    'Development University',
    'canvas',
    'https://canvas.dev.edu'
);
EOF
    
    # Apply to preview database
    wrangler d1 execute atomic-guide-db-preview --file=/tmp/dev_tenant.sql
    
    echo -e "${GREEN}✅ Development tenant created${NC}"
    
    # Clean up temp file
    rm /tmp/dev_tenant.sql
    
    # Summary
    echo ""
    echo "========================================="
    echo -e "${GREEN}✅ D1 Database Setup Complete!${NC}"
    echo "========================================="
    echo ""
    echo "Database IDs:"
    echo "  Production:  ${prod_db_id}"
    echo "  Preview:     ${preview_db_id}"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm run dev' to start local development"
    echo "2. Test D1 connectivity with sample queries"
    echo "3. For production deployment: 'npm run deploy'"
    echo ""
    echo "To rollback: restore wrangler.jsonc.backup"
    echo ""
    echo "To list your databases: wrangler d1 list"
    echo "To delete a database: wrangler d1 delete <database-name>"
}

# Run main function
main "$@"