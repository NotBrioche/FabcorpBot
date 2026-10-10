import { beforeEach, describe, expect, it, vi } from "vitest";

const GUILD_ID = "1220475445569523742";
const STAT_CHANNEL_ID = "1558554606177615994";

const { cronConfigs, dbQuery, guilds } = vi.hoisted(() => ({
  cronConfigs: [] as Array<{
    cronTime: string;
    onTick: () => Promise<void>;
    start: boolean;
  }>,
  dbQuery: vi.fn(),
  guilds: new Map<string, unknown>()
}));

vi.mock("cron", () => ({
  CronJob: {
    from: (config: (typeof cronConfigs)[number]) => {
      cronConfigs.push(config);
      return config;
    }
  }
}));

vi.mock("../database", () => ({ db: { query: dbQuery } }));
vi.mock("../discordClient", () => ({ client: { guilds: { cache: guilds } } }));

import { getTotalVoiceHours } from "./voice";

function registerStatChannel() {
  const setName = vi.fn();
  const guild = {
    channels: { cache: new Map([[STAT_CHANNEL_ID, { setName }]]) }
  };
  guilds.set(GUILD_ID, guild);
  return setName;
}

describe("stats/voice", () => {
  beforeEach(() => {
    guilds.clear();
  });

  describe("getTotalVoiceHours", () => {
    it("renvoie le total d'heures calculé par la base", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [{ hours: 42 }] });

      await expect(getTotalVoiceHours()).resolves.toBe(42);
    });

    it("renvoie 0 quand la table est vide", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [{ hours: 0 }] });

      await expect(getTotalVoiceHours()).resolves.toBe(0);
    });

    it("somme les minutes et les convertit en heures entières côté SQL", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [{ hours: 1 }] });

      await getTotalVoiceHours();

      const sql = dbQuery.mock.calls[0][0] as string;
      expect(sql).toMatch(/SUM\(minutes\)\s*\/\s*60/);
      expect(sql).toMatch(/COALESCE/);
      expect(sql).toMatch(/::int/);
      expect(sql).toMatch(/FROM voice_time/);
    });
  });

  describe("tâche planifiée", () => {
    it("s'exécute toutes les heures et démarre automatiquement", () => {
      expect(cronConfigs).toHaveLength(1);
      expect(cronConfigs[0].cronTime).toBe("0 * * * *");
      expect(cronConfigs[0].start).toBe(true);
    });

    it("renomme le salon de statistiques avec le total d'heures", async () => {
      const setName = registerStatChannel();
      dbQuery.mockResolvedValueOnce({ rows: [{ hours: 128 }] });

      await cronConfigs[0].onTick();

      expect(setName).toHaveBeenCalledTimes(1);
      expect(setName).toHaveBeenCalledWith("H en vocal : 128");
    });

    it("ne plante pas si le serveur n'est pas en cache", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [{ hours: 5 }] });

      await expect(cronConfigs[0].onTick()).resolves.toBeUndefined();
    });

    it("ne plante pas si le salon de statistiques est introuvable", async () => {
      guilds.set(GUILD_ID, { channels: { cache: new Map() } });
      dbQuery.mockResolvedValueOnce({ rows: [{ hours: 5 }] });

      await expect(cronConfigs[0].onTick()).resolves.toBeUndefined();
    });
  });
});
