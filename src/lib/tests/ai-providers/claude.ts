import Anthropic from '@anthropic-ai/sdk';
import { AIProviderAdapter, AIProviderMessage } from './types';

export const claudeProvider: AIProviderAdapter = {
  name: 'Claude (Anthropic)',
  envVarName: 'ANTHROPIC_API_KEY',

  getApiKey() {
    return process.env.ANTHROPIC_API_KEY || null;
  },

  async streamCompletion(message: AIProviderMessage): Promise<string> {
    const client = new Anthropic({ apiKey: this.getApiKey()! });

    const userContent: Anthropic.MessageCreateParamsStreaming['messages'][0]['content'] = [];

    for (const part of message.userContent) {
      if (part.type === 'image') {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: part.base64,
          },
        });
      } else {
        userContent.push({ type: 'text', text: part.text });
      }
    }

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: message.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    let responseText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        responseText += event.delta.text;
      }
    }

    return responseText;
  },
};
