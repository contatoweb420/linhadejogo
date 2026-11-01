CREATE TABLE IF NOT EXISTS agent_cache (
  agent text PRIMARY KEY CHECK (agent IN ('news', 'blogs', 'forums', 'reviews')),
  itens jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
