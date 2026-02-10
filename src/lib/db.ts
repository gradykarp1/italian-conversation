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
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      skill_level TEXT DEFAULT 'beginner',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
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
