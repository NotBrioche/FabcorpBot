import { beforeEach, describe, expect, it, vi } from "vitest";
import { Events } from "discord.js";

const GUILD_ID = "1220475445569523742";

type Handler = (...args: never[]) => Promise<void>;

const { onceHandlers, onHandlers, dbQuery } = vi.hoisted(() => ({
  onceHandlers: new Map<string, Handler>(),
  onHandlers: new Map<string, Handler>(),
  dbQuery: vi.fn()
}));

vi.mock("../discordClient", () => ({
  client: {
    once: (event: string, handler: Handler) => {
      onceHandlers.set(event, handler);
    },
    on: (event: string, handler: Handler) => {
      onHandlers.set(event, handler);
    }
  }
}));
vi.mock("../database", () => ({ db: { query: dbQuery } }));

import "./top";

function makeInteraction(
  options: { chatInput?: boolean; commandName?: string } = {}
) {
  return {
    isChatInputCommand: () => options.chatInput ?? true,
    commandName: options.commandName ?? "top",
    deferReply: vi.fn(),
    editReply: vi.fn()
  };
}

async function run(interaction: ReturnType<typeof makeInteraction>) {
  await onHandlers.get(Events.InteractionCreate)!(interaction as never);
}

function sentEmbed(interaction: ReturnType<typeof makeInteraction>) {
  const payload = interaction.editReply.mock.calls[0][0];
  return payload.embeds[0].data as {
    title: string;
    description: string;
    color: number;
    timestamp: string;
  };
}

describe("commands/top", () => {
  beforeEach(() => {
    dbQuery.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("enregistrement de la commande", () => {
    it("crée la commande /top sur le serveur au démarrage", async () => {
      const create = vi.fn();
      const client = {
        guilds: { cache: new Map([[GUILD_ID, { commands: { create } }]]) }
      };

      await onceHandlers.get(Events.ClientReady)!(client as never);

      expect(create).toHaveBeenCalledTimes(1);
      const command = create.mock.calls[0][0].toJSON();
      expect(command.name).toBe("top");
      expect(command.description).toBe(
        "Affiche le top 10 du temps passé en vocal"
      );
    });

    it("ne plante pas si le serveur n'est pas en cache", async () => {
      const client = { guilds: { cache: new Map() } };

      await expect(
        onceHandlers.get(Events.ClientReady)!(client as never)
      ).resolves.toBeUndefined();
    });
  });

  describe("interactions ignorées", () => {
    it("ignore ce qui n'est pas une commande slash", async () => {
      const interaction = makeInteraction({ chatInput: false });

      await run(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(dbQuery).not.toHaveBeenCalled();
    });

    it("ignore les autres commandes", async () => {
      const interaction = makeInteraction({ commandName: "autre" });

      await run(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(dbQuery).not.toHaveBeenCalled();
    });
  });

  describe("/top", () => {
    it("diffère la réponse puis interroge le top 10 trié par minutes", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [] });
      const interaction = makeInteraction();

      await run(interaction);

      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
      const sql = dbQuery.mock.calls[0][0] as string;
      expect(sql).toMatch(/FROM voice_time/);
      expect(sql).toMatch(/ORDER BY minutes DESC/);
      expect(sql).toMatch(/LIMIT 10/);
    });

    it("affiche un message quand personne n'a de temps enregistré", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [] });
      const interaction = makeInteraction();

      await run(interaction);

      expect(sentEmbed(interaction).description).toBe(
        "Personne n'a encore de temps enregistré."
      );
    });

    it("affiche un embed titré « Top 10 » aux couleurs de Discord", async () => {
      dbQuery.mockResolvedValueOnce({ rows: [] });
      const interaction = makeInteraction();

      await run(interaction);

      const embed = sentEmbed(interaction);
      expect(embed.title).toBe("Top 10");
      expect(embed.color).toBe(0x5865f2);
      expect(embed.timestamp).toBeDefined();
    });

    it("classe les membres avec leur mention et leur temps formaté", async () => {
      dbQuery.mockResolvedValueOnce({
        rows: [
          { user_id: "111", minutes: 125 },
          { user_id: "222", minutes: 60 },
          { user_id: "333", minutes: 5 }
        ]
      });
      const interaction = makeInteraction();

      await run(interaction);

      expect(sentEmbed(interaction).description).toBe(
        [
          "**1.** <@111>: 2 h 05 min",
          "**2.** <@222>: 1 h 00 min",
          "**3.** <@333>: 0 h 05 min"
        ].join("\n")
      );
    });

    it("formate correctement les cas limites du temps", async () => {
      dbQuery.mockResolvedValueOnce({
        rows: [
          { user_id: "1", minutes: 0 },
          { user_id: "2", minutes: 59 },
          { user_id: "3", minutes: 61 },
          { user_id: "4", minutes: 90000 }
        ]
      });
      const interaction = makeInteraction();

      await run(interaction);

      const lines = sentEmbed(interaction).description.split("\n");
      expect(lines[0]).toContain("0 h 00 min");
      expect(lines[1]).toContain("0 h 59 min");
      expect(lines[2]).toContain("1 h 01 min");
      expect(lines[3]).toContain("1500 h 00 min");
    });

    it("affiche les dix lignes quand il y a dix membres", async () => {
      dbQuery.mockResolvedValueOnce({
        rows: Array.from({ length: 10 }, (_, i) => ({
          user_id: String(i),
          minutes: 100 - i
        }))
      });
      const interaction = makeInteraction();

      await run(interaction);

      const lines = sentEmbed(interaction).description.split("\n");
      expect(lines).toHaveLength(10);
      expect(lines[9].startsWith("**10.**")).toBe(true);
    });

    it("répond avec un message d'erreur si la base échoue", async () => {
      dbQuery.mockRejectedValueOnce(new Error("base indisponible"));
      const interaction = makeInteraction();

      await run(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "Une erreur est survenue, réessaie plus tard."
      );
      expect(console.error).toHaveBeenCalled();
    });
  });
});
