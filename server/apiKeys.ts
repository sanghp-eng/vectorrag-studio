import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const API_KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

export type ApiPermission = 'read_rag' | 'search_vector' | 'ingest_doc' | 'full_access';

export interface ExternalApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string; // e.g. "rag_sk_live_...9x4a"
  keyHash: string; // SHA-256 hash of the full secret key
  rawKey?: string; // Full raw secret key for developer copying & immediate integration
  permissions: ApiPermission[];
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  isActive: boolean;
  expiresAt?: string;
}

let apiKeys: ExternalApiKey[] = [];

try {
  if (fs.existsSync(API_KEYS_FILE)) {
    apiKeys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf-8'));
    let updated = false;
    for (const k of apiKeys) {
      if (!k.rawKey) {
        const randomHex = crypto.randomBytes(24).toString('hex');
        k.rawKey = `rag_sk_live_${randomHex}`;
        k.keyHash = hashKey(k.rawKey);
        k.keyPrefix = `rag_sk_live_${k.rawKey.substring(12, 16)}••••••••${k.rawKey.slice(-4)}`;
        updated = true;
      }
    }
    if (updated) {
      fs.writeFileSync(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
    }
  }
} catch (e) {
  console.error('Error loading external API keys:', e);
}

function persistApiKeys() {
  try {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
  } catch (e) {
    console.error('Error persisting external API keys:', e);
  }
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new secure API key (Format: rag_sk_live_32hex_chars)
 */
export function createExternalApiKey(
  userId: string,
  name: string,
  permissions: ApiPermission[] = ['read_rag', 'search_vector'],
  expiresDays?: number
): { apiKey: Omit<ExternalApiKey, 'keyHash'>; secretKey: string } {
  const randomHex = crypto.randomBytes(24).toString('hex');
  const secretKey = `rag_sk_live_${randomHex}`;
  const keyHash = hashKey(secretKey);
  const keyPrefix = `rag_sk_live_${secretKey.substring(12, 16)}••••••••${secretKey.slice(-4)}`;

  let expiresAt: string | undefined = undefined;
  if (expiresDays && expiresDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + expiresDays);
    expiresAt = d.toISOString();
  }

  const newKey: ExternalApiKey = {
    id: 'key_' + crypto.randomBytes(8).toString('hex'),
    userId,
    name: name.trim() || 'Zabbix Chatbot API Client',
    keyPrefix,
    keyHash,
    rawKey: secretKey,
    permissions: permissions.length > 0 ? permissions : ['read_rag', 'search_vector'],
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isActive: true,
    expiresAt,
  };

  apiKeys.push(newKey);
  persistApiKeys();

  const { keyHash: _, ...safeKey } = newKey;
  return { apiKey: safeKey, secretKey };
}

/**
 * List all API keys for a specific user (safe representation without hash)
 */
export function getUserApiKeys(userId: string): Omit<ExternalApiKey, 'keyHash'>[] {
  return apiKeys
    .filter(k => k.userId === userId)
    .map(({ keyHash, ...safe }) => safe)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Revoke / Delete an API key
 */
export function revokeApiKey(userId: string, keyId: string): boolean {
  const initialLen = apiKeys.length;
  apiKeys = apiKeys.filter(k => !(k.id === keyId && k.userId === userId));
  if (apiKeys.length !== initialLen) {
    persistApiKeys();
    return true;
  }
  return false;
}

/**
 * Toggle Active status for an API key
 */
export function toggleApiKeyStatus(userId: string, keyId: string): Omit<ExternalApiKey, 'keyHash'> | null {
  const key = apiKeys.find(k => k.id === keyId && k.userId === userId);
  if (!key) return null;
  key.isActive = !key.isActive;
  persistApiKeys();
  const { keyHash: _, ...safe } = key;
  return safe;
}

/**
 * Validate an incoming API key token and record usage
 */
export function validateApiKey(
  rawToken: string,
  requiredPermission?: ApiPermission
): { valid: boolean; userId?: string; keyInfo?: ExternalApiKey; error?: string } {
  if (!rawToken || !rawToken.startsWith('rag_sk_live_')) {
    return { valid: false, error: 'Định dạng API Key không hợp lệ (Phải bắt đầu bằng rag_sk_live_...)' };
  }

  const incomingHash = hashKey(rawToken);
  const matchedKey = apiKeys.find(k => k.keyHash === incomingHash);

  if (!matchedKey) {
    return { valid: false, error: 'API Key không tồn tại hoặc đã bị thu hồi.' };
  }

  if (!matchedKey.isActive) {
    return { valid: false, error: 'API Key này đã bị tạm dừng hoạt động bởi quản trị viên.' };
  }

  if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API Key này đã hết hạn sử dụng.' };
  }

  if (
    requiredPermission &&
    !matchedKey.permissions.includes('full_access') &&
    !matchedKey.permissions.includes(requiredPermission)
  ) {
    return {
      valid: false,
      error: `API Key không có quyền thực hiện thao tác này (Yêu cầu quyền: ${requiredPermission}).`,
    };
  }

  // Update usage metrics
  matchedKey.usageCount = (matchedKey.usageCount || 0) + 1;
  matchedKey.lastUsedAt = new Date().toISOString();
  persistApiKeys();

  return { valid: true, userId: matchedKey.userId, keyInfo: matchedKey };
}
