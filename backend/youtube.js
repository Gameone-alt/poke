const { LiveChat } = require('youtube-chat');
const fetch = require('node-fetch');

// Map of streamerChannelId -> LiveChat instance
const activeChats = new Map();

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

/**
 * Resolves standard channel IDs, URLs, and handles (@name) to a valid UC... channel ID.
 */
async function resolveChannelId(input) {
  if (!input) return '';
  const cleanInput = input.trim();
  
  if (cleanInput.startsWith('UC') && cleanInput.length === 24) {
    return cleanInput;
  }
  
  const match = cleanInput.match(/(?:\/channel\/)(UC[a-zA-Z0-9_-]{22})/i);
  if (match) return match[1];
  
  let handle = '';
  if (cleanInput.startsWith('@')) {
    handle = cleanInput;
  } else {
    const handleMatch = cleanInput.match(/\/(@[a-zA-Z0-9_-]+)/);
    if (handleMatch) {
      handle = handleMatch[1];
    }
  }
  
  if (handle) {
    try {
      console.log(`[YouTube Chat] Resolving channel ID for handle: ${handle}...`);
      const url = `https://www.youtube.com/${handle}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = await res.text();
      
      const ogMatch = html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      if (ogMatch) {
        console.log(`[YouTube Chat] Resolved handle ${handle} to: ${ogMatch[1]}`);
        return ogMatch[1];
      }
      
      const browseIdMatch = html.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
      if (browseIdMatch) {
        console.log(`[YouTube Chat] Resolved handle ${handle} to: ${browseIdMatch[1]}`);
        return browseIdMatch[1];
      }
      
      const externalIdMatch = html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
      if (externalIdMatch) {
        console.log(`[YouTube Chat] Resolved handle ${handle} to: ${externalIdMatch[1]}`);
        return externalIdMatch[1];
      }
    } catch (e) {
      console.error(`[YouTube Chat] Error resolving handle ${handle}:`, e.message);
    }
  }
  
  return cleanInput;
}

/**
 * Official Google YouTube Live Chat API client mapping.
 * Avoids shared rate limits by billing quota against each streamer's own API Key.
 */
class OfficialLiveChat {
  constructor(options, onMessageCallback, streamer) {
    this.options = options; // { videoId, channelId, apiKey }
    this.onMessageCallback = onMessageCallback;
    this.streamer = streamer;
    this.timer = null;
    this.nextPageToken = null;
    this.liveChatId = null;
    this.isRunning = false;
    this.pollingIntervalMs = 2000;
  }

  async start() {
    this.isRunning = true;
    try {
      let videoId = this.options.videoId;
      
      // If only channelId is provided, lookup active live broadcast video ID first
      if (!videoId && this.options.channelId) {
        console.log(`[YouTube Chat API] [${this.streamer}] Searching for active live stream for channel ID: ${this.options.channelId}...`);
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${this.options.channelId}&eventType=live&type=video&key=${this.options.apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchJson = await searchRes.json();
        
        if (searchJson.items && searchJson.items.length > 0) {
          videoId = searchJson.items[0].id.videoId;
          console.log(`[YouTube Chat API] [${this.streamer}] Found active live stream video ID: ${videoId}`);
        } else {
          console.warn(`[YouTube Chat API] [${this.streamer}] No active live stream found for channel: ${this.options.channelId}. Retrying in 1 min.`);
          this.timer = setTimeout(() => this.start(), 60000);
          return true;
        }
      }

      if (!videoId) {
        console.error(`[YouTube Chat API] [${this.streamer}] Could not find videoId to query.`);
        return false;
      }

      // Query video details to fetch activeLiveChatId
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${this.options.apiKey}`;
      const videoRes = await fetch(videoUrl);
      const videoJson = await videoRes.json();
      
      if (videoJson.error) {
        throw new Error(videoJson.error.message);
      }

      if (!videoJson.items || videoJson.items.length === 0) {
        throw new Error(`Video ID ${videoId} not found.`);
      }

      const streamDetails = videoJson.items[0].liveStreamingDetails;
      if (!streamDetails || !streamDetails.activeLiveChatId) {
        throw new Error(`Video ID ${videoId} does not have an active Live Chat. Is the stream offline?`);
      }

      this.liveChatId = streamDetails.activeLiveChatId;
      console.log(`[YouTube Chat API] [${this.streamer}] Connected successfully. LiveChat ID: ${this.liveChatId}`);

      this.poll();
      return true;
    } catch (err) {
      console.error(`[YouTube Chat API] [${this.streamer}] Initialization failed:`, err.message);
      // Retry connection in 30 seconds
      this.timer = setTimeout(() => this.start(), 30000);
      return false;
    }
  }

  async poll() {
    if (!this.isRunning) return;

    try {
      let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${this.liveChatId}&part=snippet,authorDetails&maxResults=2000&key=${this.options.apiKey}`;
      if (this.nextPageToken) {
        url += `&pageToken=${this.nextPageToken}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error(`[YouTube Chat API] [${this.streamer}] Polling error:`, data.error.message);
        if (data.error.code === 400) {
          console.warn(`[YouTube Chat API] [${this.streamer}] Chat session invalid. Reconnecting in 15 seconds...`);
          this.timer = setTimeout(() => this.start(), 15000);
          return;
        }
      } else {
        this.nextPageToken = data.nextPageToken || this.nextPageToken;
        this.pollingIntervalMs = data.pollingIntervalMillis || this.pollingIntervalMs;

        if (data.items && data.items.length > 0) {
          data.items.forEach(item => {
            const author = item.authorDetails;
            const snippet = item.snippet;

            if (!author || !snippet || snippet.type !== 'textMessageEvent') return;

            const username = author.channelId;
            const displayName = author.displayName;
            const messageText = snippet.textMessageDetails?.messageText || '';

            if (messageText && username) {
              this.onMessageCallback(this.streamer, username, displayName, messageText);
            }
          });
        }
      }
    } catch (err) {
      console.error(`[YouTube Chat API] [${this.streamer}] Polling exception:`, err.message);
    }

    this.timer = setTimeout(() => this.poll(), this.pollingIntervalMs);
  }

  stop() {
    console.log(`[YouTube Chat API] [${this.streamer}] Stopping official live chat client...`);
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}

/**
 * Initializes a YouTube live chat listener for a specific streamer session.
 */
async function startYoutubeChat(streamerId, config, onMessageCallback) {
  const streamer = streamerId.toLowerCase().trim();
  const rawChannelId = config.youtubeChannelId;
  const rawVideoId = config.videoId;
  const apiKey = config.youtubeApiKey;
  
  const videoId = extractVideoId(rawVideoId);
  const channelId = await resolveChannelId(rawChannelId);
  
  if (!channelId && !videoId) {
    console.log(`[YouTube Chat] [${streamer}] No channelId or videoId configured. Chat Bot running in SIMULATOR-ONLY mode.`);
    return null;
  }

  // Ensure any existing instance for this streamer is closed before initializing a new one
  stopYoutubeChat(streamer);

  // If YouTube API Key is supplied, prioritize the official client
  if (apiKey) {
    console.log(`[YouTube Chat] [${streamer}] YouTube API Key detected. Starting official API client...`);
    const officialChat = new OfficialLiveChat({ videoId, channelId, apiKey }, onMessageCallback, streamer);
    const started = await officialChat.start();
    if (started) {
      activeChats.set(streamer, officialChat);
    }
    return;
  }

  // Fallback to web scraper
  console.log(`[YouTube Chat] [${streamer}] No API Key configured. Initializing frontend scraper fallback...`);
  try {
    const options = {};
    if (videoId) {
      options.liveId = videoId;
      console.log(`[YouTube Chat] [${streamer}] Connecting to Live Chat scraper for Video ID: ${videoId}...`);
    } else if (channelId) {
      options.channelId = channelId;
      console.log(`[YouTube Chat] [${streamer}] Connecting to Live Chat scraper for Channel ID: ${channelId}...`);
    }

    const liveChat = new LiveChat(options);

    liveChat.on('start', (liveId) => {
      console.log(`[YouTube Chat] [${streamer}] Scraper connection established. Listening to stream: ${liveId}`);
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

module.exports = {
  startYoutubeChat,
  stopYoutubeChat,
  extractVideoId,
  extractChannelId,
  resolveChannelId
};
