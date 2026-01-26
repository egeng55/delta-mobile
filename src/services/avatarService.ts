/**
 * Avatar Service - Storage and management for user avatars
 *
 * Stores avatar configuration locally and optionally syncs to cloud.
 * No images or body data are stored - only abstract parameters.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import {
  UserAvatar,
  DEFAULT_AVATAR,
  AVATAR_TEMPLATES,
  AvatarInsight,
  InsightCategory,
  CATEGORY_TO_REGION,
} from '../types/avatar';

const AVATAR_STORAGE_KEY = '@delta_user_avatar';

class AvatarService {
  private cachedAvatar: UserAvatar | null = null;

  /**
   * Get user's avatar configuration
   */
  async getAvatar(userId: string): Promise<UserAvatar> {
    // Return cached if available
    if (this.cachedAvatar) {
      return this.cachedAvatar;
    }

    try {
      // Try local storage first
      const localData = await AsyncStorage.getItem(`${AVATAR_STORAGE_KEY}_${userId}`);
      if (localData) {
        this.cachedAvatar = JSON.parse(localData);
        return this.cachedAvatar!;
      }

      // Try cloud storage
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_config')
        .eq('id', userId)
        .single();

      if (profile?.avatar_config) {
        this.cachedAvatar = profile.avatar_config as UserAvatar;
        // Cache locally
        await AsyncStorage.setItem(
          `${AVATAR_STORAGE_KEY}_${userId}`,
          JSON.stringify(this.cachedAvatar)
        );
        return this.cachedAvatar;
      }
    } catch (error) {
      console.log('Error loading avatar:', error);
    }

    // Return default
    return DEFAULT_AVATAR;
  }

  /**
   * Save user's avatar configuration
   */
  async saveAvatar(userId: string, avatar: UserAvatar): Promise<void> {
    const updatedAvatar: UserAvatar = {
      ...avatar,
      updatedAt: new Date().toISOString(),
    };

    // Update cache
    this.cachedAvatar = updatedAvatar;

    // Save locally
    await AsyncStorage.setItem(
      `${AVATAR_STORAGE_KEY}_${userId}`,
      JSON.stringify(updatedAvatar)
    );

    // Sync to cloud (non-blocking)
    this.syncToCloud(userId, updatedAvatar).catch(console.log);
  }

  /**
   * Sync avatar config to Supabase
   */
  private async syncToCloud(userId: string, avatar: UserAvatar): Promise<void> {
    try {
      await supabase
        .from('profiles')
        .update({ avatar_config: avatar })
        .eq('id', userId);
    } catch (error) {
      console.log('Avatar cloud sync failed:', error);
    }
  }

  /**
   * Delete user's avatar (reset to default)
   */
  async deleteAvatar(userId: string): Promise<void> {
    this.cachedAvatar = null;

    await AsyncStorage.removeItem(`${AVATAR_STORAGE_KEY}_${userId}`);

    try {
      await supabase
        .from('profiles')
        .update({ avatar_config: null })
        .eq('id', userId);
    } catch (error) {
      console.log('Avatar deletion sync failed:', error);
    }
  }

  /**
   * Check if user has customized their avatar
   */
  async hasCustomAvatar(userId: string): Promise<boolean> {
    const avatar = await this.getAvatar(userId);
    return avatar.templateId !== DEFAULT_AVATAR.templateId ||
           avatar.skinTone !== DEFAULT_AVATAR.skinTone ||
           avatar.style !== DEFAULT_AVATAR.style;
  }

  /**
   * Get available templates
   */
  getTemplates() {
    return AVATAR_TEMPLATES;
  }

  /**
   * Convert dashboard/derivative insights to avatar insights
   * This maps existing Delta insights to avatar display format
   */
  mapInsightsToAvatar(
    dashboardInsights: Array<{
      id?: string;
      text: string;
      type?: string;
      category?: string;
      sentiment?: string;
    }>
  ): AvatarInsight[] {
    return dashboardInsights.map((insight, index) => {
      // Determine category from insight type or content
      const category = this.inferCategory(insight);
      const sentiment = this.inferSentiment(insight);
      const shortLabel = this.generateShortLabel(insight, sentiment);

      return {
        id: insight.id ?? `insight_${index}`,
        text: insight.text,
        shortLabel,
        category,
        sentiment,
        icon: this.getIconForCategory(category),
        region: CATEGORY_TO_REGION[category],
      };
    });
  }

  /**
   * Infer insight category from content
   */
  private inferCategory(insight: { text: string; type?: string; category?: string }): InsightCategory {
    const text = insight.text.toLowerCase();
    const type = insight.type?.toLowerCase() ?? '';
    const category = insight.category?.toLowerCase() ?? '';

    // Check explicit category first
    if (category in CATEGORY_TO_REGION) {
      return category as InsightCategory;
    }

    // Infer from type
    if (type.includes('meal') || type.includes('nutrition') || type.includes('food')) {
      return 'nutrition';
    }
    if (type.includes('sleep') || type.includes('rest')) {
      return 'sleep';
    }
    if (type.includes('workout') || type.includes('exercise')) {
      if (text.includes('leg') || text.includes('run') || text.includes('walk') || text.includes('squat')) {
        return 'lower_body';
      }
      if (text.includes('arm') || text.includes('chest') || text.includes('push') || text.includes('pull')) {
        return 'upper_body';
      }
      return 'cardio';
    }

    // Infer from text content
    if (text.includes('protein') || text.includes('calorie') || text.includes('carb') || text.includes('fat')) {
      return 'protein';
    }
    if (text.includes('sleep') || text.includes('rest') || text.includes('tired')) {
      return 'sleep';
    }
    if (text.includes('water') || text.includes('hydrat')) {
      return 'hydration';
    }
    if (text.includes('step') || text.includes('walk')) {
      return 'steps';
    }
    if (text.includes('mood') || text.includes('feel') || text.includes('energy')) {
      return 'mood';
    }
    if (text.includes('heart') || text.includes('cardio')) {
      return 'cardio';
    }

    return 'wellness';
  }

  /**
   * Infer sentiment from insight
   */
  private inferSentiment(insight: { text: string; sentiment?: string }): 'positive' | 'neutral' | 'attention' {
    if (insight.sentiment) {
      if (insight.sentiment === 'positive' || insight.sentiment === 'good') return 'positive';
      if (insight.sentiment === 'attention' || insight.sentiment === 'warning') return 'attention';
      return 'neutral';
    }

    const text = insight.text.toLowerCase();

    // Positive indicators
    if (
      text.includes('great') ||
      text.includes('excellent') ||
      text.includes('good') ||
      text.includes('on track') ||
      text.includes('achieved') ||
      text.includes('consistent') ||
      text.includes('improved')
    ) {
      return 'positive';
    }

    // Attention indicators
    if (
      text.includes('low') ||
      text.includes('below') ||
      text.includes('missed') ||
      text.includes('lacking') ||
      text.includes('consider') ||
      text.includes('attention')
    ) {
      return 'attention';
    }

    return 'neutral';
  }

  /**
   * Generate short label for tag display
   */
  private generateShortLabel(
    insight: { text: string },
    sentiment: 'positive' | 'neutral' | 'attention'
  ): string {
    const text = insight.text.toLowerCase();

    // Extract key metric if present
    const proteinMatch = text.match(/(\d+)g?\s*protein/);
    if (proteinMatch) return `${proteinMatch[1]}g protein`;

    const calorieMatch = text.match(/(\d+)\s*cal/);
    if (calorieMatch) return `${calorieMatch[1]} cal`;

    const sleepMatch = text.match(/(\d+\.?\d*)\s*h(?:ours?)?\s*(?:of\s*)?sleep/);
    if (sleepMatch) return `${sleepMatch[1]}h sleep`;

    const waterMatch = text.match(/(\d+)\s*(?:oz|glasses)/);
    if (waterMatch) return `${waterMatch[1]}oz water`;

    // Generate based on sentiment
    if (sentiment === 'positive') {
      if (text.includes('protein')) return 'On track';
      if (text.includes('sleep')) return 'Well rested';
      if (text.includes('workout')) return 'Active';
      if (text.includes('water')) return 'Hydrated';
      return 'Good';
    }

    if (sentiment === 'attention') {
      if (text.includes('protein')) return 'Low protein';
      if (text.includes('sleep')) return 'Rest needed';
      if (text.includes('water')) return 'Drink more';
      return 'Check in';
    }

    // Neutral - extract first meaningful words
    const words = insight.text.split(' ').slice(0, 3);
    return words.join(' ').substring(0, 15);
  }

  /**
   * Get icon for category
   */
  private getIconForCategory(category: InsightCategory): string {
    const icons: Record<InsightCategory, string> = {
      nutrition: 'nutrition',
      meals: 'restaurant',
      protein: 'fish',
      calories: 'flame',
      sleep: 'moon',
      rest: 'bed',
      cardio: 'heart',
      heart_rate: 'pulse',
      upper_body: 'barbell',
      lower_body: 'walk',
      steps: 'footsteps',
      running: 'walk',
      hydration: 'water',
      energy: 'flash',
      mood: 'happy',
      wellness: 'leaf',
    };
    return icons[category] ?? 'information-circle';
  }

  /**
   * Clear cache (call on logout)
   */
  clearCache(): void {
    this.cachedAvatar = null;
  }
}

export const avatarService = new AvatarService();
export default avatarService;
