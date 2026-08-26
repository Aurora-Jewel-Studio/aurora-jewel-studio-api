type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callGemini(messages: ChatMessage[], apiKey: string) {
  const configuredModels = [process.env.GEMINI_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS || "").split(",")]
    .map((model) => model?.trim())
    .filter((model): model is string => Boolean(model));
  const models = configuredModels.length
    ? [...new Set(configuredModels)]
    : ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
  const signal = AbortSignal.timeout(12_000);

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

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const thinkingConfig = /^gemini-3\.7/i.test(model)
        ? { thinkingLevel: "low" }
        : /^gemini-3\.(?:6|5)/i.test(model)
          ? { thinkingLevel: "minimal" }
          : /^gemini-2\.5-flash/i.test(model)
            ? { thinkingBudget: 0 }
            : undefined;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            ...(systemInstruction && { system_instruction: { parts: [{ text: systemInstruction }] } }),
            contents,
            generationConfig: { temperature: 0.2, maxOutputTokens: 512, ...(thinkingConfig && { thinkingConfig }) },
          }),
          signal,
        },
      );

      if (!response.ok) {
        lastError = new Error(`Gemini ${model} returned ${response.status}.`);
        continue;
      }
      const data = (await response.json()) as {
        candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: unknown }> } }>;
      };
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === "MAX_TOKENS") {
        lastError = new Error(`Gemini ${model} exhausted its output budget.`);
        continue;
      }
      const content = candidate?.content?.parts
        ?.flatMap((part) => (typeof part.text === "string" ? [part.text] : []))
        .join("")
        .trim();
      if (!content) {
        lastError = new Error(`Gemini ${model} returned an invalid response.`);
        continue;
      }
      return content;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini returned an invalid response.");
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
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OLLAMA_API_KEY?.trim() && {
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY.trim()}`,
      }),
    },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } }),
    signal: AbortSignal.timeout(20_000),
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
