/**
 * DailyInsightsScreen — Landing tab (Tab 1: Today).
 *
 * Cold start: greeting + time + weather + suggested actions.
 * With data: backend-driven modules from /modules endpoint.
 * Zero hardcoded module building — Delta controls layout, priority, tone.
 */

import React, { useState, useEffect, useMemo, useCallback, Component, ErrorInfo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import { useInsightsData } from '../hooks/useInsightsData';
import { dashboardInsightApi, DeltaModule } from '../services/api';
import { getToneColor } from '../utils/themeUtils';
import { getWeather, WeatherData, formatWeatherForContext } from '../services/weather';
import { DeltaLogoSimple } from '../components/DeltaLogo';
import { useDeltaUI } from '../context/DeltaUIContext';
import { useUnits } from '../context/UnitsContext';
import { logDeltaDecision, logModulePriority, logUIContext, getSessionDecisions, logError } from '../services/deltaDecisionLog';
import { validateDeltaIntent } from '../utils/deltaValidator';
import ModuleRenderer, { CompactModuleRow } from '../components/ModuleRenderer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Error boundary for individual module cards.
 */
interface ModuleErrorBoundaryProps {
  moduleId: string;
  onError: (moduleId: string, error: string) => void;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
}

class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModuleErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    const msg = error.message || String(error);
    logError(this.props.moduleId, msg);
    this.props.onError(this.props.moduleId, msg);
  }

  render(): React.ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface DailyInsightsScreenProps {
  theme: Theme;
  onOpenChat?: (prefill?: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTimeOfDayIcon(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'moon-outline';
  if (hour < 12) return 'sunny-outline';
  if (hour < 17) return 'partly-sunny-outline';
  return 'moon-outline';
}

// getToneColor imported from utils/themeUtils

export default function DailyInsightsScreen({ theme, onOpenChat }: DailyInsightsScreenProps): React.ReactNode {
  const { user } = useAuth();
  const { profile } = useAccess();
  const { unitSystem } = useUnits();
  const insets = useSafeAreaInsets();
  const {
    todaySummary,
    healthState,
    deltaCommentary,
    modules,
    modulesLoading,
    weeklySummaries,
    analyticsLoading,
    fetchAnalyticsData,
  } = useInsightsData();

  const deltaUI = useDeltaUI();

  const [refreshing, setRefreshing] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [llmLoading, setLlmLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  // Shimmer animation
  const shimmerOpacity = useSharedValue(1);
  useEffect(() => {
    shimmerOpacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
  }, [shimmerOpacity]);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmerOpacity.value }));

  // Register active tab
  useEffect(() => {
    deltaUI.setActiveTab('Today');
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
    getWeather().then(w => w && setWeatherData(w)).catch(() => {});
  }, [fetchAnalyticsData]);

  // LLM loading state: resolved when modules arrive or commentary arrives
  useEffect(() => {
    if (modules.length > 0 || deltaCommentary?.headline) {
      setLlmLoading(false);
    }
  }, [modules, deltaCommentary]);

  // Fallback: if no modules and no commentary after data loads, try generateInsight
  useEffect(() => {
    if (!analyticsLoading && !modulesLoading && modules.length === 0 && !deltaCommentary?.headline && user?.id) {
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `delta-greeting-${user.id}-${today}`;

      AsyncStorage.getItem(cacheKey).then(cached => {
        if (cached) {
          setFallbackMessage(cached);
          setLlmLoading(false);
          return;
        }

        const timeout = setTimeout(() => setLlmLoading(false), 8000);
        const weatherCtx = weatherData ? formatWeatherForContext(weatherData) : undefined;
        dashboardInsightApi.generateInsight(user.id, weatherCtx, unitSystem)
          .then(res => {
            clearTimeout(timeout);
            setFallbackMessage(res.message);
            setLlmLoading(false);
            AsyncStorage.setItem(cacheKey, res.message).catch(() => {});
            logDeltaDecision({
              timestamp: new Date().toISOString(),
              source: 'generateInsight',
              decision: res.message,
              reasoning: `context: ${res.context_used.join(', ')}`,
              raw: res,
            });
          })
          .catch(() => {
            clearTimeout(timeout);
            setLlmLoading(false);
          });
      }).catch(() => setLlmLoading(false));
    }
  }, [analyticsLoading, modulesLoading, modules, deltaCommentary, user?.id, weatherData, unitSystem]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLlmLoading(true);
    await fetchAnalyticsData(true);
    setRefreshing(false);
  };

  const userName = profile?.name ?? user?.name ?? '';
  const firstName = userName.split(' ')[0] || '';
  const greeting = getGreeting();
  const hasData = todaySummary != null || (healthState?.has_data === true);

  // Split modules by layout
  const heroModule = modules.find(m => m.type === 'commentary');
  const compactModules = modules.filter(m => m.layout === 'compact');
  const remainingModules = modules
    .filter(m => m.id !== heroModule?.id && m.layout !== 'compact')
    .sort((a, b) => b.priority - a.priority);

  if (__DEV__) {
    console.log(`[DailyInsights] modules=${modules.length} hero=${heroModule?.id ?? 'none'} compact=${compactModules.length} remaining=${remainingModules.length} modulesLoading=${modulesLoading}`);
  }

  // Register visible modules and log priorities — use stringified IDs to avoid infinite loops
  const moduleIds = useMemo(() => modules.map(m => m.id), [modules]);
  const moduleIdsKey = moduleIds.join(',');
  useEffect(() => {
    if (moduleIds.length > 0) {
      deltaUI.registerVisibleModules(moduleIds);
      logModulePriority(modules.map(m => ({ id: m.id, priority: m.priority })));
      logUIContext({
        tab: deltaUI.activeTab,
        shown: deltaUI.shownGreetings,
        dismissed: deltaUI.dismissedModules,
      });
    }
  }, [moduleIdsKey]);

  // Record commentary as shown — only once per brief text
  const heroBrief = heroModule?.brief;
  useEffect(() => {
    if (heroBrief) {
      deltaUI.recordShownGreeting(heroBrief);
    }
  }, [heroBrief]);

  // Validate Delta intent vs rendered state (dev only)
  const visibleChartsKey = deltaUI.visibleCharts.join(',');
  useEffect(() => {
    if (!__DEV__) return;
    const decisions = getSessionDecisions();
    if (decisions.length === 0) return;
    validateDeltaIntent(decisions, moduleIds, deltaUI.visibleCharts);
  }, [moduleIdsKey, visibleChartsKey]);

  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);
  const chartWidth = SCREEN_WIDTH - 64;

  const handleModulePress = (mod: DeltaModule) => {
    deltaUI.recordModuleTap(mod.id);
    if (mod.chat_prefill) {
      deltaUI.recordChatOpenedFrom(mod.id);
      onOpenChat?.(mod.chat_prefill);
    }
  };

  // Hero card content — from backend module or fallback
  const heroHeadline = heroModule?.brief || deltaCommentary?.headline || fallbackMessage;
  const heroBody = heroModule?.detail || deltaCommentary?.body;
  const heroTone = heroModule?.tone || deltaCommentary?.tone || 'neutral';
  const heroToneColor = getToneColor(heroTone, theme);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
        }
      >
        {/* Greeting */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.greetingSection}>
          <Ionicons name={getTimeOfDayIcon() as any} size={20} color={theme.textSecondary} />
          <Text style={styles.greeting}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
        </Animated.View>

        {/* Weather */}
        {weatherData && (
          <Animated.View entering={FadeIn.delay(200).duration(300)}>
            <Text style={styles.weather}>
              {Math.round(weatherData.temperature)}° · {weatherData.description}
            </Text>
          </Animated.View>
        )}

        {/* Hero Card — Commentary from Delta */}
        {llmLoading && modules.length === 0 ? (
          <Animated.View style={[styles.heroCard, { borderColor: theme.accent + '15' }]}>
            <Animated.View style={[styles.shimmerBlock, shimmerStyle, { backgroundColor: theme.surface }]} />
            <Animated.View style={[styles.shimmerBlockSmall, shimmerStyle, { backgroundColor: theme.surface }]} />
          </Animated.View>
        ) : heroHeadline ? (
          <Animated.View
            entering={FadeInDown.delay(250).duration(400)}
            style={[styles.heroCard, { backgroundColor: heroToneColor + '08', borderColor: heroToneColor + '15' }]}
          >
            <View style={styles.heroHeader}>
              <Ionicons name="sparkles" size={16} color={heroToneColor} />
              <Text style={[styles.heroLabel, { color: heroToneColor }]}>Delta</Text>
            </View>
            <Text style={styles.heroHeadline}>{heroHeadline}</Text>
            {heroBody && <Text style={styles.heroBody}>{heroBody}</Text>}
          </Animated.View>
        ) : null}

        {/* Cold start */}
        {!hasData && !analyticsLoading && modules.length === 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.coldStart}>
            <DeltaLogoSimple size={32} color={theme.accent} />
            <Text style={styles.coldStartTitle}>Welcome to Delta</Text>
            <Text style={styles.coldStartBody}>
              Start by telling me about your day — what you ate, how you slept, or any workouts.
            </Text>

            <View style={styles.promptCards}>
              {[
                { text: 'I had oatmeal for breakfast', icon: 'restaurant-outline' },
                { text: 'I went for a 30 min run', icon: 'walk-outline' },
                { text: 'How should I eat today?', icon: 'help-circle-outline' },
              ].map((prompt, i) => (
                <Animated.View key={i} entering={FadeInDown.delay(i * 100 + 400).duration(400)}>
                  <Pressable
                    style={({ pressed }) => [styles.promptCard, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => onOpenChat?.(prompt.text)}
                  >
                    <Ionicons name={prompt.icon as any} size={16} color={theme.accent} />
                    <Text style={styles.promptText}>{prompt.text}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Compact modules — horizontal scroll row */}
        {compactModules.length > 0 && (
          <CompactModuleRow modules={compactModules} theme={theme} onPress={handleModulePress} />
        )}

        {/* Remaining modules — rendered via ModuleRenderer */}
        {remainingModules.map((mod, i) => (
          <ModuleErrorBoundary key={mod.id} moduleId={mod.id} onError={deltaUI.recordRenderError}>
            <ModuleRenderer
              module={mod}
              weeklySummaries={weeklySummaries}
              theme={theme}
              onPress={handleModulePress}
              index={i}
              chartWidth={chartWidth}
            />
          </ModuleErrorBoundary>
        ))}

        {/* Shimmer placeholders while modules load */}
        {modulesLoading && modules.length === 0 && hasData && (
          <>
            {[0, 1, 2].map(i => (
              <Animated.View key={i} style={[styles.shimmerCard, shimmerStyle, { backgroundColor: theme.surface }]} />
            ))}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: topInset + 16,
    },
    greetingSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    greeting: {
      fontSize: 24,
      fontWeight: '300',
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    weather: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 24,
      marginLeft: 28,
    },
    // Hero card
    heroCard: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    heroHeadline: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      lineHeight: 22,
      marginBottom: 4,
    },
    heroBody: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.textSecondary,
      lineHeight: 20,
    },
    // Shimmer placeholders
    shimmerBlock: {
      height: 18,
      borderRadius: 6,
      width: '80%',
      marginBottom: 8,
    },
    shimmerBlockSmall: {
      height: 14,
      borderRadius: 6,
      width: '60%',
    },
    shimmerCard: {
      height: 80,
      borderRadius: 12,
      marginBottom: 8,
    },
    // Cold start
    coldStart: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 12,
    },
    coldStartTitle: {
      fontSize: 20,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    coldStartBody: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    promptCards: {
      width: '100%',
      gap: 8,
      marginTop: 16,
    },
    promptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    promptText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
  });
}
