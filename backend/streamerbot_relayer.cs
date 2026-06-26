using System;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private static readonly HttpClient client = new HttpClient();

    public bool Execute()
    {
        try
        {
            // 1. Retrieve message, user ID, and username from YouTube chat event variables
            // In Streamer.bot, YouTube live chat triggers populate: "message", "user", and "userName"
            if (!CPH.TryGetArg("message", out string messageText)) return true;
            if (!CPH.TryGetArg("user", out string username)) return true;
            if (!CPH.TryGetArg("userName", out string displayName)) displayName = username;

            // 2. Retrieve streamer channel slug (configured in Streamer.bot, defaults to 'sage')
            if (!CPH.TryGetArg("pokemonChannelSlug", out string channelSlug))
            {
                channelSlug = "sage"; // REPLACE with your channel slug if not using variables
            }

            // 3. Determine if we use Bot account or Broadcaster account
            if (!CPH.TryGetArg("useBotAccount", out bool useBotAccount))
            {
                useBotAccount = true; // Set to false to reply as the broadcaster instead of bot
            }

            // 4. Construct payload
            var payload = new
            {
                channelId = channelSlug,
                username = username,
                displayName = displayName,
                messageText = messageText
            };

            string jsonPayload = JsonConvert.SerializeObject(payload);
            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            // 5. Send POST request to backend
            string backendUrl = "https://pokemon-overlay-backend-hfpf.onrender.com/api/chat";
            client.Timeout = TimeSpan.FromSeconds(5);
            
            var response = client.PostAsync(backendUrl, content).GetAwaiter().GetResult();
            if (response.IsSuccessStatusCode)
            {
                string jsonResponse = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                var data = JsonConvert.DeserializeObject<JObject>(jsonResponse);

                if (data != null && data["reply"] != null && data["reply"].Type != JTokenType.Null)
                {
                    string replyMsg = data["reply"].ToString();
                    if (!string.IsNullOrEmpty(replyMsg))
                    {
                        if (useBotAccount)
                        {
                            CPH.SendYouTubeMessageFromBot(replyMsg);
                        }
                        else
                        {
                            CPH.SendYouTubeMessage(replyMsg);
                        }
                    }
                }
            }
            else
            {
                CPH.LogWarn($"[Pokemon overlay] API request failed: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            CPH.LogError($"[Pokemon overlay] Error in chat relay script: {ex.Message}");
        }

        return true;
    }
}
