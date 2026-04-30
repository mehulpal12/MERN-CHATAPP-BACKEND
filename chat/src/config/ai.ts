import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function generateSuggestions(context: string[]) {
  try {
    const lastMessages = context.slice(-5).join("\n");

    const response = await openai.chat.completions.create({
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      temperature: 0.4,
      top_p: 0.9,
      messages: [
        {
          role: "system",
          content:
            "You generate short chat replies (max 6 words). Return ONLY a JSON array of 3 replies.",
        },
        {
          role: "user",
          content: `Conversation:\n${lastMessages}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "[]";

    let suggestions: string[] = [];

    try {
      suggestions = JSON.parse(text);
    } catch {
      suggestions = text
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    return suggestions.length > 0
      ? suggestions
      : ["Okay", "Got it", "Sounds good"];
  } catch (error) {
    console.error("AI Error:", error);
    return ["Okay", "Got it", "Sounds good"];
  }
}