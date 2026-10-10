import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType, Events } from "discord.js";

const PERSONAL_CATEGORY_ID = "1221186524079718502";

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: never[]) => Promise<void>>()
}));

vi.mock("../discordClient", () => ({
  client: {
    on: (event: string, handler: (...args: never[]) => Promise<void>) => {
      handlers.set(event, handler);
    }
  }
}));

import "./voice";

type FakeOldChannel = {
  name?: string;
  type?: ChannelType;
  members?: number;
};

function makeOldState(channelId: string | null, channel?: FakeOldChannel) {
  return {
    channelId,
    channel: channel
      ? {
          name: channel.name ?? "Salon de Bob",
          type: channel.type ?? ChannelType.GuildVoice,
          members: { size: channel.members ?? 0 },
          delete: vi.fn()
        }
      : null
  };
}

function makeNewState(channelId: string | null, channelName?: string) {
  const personalChannel = { setName: vi.fn() };
  const member = {
    displayName: "Alice",
    voice: { setChannel: vi.fn() }
  };
  const create = vi.fn().mockResolvedValue(personalChannel);

  return {
    state: {
      channelId,
      channel: channelName ? { name: channelName } : null,
      member,
      guild: { channels: { create } }
    },
    member,
    create,
    personalChannel
  };
}

async function emit(
  oldState: ReturnType<typeof makeOldState>,
  newState: ReturnType<typeof makeNewState>["state"]
) {
  const handler = handlers.get(Events.VoiceStateUpdate)!;
  await handler(oldState as never, newState as never);
}

describe("channels/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("écoute les changements d'état vocal", () => {
    expect(handlers.has(Events.VoiceStateUpdate)).toBe(true);
  });

  describe("création d'un salon personnel", () => {
    it("crée un salon nommé d'après le membre dans la bonne catégorie", async () => {
      const next = makeNewState("nouveau", "Nouveau Salon");

      await emit(makeOldState(null), next.state);

      expect(next.create).toHaveBeenCalledTimes(1);
      expect(next.create).toHaveBeenCalledWith({
        name: "Alice",
        type: ChannelType.GuildVoice,
        parent: PERSONAL_CATEGORY_ID
      });
    });

    it("renomme le salon et y déplace le membre", async () => {
      const next = makeNewState("nouveau", "Nouveau Salon");

      await emit(makeOldState(null), next.state);

      expect(next.personalChannel.setName).toHaveBeenCalledWith("Alice");
      expect(next.member.voice.setChannel).toHaveBeenCalledWith(
        next.personalChannel
      );
    });

    it("ne crée rien en rejoignant un autre salon", async () => {
      const next = makeNewState("general", "Général");

      await emit(makeOldState(null), next.state);

      expect(next.create).not.toHaveBeenCalled();
      expect(next.member.voice.setChannel).not.toHaveBeenCalled();
    });

    it("ne crée rien si le salon n'a pas changé (ex. passage en muet)", async () => {
      const next = makeNewState("nouveau", "Nouveau Salon");

      await emit(
        makeOldState("nouveau", { name: "Nouveau Salon", members: 1 }),
        next.state
      );

      expect(next.create).not.toHaveBeenCalled();
    });

    it("ne crée rien quand le membre se déconnecte", async () => {
      const next = makeNewState(null);

      await emit(makeOldState("general", { name: "Général", members: 2 }), next.state);

      expect(next.create).not.toHaveBeenCalled();
    });
  });

  describe("suppression des salons vides", () => {
    it("supprime un salon vocal personnel devenu vide", async () => {
      const old = makeOldState("perso", { members: 0 });

      await emit(old, makeNewState(null).state);

      expect(old.channel!.delete).toHaveBeenCalledTimes(1);
    });

    it("supprime le salon quitté quand le membre rejoint un autre salon", async () => {
      const old = makeOldState("perso", { members: 0 });

      await emit(old, makeNewState("general", "Général").state);

      expect(old.channel!.delete).toHaveBeenCalledTimes(1);
    });

    it("conserve un salon qui contient encore des membres", async () => {
      const old = makeOldState("perso", { members: 1 });

      await emit(old, makeNewState(null).state);

      expect(old.channel!.delete).not.toHaveBeenCalled();
    });

    it("ne supprime jamais le salon « Nouveau Salon »", async () => {
      const old = makeOldState("nouveau", { name: "Nouveau Salon", members: 0 });

      await emit(old, makeNewState(null).state);

      expect(old.channel!.delete).not.toHaveBeenCalled();
    });

    it("ne supprime pas un salon qui n'est pas un salon vocal", async () => {
      const old = makeOldState("scene", {
        type: ChannelType.GuildStageVoice,
        members: 0
      });

      await emit(old, makeNewState(null).state);

      expect(old.channel!.delete).not.toHaveBeenCalled();
    });

    it("ne supprime rien si le salon n'a pas changé", async () => {
      const old = makeOldState("perso", { members: 0 });

      await emit(old, makeNewState("perso", "Salon de Bob").state);

      expect(old.channel!.delete).not.toHaveBeenCalled();
    });

    it("ne fait rien si le membre n'était dans aucun salon", async () => {
      const next = makeNewState("general", "Général");

      await expect(emit(makeOldState(null), next.state)).resolves.toBeUndefined();
    });
  });

  it("crée un nouveau salon et supprime l'ancien quand on passe de l'un à l'autre", async () => {
    const old = makeOldState("perso", { members: 0 });
    const next = makeNewState("nouveau", "Nouveau Salon");

    await emit(old, next.state);

    expect(next.create).toHaveBeenCalledTimes(1);
    expect(old.channel!.delete).toHaveBeenCalledTimes(1);
  });
});
