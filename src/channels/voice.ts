import { ChannelType, Client, Events, VoiceState } from 'discord.js'

export function createTempChannel(client: Client) {
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.channel?.name == 'Nouveau Salon' && oldState.channelId != newState.channelId) {
      const member = newState.member!

      const personnalChannel = await newState.guild.channels.create({
        name: member.displayName,
        type: ChannelType.GuildVoice,
        parent: '1221186524079718502',
      })

      await personnalChannel?.setName(member!.displayName)
      await member.voice.setChannel(personnalChannel!)
    }

    if (oldState.channelId != newState.channelId && oldState.channel?.members.size! < 1) {
      if (
        oldState.channel?.type == ChannelType.GuildVoice &&
        oldState.channel.name != 'Nouveau Salon'
      ) {
        oldState.channel?.delete()
      }
    }
  })
}
