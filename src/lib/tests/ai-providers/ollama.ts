import { AIProviderAdapter, AIProviderMessage } from './types';

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_BASE_URL = 'http://localhost:11434';

function getBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
}

function getModel(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

export const ollamaProvider: AIProviderAdapter = {
  name: 'Ollama (Local)',
  envVarName: 'OLLAMA_MODEL',

  getApiKey() {
    // Ollama doesn't need an API key — return the model name so the
    // "key exists" check in ai-review.ts passes.
    return getModel();
  },

  async streamCompletion(message: AIProviderMessage): Promise<string> {
    const baseUrl = getBaseUrl();
    const model = getModel();

    // Build the messages array (system + user) in Ollama chat format
    const messages: { role: string; content: string; images?: string[] }[] = [
      { role: 'system', content: message.systemPrompt },
    ];

    // Collect text parts and images separately
    const textParts: string[] = [];
    const images: string[] = [];

    for (const part of message.userContent) {
      if (part.type === 'image') {
        images.push(part.base64);
      } else {
        textParts.push(part.text);
      }
    }

    const userMessage: { role: string; content: string; images?: string[] } = {
      role: 'user',
      content: textParts.join('\n\n'),
    };

    if (images.length > 0) {
      userMessage.images = images;
    }

    messages.push(userMessage);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama request failed (${response.status}): ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error('Ollama returned an empty response body');
    }

    // Stream the response — Ollama returns newline-delimited JSON
    let responseText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            responseText += parsed.message.content;
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    return responseText;
  },
};
