using System;
using System.Net;
using System.Text;
using System.IO;

public class CPHInline
{
    public bool Execute()
    {
        try
        {
            // 1. Retrieve message, user ID, and username from chat event variables
            if (!CPH.TryGetArg("message", out string messageText)) return true;
            if (!CPH.TryGetArg("user", out string username)) return true;
            if (!CPH.TryGetArg("userName", out string displayName)) displayName = username;

            // 1.5. Detect Platform (Twitch vs YouTube)
            string platform = "twitch"; // Default to Twitch
            if (CPH.TryGetArg("platform", out string plat))
            {
                platform = plat.ToLower();
            }
            else if (CPH.VarExists("youtubeUser") || CPH.VarExists("youtubeEvent") || (CPH.TryGetArg("eventSource", out string source) && source.ToLower().Contains("youtube")))
            {
                platform = "youtube";
            }

            // 2. Retrieve streamer channel slug
            if (!CPH.TryGetArg("pokemonChannelSlug", out string channelSlug))
            {
                channelSlug = "simulator";
            }

            // 3. Determine if we use Bot account or Broadcaster account
            if (!CPH.TryGetArg("useBotAccount", out bool useBotAccount))
            {
                useBotAccount = true;
            }

            // 4. Construct JSON payload manually (no Newtonsoft dependency)
            string jsonPayload = "{" +
                "\"channelId\":\"" + EscapeJson(channelSlug) + "\"," +
                "\"username\":\"" + EscapeJson(username) + "\"," +
                "\"displayName\":\"" + EscapeJson(displayName) + "\"," +
                "\"messageText\":\"" + EscapeJson(messageText) + "\"" +
            "}";

            // 5. Send POST request to backend using WebClient
            string backendUrl = "http://localhost:3000/api/chat";

            using (WebClient wc = new WebClient())
            {
                wc.Encoding = Encoding.UTF8;
                wc.Headers[HttpRequestHeader.ContentType] = "application/json; charset=utf-8";
                string response = wc.UploadString(backendUrl, "POST", jsonPayload);

                // 6. Parse reply from response
                string reply = ExtractJsonValue(response, "reply");
                if (!string.IsNullOrEmpty(reply))
                {
                    CPH.SetArgument("PokimonResponce", reply);
                    CPH.SetArgument("PokimonResponse", reply);

                    if (platform == "youtube")
                    {
                        if (useBotAccount)
                        {
                            CPH.SendYouTubeMessage(reply, true);
                        }
                        else
                        {
                            CPH.SendYouTubeMessage(reply);
                        }
                    }
                    else // Twitch
                    {
                        if (useBotAccount)
                        {
                            CPH.SendChatMessage(reply, true);
                        }
                        else
                        {
                            CPH.SendChatMessage(reply);
                        }
                    }
                    return true;
                }
                else
                {
                    CPH.SetArgument("PokimonResponce", "");
                    CPH.SetArgument("PokimonResponse", "");
                    return false; // Stop further sub-actions to prevent sending empty messages
                }
            }
        }
        catch (Exception ex)
        {
            CPH.LogWarn("[Pokemon Overlay] Error: " + ex.Message);
            CPH.SetArgument("PokimonResponce", "");
            CPH.SetArgument("PokimonResponse", "");
            return false;
        }

        return true;
    }

    // Simple JSON string escaper
    private string EscapeJson(string s)
    {
        if (s == null) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
    }

    // Simple JSON value extractor (avoids Newtonsoft dependency)
    private string ExtractJsonValue(string json, string key)
    {
        string searchKey = "\"" + key + "\"";
        int keyIndex = json.IndexOf(searchKey);
        if (keyIndex == -1) return null;

        int colonIndex = json.IndexOf(':', keyIndex + searchKey.Length);
        if (colonIndex == -1) return null;

        // Skip whitespace after colon
        int valueStart = colonIndex + 1;
        while (valueStart < json.Length && json[valueStart] == ' ') valueStart++;

        if (valueStart >= json.Length) return null;

        // Check for null
        if (json.Substring(valueStart).StartsWith("null")) return null;

        // Check for string value
        if (json[valueStart] == '"')
        {
            int strStart = valueStart + 1;
            int strEnd = strStart;
            while (strEnd < json.Length)
            {
                if (json[strEnd] == '\\') { strEnd += 2; continue; }
                if (json[strEnd] == '"') break;
                strEnd++;
            }
            return json.Substring(strStart, strEnd - strStart)
                       .Replace("\\\"", "\"")
                       .Replace("\\\\", "\\")
                       .Replace("\\n", "\n");
        }

        return null;
    }
}
