const { LiveChat } = require('youtube-chat');

// Map of streamerChannelId -> LiveChat instance
const activeChats = new Map();

/**
 * Initializes a YouTube live chat listener for a specific streamer session.
 * 
 * @param {String} streamerId - The unique channel identifier for the streamer.
 * @param {Object} config - Config details containing channelId or videoId.
 * @param {Function} onMessageCallback - Callback format: onMessageCallback(streamerId, username, displayName, messageText)
 */
function extractVideoId(input) {
  if (!input) return '';
  const cleanInput = input.trim();
  const match = cleanInput.match(/(?:\/live\/|v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  if (cleanInput.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(cleanInput)) {
    return cleanInput;
  }
  return cleanInput;
}

function extractChannelId(input) {
  if (!input) return '';
  const cleanInput = input.trim();
  const match = cleanInput.match(/(?:\/channel\/)(UC[a-zA-Z0-9_-]{22})/i);
  if (match) return match[1];
  if (cleanInput.startsWith('UC') && cleanInput.length === 24) {
    return cleanInput;
  }
  return cleanInput;
}

/**
 * Initializes a YouTube live chat listener for a specific streamer session.
 * 
 * @param {String} streamerId - The unique channel identifier for the streamer.
 * @param {Object} config - Config details containing channelId or videoId.
 * @param {Function} onMessageCallback - Callback format: onMessageCallback(streamerId, username, displayName, messageText)
 */
function startYoutubeChat(streamerId, config, onMessageCallback) {
  const streamer = streamerId.toLowerCase().trim();
  const rawChannelId = config.youtubeChannelId;
  const rawVideoId = config.videoId;
  
  const videoId = extractVideoId(rawVideoId);
  const channelId = extractChannelId(rawChannelId);
  
  if (!channelId && !videoId) {
    console.log(`[YouTube Chat] [${streamer}] No channelId or videoId configured. Chat Bot running in SIMULATOR-ONLY mode.`);
    return null;
  }

  // Ensure any existing instance for this streamer is closed before initializing a new one
  stopYoutubeChat(streamer);

  try {
    const options = {};
    if (videoId) {
      options.liveId = videoId;
      console.log(`[YouTube Chat] [${streamer}] Connecting to Live Chat for Video ID: ${videoId}...`);
    } else if (channelId) {
      options.channelId = channelId;
      console.log(`[YouTube Chat] [${streamer}] Connecting to Live Chat for Channel ID: ${channelId}...`);
    }

    const liveChat = new LiveChat(options);

    liveChat.on('start', (liveId) => {
      console.log(`[YouTube Chat] [${streamer}] Connection established. Listening to stream: ${liveId}`);
    });

    liveChat.on('end', (reason) => {
      console.log(`[YouTube Chat] [${streamer}] Connection ended: ${reason}`);
      activeChats.delete(streamer);
    });

    liveChat.on('error', (err) => {
      console.error(`[YouTube Chat] [${streamer}] Error:`, err.message);
    });

    liveChat.on('chat', (chatItem) => {
      if (!chatItem || !chatItem.message || !chatItem.author) return;

      // Extract unique channelId or fallback to name
      const username = chatItem.author.channelId || chatItem.author.name.toLowerCase();
      const displayName = chatItem.author.name;

      // Reconstruct full chat message
      const messageText = chatItem.message
        .map((part) => part.text || '')
        .join('')
        .trim();

      if (messageText) {
        onMessageCallback(streamer, username, displayName, messageText);
      }
    });

    const ok = liveChat.start();
    if (ok) {
      activeChats.set(streamer, liveChat);
    } else {
      console.error(`[YouTube Chat] [${streamer}] Failed to start YouTube Chat client.`);
    }
  } catch (err) {
    console.error(`[YouTube Chat] [${streamer}] Exception while starting chat reader:`, err.message);
  }
}

/**
 * Stops a specific YouTube live chat listener.
 */
function stopYoutubeChat(streamerId) {
  const streamer = streamerId.toLowerCase().trim();
  const liveChat = activeChats.get(streamer);
  if (liveChat) {
    console.log(`[YouTube Chat] [${streamer}] Stopping live chat client...`);
    try {
      liveChat.stop();
    } catch (err) {
      console.error(`[YouTube Chat] [${streamer}] Error stopping chat client:`, err.message);
    }
    activeChats.delete(streamer);
  }
}

module.exports = {
  startYoutubeChat,
  stopYoutubeChat,
  extractVideoId,
  extractChannelId,
  activeChats
};
