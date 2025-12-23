-- DockTalk V2 Scraper Schema
-- This migration adds new tables for the institutional-grade scraper
-- Feature-flagged behind DOCKTALK_SCRAPER_V2=true

-- Enums
DO $$ BEGIN
  CREATE TYPE dt2_source_type AS ENUM ('rss', 'sitemap', 'html');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_source_status AS ENUM ('active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_run_status AS ENUM ('running', 'success', 'failed', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_discovery_method AS ENUM ('rss', 'sitemap', 'crawl');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_discovered_url_status AS ENUM ('pending', 'fetched', 'skipped', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_relevance_label AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_feedback_action AS ENUM ('saved', 'opened', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dt2_run_event_level AS ENUM ('info', 'warn', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sources table
CREATE TABLE IF NOT EXISTS dt2_sources (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  org_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  type dt2_source_type NOT NULL,
  base_url TEXT NOT NULL,
  discovery_url TEXT NOT NULL,
  allow_patterns TEXT[],
  deny_patterns TEXT[],
  content_selectors JSONB,
  crawl_policy JSONB NOT NULL DEFAULT '{"maxPagesPerRun": 50, "maxDepth": 2, "concurrency": 2, "minDelayMs": 1000, "respectRobotsTxt": true}',
  headers_encrypted TEXT,
  status dt2_source_status NOT NULL DEFAULT 'active',
  trust_score INTEGER DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_sources_user ON dt2_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_dt2_sources_org ON dt2_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_dt2_sources_status ON dt2_sources(status);

-- Runs table
CREATE TABLE IF NOT EXISTS dt2_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  org_id VARCHAR NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status dt2_run_status NOT NULL DEFAULT 'running',
  metrics JSONB,
  triggered_by TEXT DEFAULT 'scheduler',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_runs_user ON dt2_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_dt2_runs_org ON dt2_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_dt2_runs_status ON dt2_runs(status);
CREATE INDEX IF NOT EXISTS idx_dt2_runs_started ON dt2_runs(started_at);

-- Discovered URLs table
CREATE TABLE IF NOT EXISTS dt2_discovered_urls (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR NOT NULL REFERENCES dt2_runs(id) ON DELETE CASCADE,
  source_id VARCHAR NOT NULL REFERENCES dt2_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  discovery_method dt2_discovery_method NOT NULL,
  depth INTEGER,
  status dt2_discovered_url_status NOT NULL DEFAULT 'pending',
  skip_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt2_discovered_urls_run ON dt2_discovered_urls(run_id);
CREATE INDEX IF NOT EXISTS idx_dt2_discovered_urls_source ON dt2_discovered_urls(source_id);
CREATE INDEX IF NOT EXISTS idx_dt2_discovered_urls_normalized ON dt2_discovered_urls(normalized_url);
CREATE INDEX IF NOT EXISTS idx_dt2_discovered_urls_status ON dt2_discovered_urls(status);

-- Fetches table
CREATE TABLE IF NOT EXISTS dt2_fetches (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR NOT NULL REFERENCES dt2_runs(id) ON DELETE CASCADE,
  source_id VARCHAR NOT NULL REFERENCES dt2_sources(id) ON DELETE CASCADE,
  discovered_url_id VARCHAR REFERENCES dt2_discovered_urls(id),
  url TEXT NOT NULL,
  final_url TEXT,
  status_code INTEGER,
  mime_type TEXT,
  etag TEXT,
  last_modified TEXT,
  headers_hash TEXT,
  content_hash TEXT,
  bytes INTEGER,
  fetch_ms INTEGER,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_dt2_fetches_run ON dt2_fetches(run_id);
CREATE INDEX IF NOT EXISTS idx_dt2_fetches_content_hash ON dt2_fetches(content_hash);
CREATE INDEX IF NOT EXISTS idx_dt2_fetches_final_url ON dt2_fetches(final_url);

-- Articles table
CREATE TABLE IF NOT EXISTS dt2_articles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMP,
  main_text TEXT NOT NULL,
  html_fragment TEXT,
  language TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL UNIQUE,
  title_hash TEXT NOT NULL,
  top_keywords TEXT[],
  reading_time_minutes INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_articles_content_hash ON dt2_articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_dt2_articles_title_hash ON dt2_articles(title_hash);
CREATE INDEX IF NOT EXISTS idx_dt2_articles_published ON dt2_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_dt2_articles_created ON dt2_articles(created_at);

-- Article-Source junction table
CREATE TABLE IF NOT EXISTS dt2_article_sources (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id VARCHAR NOT NULL REFERENCES dt2_articles(id) ON DELETE CASCADE,
  source_id VARCHAR NOT NULL REFERENCES dt2_sources(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_article_sources_article ON dt2_article_sources(article_id);
CREATE INDEX IF NOT EXISTS idx_dt2_article_sources_source ON dt2_article_sources(source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dt2_article_sources_unique ON dt2_article_sources(article_id, source_id);

-- Embeddings table
CREATE TABLE IF NOT EXISTS dt2_embeddings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id VARCHAR NOT NULL REFERENCES dt2_articles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_embeddings_article ON dt2_embeddings(article_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dt2_embeddings_unique ON dt2_embeddings(article_id, provider, model);

-- Clusters table
CREATE TABLE IF NOT EXISTS dt2_clusters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL UNIQUE,
  representative_article_id VARCHAR REFERENCES dt2_articles(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_clusters_key ON dt2_clusters(cluster_key);

-- Cluster members table
CREATE TABLE IF NOT EXISTS dt2_cluster_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id VARCHAR NOT NULL REFERENCES dt2_clusters(id) ON DELETE CASCADE,
  article_id VARCHAR NOT NULL REFERENCES dt2_articles(id) ON DELETE CASCADE,
  similarity REAL NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_cluster_members_cluster ON dt2_cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_dt2_cluster_members_article ON dt2_cluster_members(article_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dt2_cluster_members_unique ON dt2_cluster_members(cluster_id, article_id);

-- Relevance scores table
CREATE TABLE IF NOT EXISTS dt2_relevance (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  org_id VARCHAR NOT NULL,
  article_id VARCHAR NOT NULL REFERENCES dt2_articles(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL,
  relevance_label dt2_relevance_label NOT NULL,
  score_breakdown JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_relevance_user ON dt2_relevance(user_id);
CREATE INDEX IF NOT EXISTS idx_dt2_relevance_article ON dt2_relevance(article_id);
CREATE INDEX IF NOT EXISTS idx_dt2_relevance_score ON dt2_relevance(relevance_score);
CREATE INDEX IF NOT EXISTS idx_dt2_relevance_label ON dt2_relevance(relevance_label);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dt2_relevance_unique ON dt2_relevance(user_id, article_id);

-- User rules table
CREATE TABLE IF NOT EXISTS dt2_user_rules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE,
  org_id VARCHAR NOT NULL,
  include_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  exclude_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  include_entities TEXT[] DEFAULT ARRAY[]::TEXT[],
  exclude_entities TEXT[] DEFAULT ARRAY[]::TEXT[],
  topic_statement TEXT,
  min_score INTEGER NOT NULL DEFAULT 60,
  cached_topic_embedding JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_user_rules_user ON dt2_user_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_dt2_user_rules_org ON dt2_user_rules(org_id);

-- Feedback table
CREATE TABLE IF NOT EXISTS dt2_feedback (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  org_id VARCHAR NOT NULL,
  article_id VARCHAR NOT NULL REFERENCES dt2_articles(id) ON DELETE CASCADE,
  action dt2_feedback_action NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_feedback_user ON dt2_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_dt2_feedback_article ON dt2_feedback(article_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dt2_feedback_unique ON dt2_feedback(user_id, article_id, action);

-- Run events table
CREATE TABLE IF NOT EXISTS dt2_run_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR NOT NULL REFERENCES dt2_runs(id) ON DELETE CASCADE,
  level dt2_run_event_level NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt2_run_events_run ON dt2_run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_dt2_run_events_level ON dt2_run_events(level);
CREATE INDEX IF NOT EXISTS idx_dt2_run_events_created ON dt2_run_events(created_at);
