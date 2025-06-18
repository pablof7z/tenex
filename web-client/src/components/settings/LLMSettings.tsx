import { Check, Loader2, Plus, Settings, TestTube, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { LLMConfig, LLMProvider } from "../../types/llm";
import { DEFAULT_MODELS } from "../../types/llm";
import { useLLMConfig } from "../../hooks/useLLMConfig";
import { formatModelWithPricing, validateApiKeyFormat } from "../../utils/llmModels";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

const PROVIDER_NAMES: Record<LLMProvider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq",
  deepseek: "DeepSeek",
  ollama: "Ollama",
};

const PROVIDER_DESCRIPTIONS: Record<LLMProvider, string> = {
  openai: "Direct access to GPT models with the latest features",
  openrouter: "Unified API for multiple AI models with competitive pricing",
  anthropic: "Claude models known for safety and instruction following",
  google: "Gemini models with large context windows and multimodal capabilities",
  groq: "Ultra-fast inference for open-source models",
  deepseek: "Advanced reasoning and coding models",
  ollama: "Run models locally on your machine",
};

interface LLMConfigFormProps {
  provider: LLMProvider;
  onSave: (config: LLMConfig) => void;
  onCancel: () => void;
  existingConfig?: LLMConfig;
}

function LLMConfigForm({ provider, onSave, onCancel, existingConfig }: LLMConfigFormProps) {
  const { availableModels, loadModels, testConfiguration, getCredentials } = useLLMConfig();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(existingConfig?.model || DEFAULT_MODELS[provider]);
  const [enableCaching, setEnableCaching] = useState(existingConfig?.enableCaching || false);
  const [contextWindowSize, setContextWindowSize] = useState(existingConfig?.contextWindowSize?.toString() || "");
  const [temperature, setTemperature] = useState(existingConfig?.temperature?.toString() || "");
  const [maxTokens, setMaxTokens] = useState(existingConfig?.maxTokens?.toString() || "");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    const credentials = getCredentials(provider);
    if (credentials?.apiKey) {
      setApiKey(credentials.apiKey);
    }
  }, [provider, getCredentials]);

  useEffect(() => {
    loadModels(provider);
  }, [provider, loadModels]);

  const handleTest = async () => {
    if (!apiKey || !validateApiKeyFormat(provider, apiKey)) {
      setTestResult(false);
      return;
    }

    setIsTesting(true);
    try {
      const result = await testConfiguration(provider, apiKey, model);
      setTestResult(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const config: LLMConfig = {
      provider,
      model,
      enableCaching,
    };

    if (contextWindowSize) {
      config.contextWindowSize = parseInt(contextWindowSize);
    }
    if (temperature) {
      config.temperature = parseFloat(temperature);
    }
    if (maxTokens) {
      config.maxTokens = parseInt(maxTokens);
    }

    onSave(config);
  };

  const models = availableModels[provider] || [];
  const requiresApiKey = provider !== 'ollama';
  const selectedModel = models.find(m => m.id === model);
  const supportsCaching = selectedModel?.supportsCaching;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{PROVIDER_NAMES[provider]}</h3>
            <p className="text-sm text-muted-foreground">{PROVIDER_DESCRIPTIONS[provider]}</p>
          </div>
        </div>

        {requiresApiKey && (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-api-key`}>API Key</Label>
            <div className="flex gap-2">
              <Input
                id={`${provider}-api-key`}
                type="password"
                placeholder={`Enter your ${PROVIDER_NAMES[provider]} API key`}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!apiKey || isTesting}
                className="shrink-0"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : testResult === true ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </Button>
            </div>
            {testResult === false && (
              <p className="text-sm text-red-500">
                API key test failed. Please check your key and try again.
              </p>
            )}
            {!validateApiKeyFormat(provider, apiKey) && apiKey && (
              <p className="text-sm text-yellow-600">
                API key format may be incorrect for {PROVIDER_NAMES[provider]}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`${provider}-model`}>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((modelOption) => (
                <SelectItem key={modelOption.id} value={modelOption.id}>
                  {formatModelWithPricing(modelOption)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedModel?.contextLength && (
            <p className="text-sm text-muted-foreground">
              Context window: {selectedModel.contextLength.toLocaleString()} tokens
            </p>
          )}
        </div>

        {supportsCaching && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Caching</Label>
              <p className="text-sm text-muted-foreground">
                Reduce costs by caching repeated prompts (up to 90% savings)
              </p>
            </div>
            <Switch
              checked={enableCaching}
              onCheckedChange={setEnableCaching}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${provider}-context`}>Context Window</Label>
            <Input
              id={`${provider}-context`}
              type="number"
              placeholder="Auto"
              value={contextWindowSize}
              onChange={(e) => setContextWindowSize(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`${provider}-temperature`}>Temperature</Label>
            <Input
              id={`${provider}-temperature`}
              type="number"
              step="0.1"
              min="0"
              max="2"
              placeholder="Auto"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`${provider}-tokens`}>Max Tokens</Label>
            <Input
              id={`${provider}-tokens`}
              type="number"
              placeholder="Auto"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            disabled={requiresApiKey && (!apiKey || testResult === false)}
            className="flex-1"
          >
            Save Configuration
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function LLMSettings() {
  const {
    config,
    isLoadingModels,
    addConfiguration,
    removeConfiguration,
    setCredentials,
    setDefault,
    getCredentials,
    loadModels,
  } = useLLMConfig();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openai');
  const [editingConfig, setEditingConfig] = useState<string | null>(null);

  useEffect(() => {
    // Load all models
    loadModels();
  }, [loadModels]);

  const handleSaveConfig = useCallback((configName: string, llmConfig: LLMConfig) => {
    // Save the configuration
    addConfiguration(configName, llmConfig);
    
    // Save credentials separately
    const credentials = getCredentials(llmConfig.provider);
    if (!credentials?.apiKey) {
      // This should not happen if the form validation is working correctly
      console.error('No credentials found for provider:', llmConfig.provider);
    }
    
    // Set as default if it's the first configuration
    if (Object.keys(config.configurations).length === 0) {
      setDefault('default', configName);
      setDefault('titleGeneration', configName);
    }
    
    setShowAddForm(false);
    setEditingConfig(null);
  }, [addConfiguration, getCredentials, config.configurations, setDefault]);

  const handleSaveFromForm = useCallback((llmConfig: LLMConfig) => {
    const configName = editingConfig || llmConfig.provider;
    
    // Store credentials
    const credentials = getCredentials(llmConfig.provider);
    if (credentials?.apiKey) {
      setCredentials(llmConfig.provider, credentials);
    }
    
    handleSaveConfig(configName, llmConfig);
  }, [editingConfig, getCredentials, setCredentials, handleSaveConfig]);


  const configurations = Object.entries(config.configurations);
  const hasConfigurations = configurations.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">LLM Configuration</h2>
          <p className="text-muted-foreground">
            Configure AI models for title generation and other features
          </p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Configuration
          </Button>
        )}
      </div>


      {showAddForm && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={selectedProvider} onValueChange={(value: LLMProvider) => setSelectedProvider(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_NAMES).map(([provider, name]) => (
                  <SelectItem key={provider} value={provider}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <LLMConfigForm
            provider={selectedProvider}
            onSave={handleSaveFromForm}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {editingConfig && config.configurations[editingConfig] && (
        <LLMConfigForm
          provider={config.configurations[editingConfig].provider}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingConfig(null)}
          existingConfig={config.configurations[editingConfig]}
        />
      )}

      {isLoadingModels && (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading available models...</span>
          </div>
        </Card>
      )}

      {hasConfigurations && !showAddForm && !editingConfig && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Configured Providers</h3>
          <div className="grid gap-4">
            {configurations.map(([name, llmConfig]) => (
              <Card key={name} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{PROVIDER_NAMES[llmConfig.provider]}</h4>
                      {config.defaults?.default === name && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Model: {llmConfig.model}
                      {llmConfig.enableCaching && " • Caching enabled"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingConfig(name)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeConfiguration(name)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!hasConfigurations && !showAddForm && !isLoadingModels && (
        <Card className="p-8">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">No LLM Configurations</h3>
            <p className="text-muted-foreground">
              Add your first LLM configuration to enable AI features like automatic title generation.
            </p>
            <Button onClick={() => setShowAddForm(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Configuration
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}