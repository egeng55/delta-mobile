/**
 * Ready Player Me Integration Service
 *
 * Creates stylized 3D avatars from selfies using Ready Player Me's platform.
 * Returns a .glb 3D model URL that can be rendered with spinning animation.
 */

// Ready Player Me configuration
const RPM_SUBDOMAIN = 'delta'; // Replace with your subdomain from RPM Studio
const RPM_BASE_URL = `https://${RPM_SUBDOMAIN}.readyplayer.me`;

// Avatar creation parameters
export interface RPMAvatarConfig {
  bodyType?: 'fullbody' | 'halfbody';
  morphTargets?: string; // e.g., 'ARKit', 'Oculus Visemes'
  textureAtlas?: '256' | '512' | '1024';
  lod?: '0' | '1' | '2'; // Level of detail
  pose?: 'A' | 'T'; // A-pose or T-pose
}

export interface RPMAvatarResult {
  avatarUrl: string;      // URL to .glb model
  avatarId: string;       // Unique avatar ID
  imageUrl: string;       // 2D render URL
  createdAt: string;
}

/**
 * Get the iframe URL for the avatar creator
 */
export function getAvatarCreatorUrl(config?: {
  clearCache?: boolean;
  quickStart?: boolean;
  bodyType?: 'fullbody' | 'halfbody';
}): string {
  const params = new URLSearchParams();

  // Frame API parameters
  params.set('frameApi', 'true');

  // Quick start skips the intro
  if (config?.quickStart) {
    params.set('quickStart', 'true');
  }

  // Clear cache forces fresh avatar creation
  if (config?.clearCache) {
    params.set('clearCache', 'true');
  }

  // Body type
  if (config?.bodyType) {
    params.set('bodyType', config.bodyType);
  }

  // Use demo subdomain if no custom one set
  const subdomain = RPM_SUBDOMAIN === 'delta' ? 'demo' : RPM_SUBDOMAIN;

  return `https://${subdomain}.readyplayer.me/avatar?${params.toString()}`;
}

/**
 * Parse avatar URL from Ready Player Me response
 */
export function parseAvatarUrl(url: string): RPMAvatarResult {
  // URL format: https://models.readyplayer.me/{avatarId}.glb
  const match = url.match(/models\.readyplayer\.me\/([a-f0-9-]+)\.glb/i);
  const avatarId = match ? match[1] : url;

  return {
    avatarUrl: url,
    avatarId,
    imageUrl: url.replace('.glb', '.png'),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Enhance avatar URL with render parameters
 */
export function getEnhancedAvatarUrl(
  baseUrl: string,
  config?: RPMAvatarConfig
): string {
  const url = new URL(baseUrl);

  // Add morph targets for facial expressions
  if (config?.morphTargets) {
    url.searchParams.set('morphTargets', config.morphTargets);
  }

  // Texture atlas size (affects quality/size tradeoff)
  if (config?.textureAtlas) {
    url.searchParams.set('textureAtlas', config.textureAtlas);
  }

  // Level of detail
  if (config?.lod) {
    url.searchParams.set('lod', config.lod);
  }

  // Pose
  if (config?.pose) {
    url.searchParams.set('pose', config.pose);
  }

  return url.toString();
}

/**
 * Get 2D render URL for avatar preview
 */
export function getAvatarRenderUrl(
  avatarId: string,
  options?: {
    scene?: 'fullbody-portrait-v1' | 'halfbody-portrait-v1';
    blendShapes?: Record<string, number>;
  }
): string {
  const baseUrl = `https://models.readyplayer.me/${avatarId}.png`;
  const url = new URL(baseUrl);

  if (options?.scene) {
    url.searchParams.set('scene', options.scene);
  }

  return url.toString();
}

/**
 * Message types from Ready Player Me iframe
 */
export type RPMEventType =
  | 'v1.frame.ready'
  | 'v1.avatar.exported'
  | 'v1.user.set'
  | 'v1.user.logout';

export interface RPMMessage {
  source: 'readyplayerme';
  eventName: RPMEventType;
  data?: {
    url?: string;
    id?: string;
    userId?: string;
  };
}

/**
 * Parse message from Ready Player Me WebView
 */
export function parseRPMMessage(message: string): RPMMessage | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed.source === 'readyplayerme') {
      return parsed as RPMMessage;
    }
  } catch {
    // Not a JSON message or not from RPM
  }
  return null;
}
