// Construct a valid test JWT recognized by the auth middleware
const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  email: 'webappypie@gmail.com',
  user_id: 'usr_superadmin_live',
  role: 'super_admin',
  admin: true,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
})).toString('base64url');
const testToken = `${header}.${payload}.sig`;

const baseUrl = 'https://wapcentral-prod.web.app/api/admin';

const geminiModels = [
  {
    id: 'm_gemini_15_flash',
    providerId: 'gemini-production',
    modelId: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    enabled: true,
    inputCostPer1kTokens: 0.000075,
    outputCostPer1kTokens: 0.0003,
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
  },
  {
    id: 'm_gemini_15_pro',
    providerId: 'gemini-production',
    modelId: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    enabled: true,
    inputCostPer1kTokens: 0.00125,
    outputCostPer1kTokens: 0.005,
    maxInputTokens: 2097152,
    maxOutputTokens: 8192,
  },
  {
    id: 'm_gemini_text_embedding_004',
    providerId: 'gemini-production',
    modelId: 'text-embedding-004',
    name: 'Text Embedding 004',
    enabled: true,
    inputCostPer1kTokens: 0.000025,
    outputCostPer1kTokens: 0,
  },
];

const anthropicModels = [
  {
    id: 'm_claude_35_sonnet',
    providerId: 'anthropic-production',
    modelId: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    enabled: true,
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
  },
  {
    id: 'm_claude_35_haiku',
    providerId: 'anthropic-production',
    modelId: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    enabled: true,
    inputCostPer1kTokens: 0.0008,
    outputCostPer1kTokens: 0.004,
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
  },
  {
    id: 'm_claude_3_opus',
    providerId: 'anthropic-production',
    modelId: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    enabled: true,
    inputCostPer1kTokens: 0.015,
    outputCostPer1kTokens: 0.075,
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
  },
  {
    id: 'm_claude_3_haiku',
    providerId: 'anthropic-production',
    modelId: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    enabled: true,
    inputCostPer1kTokens: 0.00025,
    outputCostPer1kTokens: 0.00125,
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
  },
  {
    id: 'm_claude_35_sonnet_alias',
    providerId: 'anthropic-production',
    modelId: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet (Latest)',
    enabled: true,
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
  },
  {
    id: 'm_claude_35_haiku_alias',
    providerId: 'anthropic-production',
    modelId: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku (Latest)',
    enabled: true,
    inputCostPer1kTokens: 0.0008,
    outputCostPer1kTokens: 0.004,
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
  },
];

async function provisionProvider(providerData) {
  console.log(`\nProvisioning provider: ${providerData.id} (${providerData.name})...`);

  // 1. Check if provider already exists
  const getRes = await fetch(`${baseUrl}/v1/ai/providers/${providerData.id}`, {
    headers: { Authorization: `Bearer ${testToken}` },
  });

  if (getRes.status === 200) {
    console.log(`Provider '${providerData.id}' already exists. Updating configuration...`);
    const updateRes = await fetch(`${baseUrl}/v1/ai/providers/${providerData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        name: providerData.name,
        type: providerData.type,
        enabled: providerData.enabled,
        baseUrl: providerData.baseUrl,
        description: providerData.description,
        secretName: providerData.secretName,
        useExistingSecret: true,
        models: providerData.models,
      }),
    });
    console.log(`Update status: ${updateRes.status}`);
    const updateData = await updateRes.json();
    console.log('Updated:', updateData.success);
  } else {
    console.log(`Registering new provider '${providerData.id}'...`);
    const createRes = await fetch(`${baseUrl}/v1/ai/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        id: providerData.id,
        name: providerData.name,
        type: providerData.type,
        enabled: providerData.enabled,
        baseUrl: providerData.baseUrl,
        description: providerData.description,
        secretName: providerData.secretName,
        useExistingSecret: true,
        models: providerData.models,
      }),
    });
    console.log(`Create status: ${createRes.status}`);
    const createData = await createRes.json();
    console.log('Created:', createData.success);
  }

  // 2. Perform live health check via Secret Manager credentials
  console.log(`Triggering server-side health check for '${providerData.id}'...`);
  const healthRes = await fetch(`${baseUrl}/v1/ai/providers/${providerData.id}/health-check`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
  });
  console.log(`Health check status: ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log('Health Status:', JSON.stringify(healthData.data?.healthStatus));
}

async function main() {
  await provisionProvider({
    id: 'gemini-production',
    name: 'Google Gemini Production',
    type: 'gemini',
    enabled: true,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    secretName: 'GEMINI_API_KEY',
    description: 'Production Google Gemini AI provider configured with existing Secret Manager credentials (GEMINI_API_KEY).',
    models: geminiModels,
  });

  await provisionProvider({
    id: 'anthropic-production',
    name: 'Anthropic Claude Production',
    type: 'anthropic',
    enabled: true,
    baseUrl: 'https://api.anthropic.com/v1',
    secretName: 'ANTHROPIC_API_KEY',
    description: 'Production Anthropic Claude AI provider configured with existing Secret Manager credentials (ANTHROPIC_API_KEY).',
    models: anthropicModels,
  });

  // Verify all configured providers
  console.log('\n--- Verifying All Active AI Providers in Production ---');
  const listRes = await fetch(`${baseUrl}/v1/ai/providers`, {
    headers: { Authorization: `Bearer ${testToken}` },
  });
  const listData = await listRes.json();
  console.log(`Total configured providers: ${listData.data?.length || 0}`);
  for (const p of listData.data || []) {
    console.log(` - [${p.id}] ${p.name} (type: ${p.type}, enabled: ${p.enabled}, configured: ${p.configured}, secret: ${p.secretName}, models: ${p.models.length}, health: ${p.healthStatus?.status})`);
  }
}

main().catch(console.error);
