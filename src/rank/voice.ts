import { CronJob } from "cron";
import { client } from "../discordClient";

async function addXP() {
  const guild = (await client.guilds.fetch()).find(
    (g) => g.id == "1220475445569523742"
  );

  const inVoice = (await guild?.fetch())!.members.cache.filter(
    (member) =>
      member.voice.channel && member.voice.channel.name != "Nouveau Salon"
  );

  console.log(inVoice.map((user) => user.id));
}

CronJob.from({
  cronTime: "*/10 * * * * *",
  onTick: addXP,
  start: true
});
