import OpenAI from 'openai';
import { AIProviderAdapter, AIProviderMessage } from './types';

export const openaiProvider: AIProviderAdapter = {
  name: 'GPT (OpenAI)',
  envVarName: 'OPENAI_API_KEY',

  getApiKey() {
    return process.env.OPENAI_API_KEY || null;
  },

  async streamCompletion(message: AIProviderMessage): Promise<string> {
    const client = new OpenAI({ apiKey: this.getApiKey()! });

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    for (const part of message.userContent) {
      if (part.type === 'image') {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${part.mediaType};base64,${part.base64}` },
        });
      } else {
        userContent.push({ type: 'text', text: part.text });
      }
    }

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: 'system', content: message.systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    let responseText = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) responseText += delta;
    }

    return responseText;
  },
};
