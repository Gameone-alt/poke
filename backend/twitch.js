const net = require('net');

// Map of streamerId -> { socket, pingInterval }
const activeChats = new Map();

/**
 * Initializes an anonymous Twitch chat listener using TCP IRC.
 * Does not require streamer OAuth, just the channel name.
 * Prepend username with 'twitch_' to avoid DB collisons with YouTube usernames.
 */
function startTwitchChat(streamerId, config, onMessageCallback) {
  const streamer = streamerId.toLowerCase().trim();
  const channel = config.twitchChannel ? config.twitchChannel.toLowerCase().trim() : '';

  if (!channel) {
    console.log(`[Twitch Chat] [${streamer}] No Twitch channel configured. Twitch listener skipped.`);
    return;
  }

  // Ensure previous connections are closed
  stopTwitchChat(streamer);

  console.log(`[Twitch Chat] [${streamer}] Connecting to Twitch IRC channel: #${channel}...`);

  try {
    const socket = net.createConnection(6667, 'irc.chat.twitch.tv');
    socket.setEncoding('utf-8');

    // Keepalive ping timer to prevent timeout
    const pingInterval = setInterval(() => {
      if (socket.writable) {
        socket.write('PING :irc.twitch.tv\r\n');
      }
    }, 60000);

    socket.on('connect', () => {
      console.log(`[Twitch Chat] [${streamer}] Sockets connected. Authenticating anonymously...`);
      socket.write('PASS oauth:anonymous\r\n');
      socket.write('NICK justinfan' + Math.floor(100000 + Math.random() * 900000) + '\r\n');
      socket.write(`JOIN #${channel}\r\n`);
    });

    socket.on('data', (data) => {
      const lines = data.split('\r\n');
      for (const line of lines) {
        if (!line) continue;

        // Respond to PINGs to stay alive
        if (line.startsWith('PING')) {
          socket.write('PONG :tmi.twitch.tv\r\n');
          continue;
        }

        // Parse PRIVMSG message format:
        // :username!username@username.tmi.twitch.tv PRIVMSG #channel :message text
        const match = line.match(/^:([^!]+)![^@]+@[^ ]+ PRIVMSG #[^ ]+ :(.+)$/);
        if (match) {
          const rawUsername = match[1].toLowerCase().trim();
          const displayName = match[1];
          const messageText = match[2].trim();

          // Differentiate Twitch players from YouTube players in DB
          const username = 'twitch_' + rawUsername;

          onMessageCallback(streamer, username, displayName, messageText);
        }
      }
    });

    socket.on('error', (err) => {
      console.error(`[Twitch Chat] [${streamer}] Connection error:`, err.message);
    });

    socket.on('close', () => {
      console.log(`[Twitch Chat] [${streamer}] Sockets closed.`);
      clearInterval(pingInterval);
      activeChats.delete(streamer);
    });

    activeChats.set(streamer, { socket, pingInterval });
  } catch (err) {
    console.error(`[Twitch Chat] [${streamer}] Connection exception:`, err.message);
  }
}

/**
 * Disconnects Twitch chat socket.
 */
function stopTwitchChat(streamerId) {
  const streamer = streamerId.toLowerCase().trim();
  const session = activeChats.get(streamer);
  if (session) {
    console.log(`[Twitch Chat] [${streamer}] Stopping Twitch chat client...`);
    clearInterval(session.pingInterval);
    try {
      session.socket.destroy();
    } catch (e) {
      // ignore socket error during destroy
    }
    activeChats.delete(streamer);
  }
}

module.exports = {
  startTwitchChat,
  stopTwitchChat
};
