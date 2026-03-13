'use client';

import { useEffect, useState } from 'react';
import { Key, Settings, Eye, EyeOff, Save, Trash2, Check, Monitor } from 'lucide-react';

const AI_PROVIDERS = [
  { id: 'claude', name: 'Claude (Anthropic)', envVar: 'ANTHROPIC_API_KEY' },
  { id: 'openai', name: 'GPT (OpenAI)', envVar: 'OPENAI_API_KEY' },
  { id: 'gemini', name: 'Gemini (Google)', envVar: 'GEMINI_API_KEY' },
  { id: 'ollama', name: 'Ollama (Local)', envVar: 'OLLAMA_MODEL' },
];

interface ApiKeyEntry {
  id: string;
  provider: string;
  maskedKey: string;
  updatedAt: string;
}

interface UserSettingsData {
  defaultProvider: string;
  defaultViewports: string;
  aiReviewVision: boolean;
}

export default function SettingsPage() {
  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState('claude');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState('');

  // Settings state
  const [settings, setSettings] = useState<UserSettingsData>({
    defaultProvider: 'ollama',
    defaultViewports: '1920,1440,1024,768,375',
    aiReviewVision: false,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    fetchApiKeys();
    fetchSettings();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/user/api-keys');
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.apiKeys);
      }
    } catch { /* silent */ }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          defaultProvider: data.settings.defaultProvider,
          defaultViewports: data.settings.defaultViewports,
          aiReviewVision: data.settings.aiReviewVision,
        });
      }
    } catch { /* silent */ }
  };

  const saveApiKey = async () => {
    if (!newKeyValue.trim()) return;
    setKeySaving(true);
    setKeyMessage('');
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newKeyProvider, key: newKeyValue }),
      });
      if (res.ok) {
        setKeyMessage('API key saved successfully');
        setNewKeyValue('');
        fetchApiKeys();
      } else {
        const data = await res.json();
        setKeyMessage(data.error || 'Failed to save');
      }
    } catch {
      setKeyMessage('Failed to save API key');
    } finally {
      setKeySaving(false);
    }
  };

  const deleteApiKey = async (provider: string) => {
    try {
      const res = await fetch(`/api/user/api-keys?provider=${provider}`, { method: 'DELETE' });
      if (res.ok) {
        fetchApiKeys();
        setKeyMessage(`${provider} API key removed`);
      }
    } catch { /* silent */ }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage('');
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettingsMessage('Settings saved');
      } else {
        setSettingsMessage('Failed to save settings');
      }
    } catch {
      setSettingsMessage('Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-t-primary">Settings</h1>
        <p className="text-t-secondary mt-2">Manage your API keys and review preferences.</p>
      </div>

      {/* API Keys Section */}
      <div className="bg-surface rounded-2xl border border-b p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#FF7F11]/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-[#FF7F11]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-t-primary">API Keys</h2>
            <p className="text-xs text-t-secondary">Your keys are encrypted and stored securely.</p>
          </div>
        </div>

        {/* Existing keys */}
        {apiKeys.length > 0 && (
          <div className="space-y-2 mb-6">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between bg-surface-secondary rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-t-primary">
                    {AI_PROVIDERS.find(p => p.id === key.provider)?.name || key.provider}
                  </p>
                  <p className="text-xs text-t-tertiary font-mono">{key.maskedKey}</p>
                </div>
                <button
                  onClick={() => deleteApiKey(key.provider)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove key"
                >
                  <Trash2 className="w-4 h-4 text-t-tertiary hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new key */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <select
              value={newKeyProvider}
              onChange={(e) => setNewKeyProvider(e.target.value)}
              className="rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder={`Enter ${AI_PROVIDERS.find(p => p.id === newKeyProvider)?.envVar || 'API key'}...`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-t-tertiary hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveApiKey}
              disabled={keySaving || !newKeyValue.trim()}
              className="flex items-center gap-2 bg-[#FF7F11] hover:bg-[#e6700f] text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Save className="w-4 h-4" />
              {keySaving ? 'Saving...' : 'Save Key'}
            </button>
            {keyMessage && (
              <p className={`text-xs ${keyMessage.includes('success') || keyMessage.includes('saved') || keyMessage.includes('removed') ? 'text-green-600' : 'text-red-500'}`}>
                {keyMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Default Settings Section */}
      <div className="bg-surface rounded-2xl border border-b p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-t-primary">Review Defaults</h2>
            <p className="text-xs text-t-secondary">Configure default settings for new reviews.</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Default AI Provider */}
          <div>
            <label className="block text-sm font-medium text-t-primary mb-1.5">
              Default AI Provider
            </label>
            <select
              value={settings.defaultProvider}
              onChange={(e) => setSettings({ ...settings, defaultProvider: e.target.value })}
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Default Viewports */}
          <div>
            <label className="block text-sm font-medium text-t-primary mb-1.5">
              <span className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-t-tertiary" />
                Default Viewports
              </span>
            </label>
            <input
              type="text"
              value={settings.defaultViewports}
              onChange={(e) => setSettings({ ...settings, defaultViewports: e.target.value })}
              placeholder="1920,1440,1024,768,375"
              className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20"
            />
            <p className="text-xs text-t-tertiary mt-1">Comma-separated viewport widths in pixels</p>
          </div>

          {/* AI Vision Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-t-primary">AI Review Vision Mode</p>
              <p className="text-xs text-t-secondary">Send screenshots to AI for visual analysis (uses more tokens)</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, aiReviewVision: !settings.aiReviewVision })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.aiReviewVision ? 'bg-[#FF7F11]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.aiReviewVision ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveSettings}
              disabled={settingsSaving}
              className="flex items-center gap-2 bg-[#262626] hover:bg-[#333] text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              <Check className="w-4 h-4" />
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </button>
            {settingsMessage && (
              <p className={`text-xs ${settingsMessage.includes('saved') ? 'text-green-600' : 'text-red-500'}`}>
                {settingsMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
