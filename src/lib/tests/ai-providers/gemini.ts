import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { AIProviderAdapter, AIProviderMessage } from './types';

export const geminiProvider: AIProviderAdapter = {
  name: 'Gemini (Google)',
  envVarName: 'GEMINI_API_KEY',

  getApiKey() {
    return process.env.GEMINI_API_KEY || null;
  },

  async streamCompletion(message: AIProviderMessage): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.getApiKey()!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: message.systemPrompt,
    });

    const parts: Part[] = [];

    for (const part of message.userContent) {
      if (part.type === 'image') {
        parts.push({
          inlineData: { mimeType: part.mediaType, data: part.base64 },
        });
      } else {
        parts.push({ text: part.text });
      }
    }

    const result = await model.generateContentStream(parts);

    let responseText = '';
    for await (const chunk of result.stream) {
      responseText += chunk.text();
    }

    return responseText;
  },
};
