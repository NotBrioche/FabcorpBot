import 'dotenv/config'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import { createTempChannel } from './channels/voice.js'

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
})

client.once(Events.ClientReady, (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`)
})

createTempChannel(client)

client.login(process.env['token'])
