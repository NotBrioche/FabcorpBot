import { EmbedBuilder, Events, SlashCommandBuilder } from "discord.js";
import { client } from "../discordClient";
import { db } from "../database";

const GUILD_ID = "1220475445569523742";
const COMMAND_NAME = "top";

const command = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription("Affiche le top 10 du temps passé en vocal");

// Enregistrement sur le serveur (apparaît instantanément, contrairement aux commandes globales)
client.once(Events.ClientReady, async (c) => {
  await c.guilds.cache.get(GUILD_ID)?.commands.create(command);
});

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== COMMAND_NAME) return;

  await interaction.deferReply();

  try {
    const res = await db.query(
      `SELECT user_id, minutes FROM voice_time ORDER BY minutes DESC LIMIT 10`
    );

    const embed = new EmbedBuilder()
      .setTitle("Top 10")
      .setColor(0x5865f2)
      .setTimestamp();

    if (res.rows.length === 0) {
      embed.setDescription("Personne n'a encore de temps enregistré.");
    } else {
      embed.setDescription(
        res.rows
          .map(
            (row: { user_id: string; minutes: number }, i: number) =>
              `${`**${i + 1}.**`} <@${row.user_id}>: ${formatTime(row.minutes)}`
          )
          .join("\n")
      );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erreur /top-vocal", error);
    await interaction.editReply("Une erreur est survenue, réessaie plus tard.");
  }
});
