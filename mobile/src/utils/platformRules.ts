export const springConfigs = {
  ios: {
    tension: 65,
    friction: 8,
    speed: 12,
    bounciness: 4,
  },
  android: {
    tension: 85,
    friction: 6,
    speed: 16,
    bounciness: 7,
  },
  web: {
    tension: 65,
    friction: 8,
    speed: 12,
    bounciness: 4,
  },
};

/**
 * Returns tension and friction animation options safe for React Native Animated.spring.
 * Prevents throwing "You can define one of bounciness/speed, tension/friction... but not more than one".
 */
export function getPlatformSpring(platform: 'ios' | 'android' | 'web' = 'ios') {
  const cfg = springConfigs[platform] ?? springConfigs.ios;
  return {
    tension: cfg.tension,
    friction: cfg.friction,
  };
}

export function canUseGlassRule(options?: {
  platformOS?: string;
  osVersion?: number;
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
  reduceTransparency?: boolean;
}): boolean {
  if (options?.reduceTransparency) return false;
  if (options?.platformOverride) {
    return options.platformOverride === 'ios26';
  }
  const isIOS = options?.platformOS === 'ios';
  const major = options?.osVersion || 0;
  return isIOS && major >= 26;
}
