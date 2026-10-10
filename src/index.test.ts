import { beforeEach, describe, expect, it, vi } from "vitest";
import { Events } from "discord.js";

const { client } = vi.hoisted(() => ({
  client: { once: vi.fn(), login: vi.fn() }
}));

vi.mock("dotenv/config", () => ({}));
vi.mock("./discordClient", () => ({ client }));
vi.mock("./database", () => ({}));
vi.mock("./rank/voice", () => ({}));
vi.mock("./channels/voice", () => ({}));
vi.mock("./stats/voice", () => ({}));
vi.mock("./commands/top", () => ({}));

describe("index", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env["token"] = "jeton-de-test";
  });

  it("connecte le bot avec le jeton de l'environnement", async () => {
    await import("./index");

    expect(client.login).toHaveBeenCalledTimes(1);
    expect(client.login).toHaveBeenCalledWith("jeton-de-test");
  });

  it("affiche le nom du bot une fois connecté", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await import("./index");

    const [event, handler] = client.once.mock.calls[0];
    expect(event).toBe(Events.ClientReady);

    handler({ user: { tag: "FabcorpBot#0001" } });

    expect(log).toHaveBeenCalledWith("Ready! Logged in as FabcorpBot#0001");
  });
});
