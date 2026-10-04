import { Client } from "pg";

export const db = await new Client().connect();

db.query(`
  CREATE TABLE IF NOT EXISTS voice_time (
    user_id TEXT PRIMARY KEY,
    minutes INTEGER NOT NULL DEFAULT 0
  )
`);

export async function addVoiceMinutes(userId: string, minutes: number) {
  await db.query(
    `
  INSERT INTO voice_time (user_id, minutes) VALUES ($1, $2)
  ON CONFLICT(user_id) DO UPDATE SET minutes = voice_time.minutes + excluded.minutes
`,
    [userId, minutes]
  );
}
