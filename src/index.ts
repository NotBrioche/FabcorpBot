import "dotenv/config";
import { Events } from "discord.js";
import { client } from "./discordClient";

client.once(Events.ClientReady, (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.login(process.env["token"]);
