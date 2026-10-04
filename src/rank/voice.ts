import { CronJob } from "cron";
import { client } from "../discordClient";
import { addVoiceMinutes, db } from "../database";
import { GuildMember } from "discord.js";

const levels = [
  { level: 1, minutes: 180, roleId: "1221085036862767114" },
  { level: 2, minutes: 204, roleId: "1221085127384367225" },
  { level: 3, minutes: 232, roleId: "1221085161311961178" },
  { level: 4, minutes: 263, roleId: "1221085197546684416" },
  { level: 5, minutes: 299, roleId: "1221085230232764427" },
  { level: 6, minutes: 339, roleId: "1221085254245154816" },
  { level: 7, minutes: 385, roleId: "1221085338164793445" },
  { level: 8, minutes: 437, roleId: "1221085362991009864" },
  { level: 9, minutes: 497, roleId: "1221085381676630097" },
  { level: 10, minutes: 564, roleId: "1221085402794950757" },
  { level: 15, minutes: 1063, roleId: "1221085525666955325" },
  { level: 20, minutes: 2004, roleId: "1221085548471390258" },
  { level: 25, minutes: 3778, roleId: "1221085567639359498" },
  { level: 30, minutes: 7122, roleId: "1221085588023808041" },
  { level: 40, minutes: 25318, roleId: "1221085615899152435" },
  { level: 50, minutes: 90000, roleId: "1221085637529042994" }
];

async function addXP() {
  const guild = client.guilds.cache.get("1220475445569523742");
  if (!guild) return;

  const inVoice = (await guild?.fetch())!.members.cache.filter(
    (member) =>
      member.voice.channel && member.voice.channel.name != "Nouveau Salon"
  );

  const users = inVoice.map((user) => user);

  for (const member of users) {
    await addVoiceMinutes(member.id, 1);

    const time = (
      await db.query(`SELECT minutes FROM voice_time WHERE user_id = $1`, [
        member.id
      ])
    ).rows.at(0)["minutes"];

    console.log(time);
    checkLevel(time, member);
  }
}

async function checkLevel(minutes: number, member: GuildMember) {
  if (minutes < 180) {
    return;
  }

  const current = levels.findLast((l) => minutes >= l.minutes);
  if (!current) return;

  const toRemove = levels
    .filter((l) => l.roleId !== current.roleId)
    .map((l) => l.roleId)
    .filter((id) => member.roles.cache.has(id));

  if (toRemove.length > 0) {
    await member.roles.remove(toRemove);
  }

  if (!member.roles.cache.has(current.roleId)) {
    await member.roles.add(current.roleId);
  }
}

CronJob.from({
  cronTime: "* * * * *",
  onTick: addXP,
  start: true
});
