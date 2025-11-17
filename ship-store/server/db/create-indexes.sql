-- Performance optimization indexes for Ship Store
-- Run this with: npm run db:push or via execute_sql_tool

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Audit logs table indexes (critical for compliance queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE is_active = true;

-- Categories table indexes
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Historical data table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_historical_data_date ON historical_data(date DESC) WHERE historical_data.date IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action ON audit_logs(entity_type, action, created_at DESC);
