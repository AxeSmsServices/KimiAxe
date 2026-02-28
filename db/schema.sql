-- ============================================
-- KimiAxe — PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTH
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  avatar_url    TEXT,
  role          VARCHAR(50) DEFAULT 'user',  -- user, admin, reseller
  is_verified   BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  kyc_status    VARCHAR(50) DEFAULT 'pending', -- pending, submitted, verified, rejected
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- WALLETS & TRANSACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS wallets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance     DECIMAL(15, 2) DEFAULT 0.00,
  currency    VARCHAR(10) DEFAULT 'INR',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id       UUID REFERENCES wallets(id),
  type            VARCHAR(50) NOT NULL, -- credit, debit, refund
  amount          DECIMAL(15, 2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'INR',
  description     TEXT,
  reference_id    VARCHAR(255),         -- external payment reference
  platform        VARCHAR(50),          -- axesms, axexvx, axeb2bai, axeb2bwallet, axesocials
  status          VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, refunded
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- ============================================
-- CONTACT & WAITLIST
-- ============================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  platform    VARCHAR(50) DEFAULT 'general',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  platform    VARCHAR(50) DEFAULT 'general',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AXESMS — MESSAGING
-- ============================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id      VARCHAR(100) UNIQUE NOT NULL,
  recipient       VARCHAR(20) NOT NULL,
  message         TEXT NOT NULL,
  sender_id       VARCHAR(50) DEFAULT 'KIMIAXE',
  channel         VARCHAR(20) DEFAULT 'sms', -- sms, email, whatsapp
  status          VARCHAR(50) DEFAULT 'queued', -- queued, sent, delivered, failed
  cost            DECIMAL(10, 4) DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_user_id ON sms_messages(user_id);
CREATE INDEX idx_sms_status ON sms_messages(status);
CREATE INDEX idx_sms_created_at ON sms_messages(created_at);

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  sender_id       VARCHAR(50),
  channel         VARCHAR(20) DEFAULT 'sms',
  total_recipients INTEGER DEFAULT 0,
  sent_count      INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  status          VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, completed, paused
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AXEXVX — LINK SHORTENER
-- ============================================

CREATE TABLE IF NOT EXISTS short_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  original_url    TEXT NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  title           VARCHAR(255),
  password_hash   VARCHAR(255),
  click_count     INTEGER DEFAULT 0,
  unique_clicks   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  meta_title      VARCHAR(255),
  meta_description TEXT,
  meta_image      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_short_links_slug ON short_links(slug);
CREATE INDEX idx_short_links_user_id ON short_links(user_id);

CREATE TABLE IF NOT EXISTS link_clicks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id     UUID NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  ip_address  INET,
  user_agent  TEXT,
  referer     TEXT,
  country     VARCHAR(10),
  city        VARCHAR(100),
  device_type VARCHAR(50), -- desktop, mobile, tablet
  browser     VARCHAR(100),
  os          VARCHAR(100),
  clicked_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX idx_link_clicks_clicked_at ON link_clicks(clicked_at);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  original_name   VARCHAR(255) NOT NULL,
  stored_name     VARCHAR(255) NOT NULL,
  file_type       VARCHAR(100),
  file_size       BIGINT,
  storage_path    TEXT NOT NULL,
  download_count  INTEGER DEFAULT 0,
  is_public       BOOLEAN DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AXEB2B AI — CHATBOTS & AUTOMATION
-- ============================================

CREATE TABLE IF NOT EXISTS ai_chatbots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  system_prompt   TEXT,
  model           VARCHAR(100) DEFAULT 'gpt-4',
  channels        TEXT[] DEFAULT '{}', -- website, whatsapp, telegram
  is_active       BOOLEAN DEFAULT TRUE,
  conversation_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id      UUID NOT NULL REFERENCES ai_chatbots(id) ON DELETE CASCADE,
  session_id      VARCHAR(255) NOT NULL,
  channel         VARCHAR(50) DEFAULT 'website',
  messages        JSONB DEFAULT '[]',
  is_resolved     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        VARCHAR(50) NOT NULL, -- facebook, instagram, twitter, linkedin
  content         TEXT NOT NULL,
  media_urls      TEXT[] DEFAULT '{}',
  status          VARCHAR(50) DEFAULT 'scheduled', -- scheduled, posted, failed
  scheduled_at    TIMESTAMPTZ NOT NULL,
  posted_at       TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AXEB2B WALLET — ESIM & DOMAINS
-- ============================================

CREATE TABLE IF NOT EXISTS esim_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name       VARCHAR(255) NOT NULL,
  country_code    VARCHAR(10) NOT NULL,
  data_gb         DECIMAL(10, 2),
  validity_days   INTEGER,
  price           DECIMAL(10, 2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'INR',
  iccid           VARCHAR(50),
  activation_code TEXT,
  status          VARCHAR(50) DEFAULT 'pending', -- pending, active, expired, cancelled
  activated_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_registrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_name     VARCHAR(255) NOT NULL,
  tld             VARCHAR(50) NOT NULL,
  registrar       VARCHAR(100),
  price           DECIMAL(10, 2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'INR',
  auto_renew      BOOLEAN DEFAULT TRUE,
  status          VARCHAR(50) DEFAULT 'active', -- active, expired, transferred, deleted
  registered_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AXESOCIALS — SOCIAL MEDIA MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS social_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        VARCHAR(50) NOT NULL, -- facebook, instagram, twitter, linkedin, youtube
  account_name    VARCHAR(255),
  account_id      VARCHAR(255),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform        VARCHAR(50) NOT NULL,
  content         TEXT NOT NULL,
  media_urls      TEXT[] DEFAULT '{}',
  hashtags        TEXT[] DEFAULT '{}',
  status          VARCHAR(50) DEFAULT 'scheduled', -- draft, scheduled, published, failed
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  post_id         VARCHAR(255), -- platform's post ID after publishing
  reach           INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  engagement      INTEGER DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);

-- ============================================
-- TRIGGERS — auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_short_links_updated_at BEFORE UPDATE ON short_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_chatbots_updated_at BEFORE UPDATE ON ai_chatbots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chatbot_conversations_updated_at BEFORE UPDATE ON chatbot_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA (optional)
-- ============================================

-- Insert default admin user (password: admin123 — CHANGE IN PRODUCTION)
-- INSERT INTO users (name, email, password_hash, role, is_verified)
-- VALUES ('Admin', 'admin@kimiaxe.com', '$2b$12$...', 'admin', TRUE);
