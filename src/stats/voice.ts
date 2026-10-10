import { CronJob } from "cron";
import { db } from "../database";
import { client } from "../discordClient";

export async function getTotalVoiceHours(): Promise<number> {
  const res = await db.query(
    `SELECT COALESCE(SUM(minutes) / 60, 0)::int AS hours FROM voice_time`
  );
  return res.rows[0].hours as number;
}

CronJob.from({
  cronTime: "0 * * * *",
  onTick: async function () {
    const guild = client.guilds.cache.get("1220475445569523742");

    const statChannel = guild?.channels.cache.get("1558554606177615994");
    const hours = await getTotalVoiceHours();

    statChannel?.setName("H en vocal : " + hours);
  },
  start: true
});
