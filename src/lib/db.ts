import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Initialize database tables
export async function initDatabase() {
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
}

// User operations
export async function getUserByEmail(email: string) {
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserById(id: number) {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createUser(email: string, passwordHash: string, name: string) {
  const rows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name})
    RETURNING *
  `;
  return rows[0];
}

export async function updateUserSkill(userId: number, skillLevel: string) {
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
  const rows = await sql`
    INSERT INTO sessions (user_id, transcript, summary, skill_notes, duration_seconds)
    VALUES (${userId}, ${transcript}, ${summary}, ${skillNotes}, ${durationSeconds})
    RETURNING *
  `;
  return rows[0];
}

export async function getRecentSessions(userId: number, limit: number = 3) {
  const rows = await sql`
    SELECT * FROM sessions
    WHERE user_id = ${userId}
    ORDER BY date DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getSessionCount(userId: number) {
  const rows = await sql`
    SELECT COUNT(*) as count FROM sessions WHERE user_id = ${userId}
  `;
  return parseInt(rows[0].count);
}
