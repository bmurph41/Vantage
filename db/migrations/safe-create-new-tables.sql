-- Safe table creation for new features (no data loss)
-- Run: psql $DATABASE_URL -f db/migrations/safe-create-new-tables.sql

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'text',
  file_name TEXT,
  mime_type TEXT,
  content_text TEXT,
  chunk_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  metadata JSONB DEFAULT '{}',
  uploaded_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS knowledge_docs_org_idx ON knowledge_documents(org_id);
CREATE INDEX IF NOT EXISTS knowledge_docs_status_idx ON knowledge_documents(status);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id VARCHAR NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  org_id VARCHAR NOT NULL,
  chunk_index INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  embedding vector(1536),
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_idx ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_org_idx ON knowledge_chunks(org_id);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  title TEXT,
  advisory_mode TEXT DEFAULT 'general',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_conversations_org_idx ON ai_conversations(org_id);
CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON ai_conversations(user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id VARCHAR NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  advisory_mode TEXT,
  page TEXT,
  rag_chunk_ids JSONB DEFAULT '[]',
  feedback_rating TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_messages_conv_idx ON ai_messages(conversation_id);

CREATE TABLE IF NOT EXISTS om_document_versions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id VARCHAR NOT NULL REFERENCES om_builder_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  change_description TEXT,
  status document_status NOT NULL DEFAULT 'draft',
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS om_doc_versions_document_idx ON om_document_versions(document_id);
CREATE INDEX IF NOT EXISTS om_doc_versions_version_idx ON om_document_versions(document_id, version_number);
