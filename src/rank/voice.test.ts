import { beforeEach, describe, expect, it, vi } from "vitest";

const GUILD_ID = "1220475445569523742";

const ROLE = {
  level1: "1221085036862767114",
  level2: "1221085127384367225",
  level10: "1221085402794950757",
  level15: "1221085525666955325",
  level20: "1221085548471390258",
  level50: "1221085637529042994"
};

const { cronConfigs, dbQuery, addVoiceMinutes, guilds } = vi.hoisted(() => ({
  cronConfigs: [] as Array<{
    cronTime: string;
    onTick: () => Promise<void>;
    start: boolean;
  }>,
  dbQuery: vi.fn(),
  addVoiceMinutes: vi.fn(),
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

vi.mock("../database", () => ({
  db: { query: dbQuery },
  addVoiceMinutes
}));
vi.mock("../discordClient", () => ({ client: { guilds: { cache: guilds } } }));

import "./voice";

type UserOptions = {
  roles?: string[];
  bot?: boolean;
  mute?: boolean;
  deaf?: boolean;
};

function makeUser(id: string, options: UserOptions = {}) {
  const roleIds = new Set(options.roles ?? []);
  const member = {
    id,
    displayName: `user-${id}`,
    user: { bot: Boolean(options.bot) },
    roles: {
      cache: { has: (roleId: string) => roleIds.has(roleId) },
      add: vi.fn(),
      remove: vi.fn()
    },
    voice: undefined as unknown
  };
  const state = {
    id,
    member,
    mute: Boolean(options.mute),
    deaf: Boolean(options.deaf),
    channel: undefined as unknown
  };
  member.voice = state;
  return { member, state };
}

type FakeUser = ReturnType<typeof makeUser>;

/** Place les utilisateurs dans un salon et enregistre le serveur dans le cache. */
function setupGuild(users: FakeUser[], channelName = "Général") {
  const channel = { name: channelName, members: users.map((u) => u.member) };
  for (const user of users) user.state.channel = channel;

  guilds.set(GUILD_ID, {
    voiceStates: {
      cache: new Map(users.map((u) => [u.member.id, u.state]))
    }
  });
}

/** Simule le total de minutes renvoyé par la base pour chaque utilisateur. */
function setMinutes(totals: Record<string, number>) {
  dbQuery.mockImplementation(async (_sql: string, params: string[]) => ({
    rows: [{ minutes: totals[params[0]] }]
  }));
}

const tick = () => cronConfigs[0].onTick();

describe("rank/voice", () => {
  beforeEach(() => {
    guilds.clear();
    dbQuery.mockReset();
    addVoiceMinutes.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("est planifié toutes les minutes et démarre automatiquement", () => {
    expect(cronConfigs).toHaveLength(1);
    expect(cronConfigs[0].cronTime).toBe("* * * * *");
    expect(cronConfigs[0].start).toBe(true);
  });

  describe("attribution des minutes", () => {
    it("ne fait rien si le serveur n'est pas en cache", async () => {
      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalled();
    });

    it("donne 1 minute à chaque membre actif quand ils sont au moins deux", async () => {
      const alice = makeUser("alice");
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      setMinutes({ alice: 10, bob: 20 });

      await tick();

      expect(addVoiceMinutes).toHaveBeenCalledTimes(2);
      expect(addVoiceMinutes).toHaveBeenCalledWith("alice", 1);
      expect(addVoiceMinutes).toHaveBeenCalledWith("bob", 1);
    });

    it("ne donne rien à un membre seul dans son salon", async () => {
      const alice = makeUser("alice");
      setupGuild([alice]);
      setMinutes({ alice: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalled();
    });

    it("ne donne rien dans le salon « Nouveau Salon »", async () => {
      const alice = makeUser("alice");
      const bob = makeUser("bob");
      setupGuild([alice, bob], "Nouveau Salon");
      setMinutes({ alice: 10, bob: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalled();
    });

    it("ne donne rien à un membre sans salon vocal", async () => {
      const alice = makeUser("alice");
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      alice.state.channel = null;
      setMinutes({ alice: 10, bob: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalledWith("alice", 1);
    });

    it("ignore un état vocal sans membre en cache", async () => {
      const alice = makeUser("alice");
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      alice.state.member = null as never;
      setMinutes({ alice: 10, bob: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalledWith("alice", 1);
    });

    it("ne donne rien à un membre muet, et il ne compte pas comme partenaire", async () => {
      const alice = makeUser("alice", { mute: true });
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      setMinutes({ alice: 10, bob: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalled();
    });

    it("ne donne rien à un membre sourd, et il ne compte pas comme partenaire", async () => {
      const alice = makeUser("alice", { deaf: true });
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      setMinutes({ alice: 10, bob: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalled();
    });

    it("ne compte pas un bot comme partenaire et ne lui donne rien", async () => {
      const alice = makeUser("alice");
      const robot = makeUser("robot", { bot: true });
      setupGuild([alice, robot]);
      setMinutes({ alice: 10, robot: 10 });

      await tick();

      expect(addVoiceMinutes).not.toHaveBeenCalled();
    });

    it("donne des minutes aux membres actifs même si un tiers est muet", async () => {
      const alice = makeUser("alice");
      const bob = makeUser("bob");
      const carol = makeUser("carol", { mute: true });
      setupGuild([alice, bob, carol]);
      setMinutes({ alice: 10, bob: 10, carol: 10 });

      await tick();

      expect(addVoiceMinutes).toHaveBeenCalledTimes(2);
      expect(addVoiceMinutes).toHaveBeenCalledWith("alice", 1);
      expect(addVoiceMinutes).toHaveBeenCalledWith("bob", 1);
      expect(addVoiceMinutes).not.toHaveBeenCalledWith("carol", 1);
    });

    it("relit le total de l'utilisateur avec une requête paramétrée", async () => {
      const alice = makeUser("alice");
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      setMinutes({ alice: 10, bob: 10 });

      await tick();

      const [sql, params] = dbQuery.mock.calls[0];
      expect(sql).toMatch(/SELECT minutes FROM voice_time WHERE user_id = \$1/);
      expect(params).toEqual(["alice"]);
    });
  });

  describe("attribution des rôles de niveau", () => {
    async function tickWithTotal(minutes: number, options: UserOptions = {}) {
      const alice = makeUser("alice", options);
      const bob = makeUser("bob");
      setupGuild([alice, bob]);
      setMinutes({ alice: minutes, bob: 0 });

      await tick();

      return alice.member;
    }

    it("ne touche à aucun rôle sous 180 minutes", async () => {
      const member = await tickWithTotal(179);

      expect(member.roles.add).not.toHaveBeenCalled();
      expect(member.roles.remove).not.toHaveBeenCalled();
    });

    it("donne le rôle niveau 1 à 180 minutes pile", async () => {
      const member = await tickWithTotal(180);

      expect(member.roles.add).toHaveBeenCalledWith(ROLE.level1);
    });

    it("passe au niveau 2 à 204 minutes et retire le niveau 1", async () => {
      const member = await tickWithTotal(204, { roles: [ROLE.level1] });

      expect(member.roles.remove).toHaveBeenCalledWith([ROLE.level1]);
      expect(member.roles.add).toHaveBeenCalledWith(ROLE.level2);
    });

    it("reste au niveau 1 juste avant le seuil du niveau 2", async () => {
      const member = await tickWithTotal(203);

      expect(member.roles.add).toHaveBeenCalledWith(ROLE.level1);
    });

    it("choisit le niveau le plus élevé atteint entre deux paliers", async () => {
      // 1000 minutes : au-dessus du niveau 10 (564), sous le niveau 15 (1063)
      const member = await tickWithTotal(1000);

      expect(member.roles.add).toHaveBeenCalledWith(ROLE.level10);
    });

    it("donne le niveau 50 au-delà du dernier palier", async () => {
      const member = await tickWithTotal(500000);

      expect(member.roles.add).toHaveBeenCalledWith(ROLE.level50);
    });

    it("ne rajoute pas un rôle que le membre possède déjà", async () => {
      const member = await tickWithTotal(2004, { roles: [ROLE.level20] });

      expect(member.roles.add).not.toHaveBeenCalled();
      expect(member.roles.remove).not.toHaveBeenCalled();
    });

    it("retire tous les anciens rôles de niveau en une seule fois", async () => {
      const member = await tickWithTotal(2004, {
        roles: [ROLE.level1, ROLE.level10, ROLE.level15]
      });

      expect(member.roles.remove).toHaveBeenCalledTimes(1);
      const removed = member.roles.remove.mock.calls[0][0] as string[];
      expect([...removed].sort()).toEqual(
        [ROLE.level1, ROLE.level10, ROLE.level15].sort()
      );
      expect(member.roles.add).toHaveBeenCalledWith(ROLE.level20);
    });

    it("ne retire pas les rôles sans lien avec les niveaux", async () => {
      const member = await tickWithTotal(180, {
        roles: ["role-modo", ROLE.level1]
      });

      expect(member.roles.remove).not.toHaveBeenCalled();
    });

    it("ne retire rien si le membre n'a aucun rôle de niveau", async () => {
      const member = await tickWithTotal(500);

      expect(member.roles.remove).not.toHaveBeenCalled();
      expect(member.roles.add).toHaveBeenCalledTimes(1);
    });
  });
});
