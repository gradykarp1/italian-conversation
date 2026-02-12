import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false>;

function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
}

// Initialize database tables
export async function initDatabase() {
  const sql = getDb();

  // Enable pgvector extension for semantic search
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      skill_level TEXT DEFAULT 'beginner',
      tts_speed REAL DEFAULT 0.85,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Add tts_speed column if it doesn't exist (for existing databases)
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tts_speed REAL DEFAULT 0.85
  `;

  // Add coach_personality column if it doesn't exist
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_personality TEXT DEFAULT 'maria'
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      topic TEXT DEFAULT '',
      transcript TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      skill_notes TEXT DEFAULT '',
      duration_seconds INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Session embeddings for semantic search
  await sql`
    CREATE TABLE IF NOT EXISTS session_embeddings (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      embedding vector(1536),
      content_summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create index for faster similarity search
  await sql`
    CREATE INDEX IF NOT EXISTS session_embeddings_user_idx
    ON session_embeddings(user_id)
  `;

  // PLIDA B1 competency scores for sessions
  await sql`
    CREATE TABLE IF NOT EXISTS session_scores (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      fluency_coherence INTEGER CHECK (fluency_coherence BETWEEN 1 AND 5),
      vocabulary_range INTEGER CHECK (vocabulary_range BETWEEN 1 AND 5),
      grammar_accuracy INTEGER CHECK (grammar_accuracy BETWEEN 1 AND 5),
      grammar_range INTEGER CHECK (grammar_range BETWEEN 1 AND 5),
      interaction INTEGER CHECK (interaction BETWEEN 1 AND 5),
      overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),
      feedback TEXT,
      strengths TEXT,
      areas_to_improve TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS session_scores_user_idx
    ON session_scores(user_id)
  `;
}

// User operations
export async function getUserByEmail(email: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserById(id: number) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createUser(email: string, passwordHash: string, name: string) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name})
    RETURNING *
  `;
  return rows[0];
}

export async function updateUserSkill(userId: number, skillLevel: string) {
  const sql = getDb();
  await sql`
    UPDATE users
    SET skill_level = ${skillLevel}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

export async function updateUserTtsSpeed(userId: number, ttsSpeed: number) {
  const sql = getDb();
  await sql`
    UPDATE users
    SET tts_speed = ${ttsSpeed}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

export async function getUserTtsSpeed(userId: number): Promise<number> {
  const sql = getDb();
  const rows = await sql`SELECT tts_speed FROM users WHERE id = ${userId}`;
  return rows[0]?.tts_speed ?? 0.85;
}

export async function updateUserPersonality(userId: number, personality: string) {
  const sql = getDb();
  await sql`
    UPDATE users
    SET coach_personality = ${personality}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

export async function getUserPersonality(userId: number): Promise<string> {
  const sql = getDb();
  const rows = await sql`SELECT coach_personality FROM users WHERE id = ${userId}`;
  return rows[0]?.coach_personality ?? 'maria';
}

// Session operations
export async function createSession(
  userId: number,
  transcript: string,
  summary: string,
  skillNotes: string,
  durationSeconds: number
) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO sessions (user_id, transcript, summary, skill_notes, duration_seconds)
    VALUES (${userId}, ${transcript}, ${summary}, ${skillNotes}, ${durationSeconds})
    RETURNING *
  `;
  return rows[0];
}

export async function getRecentSessions(userId: number, limit: number = 3) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM sessions
    WHERE user_id = ${userId}
    ORDER BY date DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getSessionCount(userId: number) {
  const sql = getDb();
  const rows = await sql`
    SELECT COUNT(*) as count FROM sessions WHERE user_id = ${userId}
  `;
  return parseInt(rows[0].count);
}

export async function getUserSessions(userId: number, limit: number = 50) {
  const sql = getDb();
  const rows = await sql`
    SELECT id, date, topic, summary, skill_notes, duration_seconds
    FROM sessions
    WHERE user_id = ${userId}
    ORDER BY date DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getSessionById(sessionId: number, userId: number) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
  `;
  return rows[0] || null;
}

// Password reset operations
export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date) {
  const sql = getDb();
  await sql`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
  `;
}

export async function getPasswordResetToken(token: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM password_reset_tokens
    WHERE token = ${token}
      AND used = FALSE
      AND expires_at > CURRENT_TIMESTAMP
  `;
  return rows[0] || null;
}

export async function markTokenUsed(tokenId: number) {
  const sql = getDb();
  await sql`
    UPDATE password_reset_tokens SET used = TRUE WHERE id = ${tokenId}
  `;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const sql = getDb();
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

// Embedding operations
export async function storeSessionEmbedding(
  sessionId: number,
  userId: number,
  embedding: number[],
  contentSummary: string
) {
  const sql = getDb();
  // Convert embedding array to pgvector format
  const embeddingStr = `[${embedding.join(",")}]`;
  await sql`
    INSERT INTO session_embeddings (session_id, user_id, embedding, content_summary)
    VALUES (${sessionId}, ${userId}, ${embeddingStr}::vector, ${contentSummary})
    ON CONFLICT DO NOTHING
  `;
}

export async function findSimilarSessions(
  userId: number,
  queryEmbedding: number[],
  limit: number = 3,
  excludeSessionId?: number
) {
  const sql = getDb();
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Use cosine distance for similarity (smaller = more similar)
  const rows = excludeSessionId
    ? await sql`
        SELECT
          se.session_id,
          se.content_summary,
          s.date,
          s.summary,
          s.skill_notes,
          1 - (se.embedding <=> ${embeddingStr}::vector) as similarity
        FROM session_embeddings se
        JOIN sessions s ON se.session_id = s.id
        WHERE se.user_id = ${userId}
          AND se.session_id != ${excludeSessionId}
        ORDER BY se.embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          se.session_id,
          se.content_summary,
          s.date,
          s.summary,
          s.skill_notes,
          1 - (se.embedding <=> ${embeddingStr}::vector) as similarity
        FROM session_embeddings se
        JOIN sessions s ON se.session_id = s.id
        WHERE se.user_id = ${userId}
        ORDER BY se.embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `;

  return rows;
}

export async function hasSessionEmbedding(sessionId: number) {
  const sql = getDb();
  const rows = await sql`
    SELECT 1 FROM session_embeddings WHERE session_id = ${sessionId} LIMIT 1
  `;
  return rows.length > 0;
}

// Session scores operations
export type SessionScores = {
  fluencyCoherence: number;
  vocabularyRange: number;
  grammarAccuracy: number;
  grammarRange: number;
  interaction: number;
  overallScore: number;
  feedback: string;
  strengths: string;
  areasToImprove: string;
};

export async function storeSessionScores(
  sessionId: number,
  userId: number,
  scores: SessionScores
) {
  const sql = getDb();
  await sql`
    INSERT INTO session_scores (
      session_id, user_id,
      fluency_coherence, vocabulary_range, grammar_accuracy, grammar_range, interaction,
      overall_score, feedback, strengths, areas_to_improve
    )
    VALUES (
      ${sessionId}, ${userId},
      ${scores.fluencyCoherence}, ${scores.vocabularyRange}, ${scores.grammarAccuracy},
      ${scores.grammarRange}, ${scores.interaction}, ${scores.overallScore},
      ${scores.feedback}, ${scores.strengths}, ${scores.areasToImprove}
    )
    ON CONFLICT (session_id) DO UPDATE SET
      fluency_coherence = ${scores.fluencyCoherence},
      vocabulary_range = ${scores.vocabularyRange},
      grammar_accuracy = ${scores.grammarAccuracy},
      grammar_range = ${scores.grammarRange},
      interaction = ${scores.interaction},
      overall_score = ${scores.overallScore},
      feedback = ${scores.feedback},
      strengths = ${scores.strengths},
      areas_to_improve = ${scores.areasToImprove}
  `;
}

export async function getSessionScores(sessionId: number) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM session_scores WHERE session_id = ${sessionId}
  `;
  return rows[0] || null;
}

export async function getUserScoresHistory(userId: number, limit: number = 20) {
  const sql = getDb();
  const rows = await sql`
    SELECT ss.*, s.date
    FROM session_scores ss
    JOIN sessions s ON ss.session_id = s.id
    WHERE ss.user_id = ${userId}
    ORDER BY s.date DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getSessionsWithoutScores(userId: number, limit: number = 50) {
  const sql = getDb();
  const rows = await sql`
    SELECT s.id, s.transcript
    FROM sessions s
    LEFT JOIN session_scores ss ON s.id = ss.session_id
    WHERE s.user_id = ${userId}
      AND ss.id IS NULL
      AND s.transcript IS NOT NULL
      AND s.transcript != ''
    ORDER BY s.date DESC
    LIMIT ${limit}
  `;
  return rows;
}
