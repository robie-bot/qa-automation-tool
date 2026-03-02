export type AIUserContent =
  | { type: 'text'; text: string }
  | { type: 'image'; base64: string; mediaType: string };

export interface AIProviderMessage {
  systemPrompt: string;
  userContent: AIUserContent[];
}

export interface AIProviderAdapter {
  name: string;
  envVarName: string;
  getApiKey(): string | null;
  streamCompletion(message: AIProviderMessage): Promise<string>;
}
