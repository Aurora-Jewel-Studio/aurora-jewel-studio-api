type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callGemini(messages: ChatMessage[], apiKey: string) {
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const systemInstruction = messages
    .filter(({ role }) => role === "system")
    .map(({ content }) => content)
    .join("\n\n");
  const contents = messages
    .filter(({ role }) => role !== "system")
    .map(({ role, content }) => ({
      role: role === "assistant" ? "model" : "user",
      parts: [{ text: content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(systemInstruction && { system_instruction: { parts: [{ text: systemInstruction }] } }),
        contents,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) throw new Error(`Gemini returned ${response.status}.`);
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts
    ?.flatMap((part) => (typeof part.text === "string" ? [part.text] : []))
    .join("")
    .trim();
  if (!content) throw new Error("Gemini returned an invalid response.");
  return content;
}

async function callOllama(messages: ChatMessage[]) {
  const model = process.env.CHAT_MODEL || "gemma3:4b";
  const baseUrl = new URL(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");

  if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error("OLLAMA_BASE_URL must be an HTTP(S) URL without embedded credentials.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname)
  ) {
    throw new Error(
      "Ollama on localhost is unavailable to Vercel. Production chat requires a publicly hosted model provider.",
    );
  }

  const response = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
  const data = (await response.json()) as { message?: { content?: unknown } };
  if (typeof data.message?.content !== "string" || !data.message.content.trim()) {
    throw new Error("Ollama returned an invalid response.");
  }
  return data.message.content.trim();
}

export async function callChatModel(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    try {
      return await callGemini(messages, apiKey);
    } catch (error) {
      console.warn("Gemini unavailable; using Ollama fallback.", error);
    }
  }
  return callOllama(messages);
}
