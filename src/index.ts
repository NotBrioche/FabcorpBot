import "dotenv/config";
import { Events } from "discord.js";
import { client } from "./discordClient";

import "./database";
import "./rank/voice";
import "./channels/voice";
import "./stats/voice";
import "./commands/top";

client.once(Events.ClientReady, (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.login(process.env["token"]);
