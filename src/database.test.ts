import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, connect } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn()
}));

vi.mock("pg", () => {
  class Client {
    query = query;
    async connect() {
      connect();
      return this;
    }
  }
  return { Client };
});

async function loadDatabase() {
  vi.resetModules();
  return await import("./database");
}

describe("database", () => {
  beforeEach(() => {
    query.mockResolvedValue({ rows: [] });
  });

  it("se connecte à PostgreSQL et exporte le client", async () => {
    const { db } = await loadDatabase();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(db.query).toBe(query);
  });

  it("crée la table voice_time si elle n'existe pas", async () => {
    await loadDatabase();

    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS voice_time/);
    expect(sql).toMatch(/user_id TEXT PRIMARY KEY/);
    expect(sql).toMatch(/minutes INTEGER NOT NULL DEFAULT 0/);
  });

  describe("addVoiceMinutes", () => {
    it("fait un upsert avec l'identifiant et les minutes en paramètres", async () => {
      const { addVoiceMinutes } = await loadDatabase();
      query.mockClear();

      await addVoiceMinutes("123", 5);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO voice_time/);
      expect(sql).toMatch(/ON CONFLICT\(user_id\) DO UPDATE/);
      expect(sql).toMatch(/minutes = voice_time\.minutes \+ excluded\.minutes/);
      expect(params).toEqual(["123", 5]);
    });

    it("n'injecte jamais les valeurs directement dans le SQL", async () => {
      const { addVoiceMinutes } = await loadDatabase();
      query.mockClear();

      await addVoiceMinutes("'; DROP TABLE voice_time; --", 1);

      const [sql, params] = query.mock.calls[0];
      expect(sql).not.toContain("DROP TABLE");
      expect(params[0]).toBe("'; DROP TABLE voice_time; --");
    });

    it("propage l'erreur si la requête échoue", async () => {
      const { addVoiceMinutes } = await loadDatabase();
      query.mockRejectedValueOnce(new Error("connexion perdue"));

      await expect(addVoiceMinutes("123", 1)).rejects.toThrow(
        "connexion perdue"
      );
    });
  });
});
