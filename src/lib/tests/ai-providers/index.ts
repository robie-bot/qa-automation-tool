import { AIProvider } from '@/types';
import { AIProviderAdapter } from './types';
import { claudeProvider } from './claude';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';
import { ollamaProvider } from './ollama';

const providers: Record<AIProvider, AIProviderAdapter> = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

export function getProvider(id: AIProvider): AIProviderAdapter {
  return providers[id];
}

export type { AIUserContent, AIProviderMessage, AIProviderAdapter } from './types';
