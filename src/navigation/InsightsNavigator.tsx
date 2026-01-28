/**
 * InsightsNavigator - Unified Delta Intelligence view
 *
 * Primary view: Delta Feed - intelligent insights, patterns, recommendations
 * Secondary views accessible via modals/sheets:
 * - Today details (progress rings, daily summary)
 * - Recovery details (sleep, HRV, recovery state)
 * - History (calendar, trends)
 *
 * The 4-tab design was removed - Delta IS the insights experience.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
} from 'react-native';
import { Theme } from '../theme/colors';

// Import screens
import DeltaFeedScreen from '../screens/DeltaFeedScreen';
import TodayScreen from '../screens/TodayScreen';
import RecoveryScreen from '../screens/RecoveryScreen';
import HistoryScreen from '../screens/HistoryScreen';

type DetailView = 'today' | 'recovery' | 'history' | null;

interface InsightsNavigatorProps {
  theme: Theme;
}

export default function InsightsNavigator({ theme }: InsightsNavigatorProps): React.ReactElement {
  const [detailView, setDetailView] = useState<DetailView>(null);

  const openDetailView = useCallback((view: DetailView) => {
    setDetailView(view);
  }, []);

  const closeDetailView = useCallback(() => {
    setDetailView(null);
  }, []);

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Main Delta Feed - THE insights experience */}
      <DeltaFeedScreen
        theme={theme}
        isFocused={detailView === null}
        onOpenToday={() => openDetailView('today')}
        onOpenRecovery={() => openDetailView('recovery')}
        onOpenHistory={() => openDetailView('history')}
      />

      {/* Detail modals for drill-down views */}
      <Modal
        visible={detailView === 'today'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailView}
      >
        <TodayScreen
          theme={theme}
          isFocused={detailView === 'today'}
          onClose={closeDetailView}
          onNavigateToRecovery={() => setDetailView('recovery')}
          onNavigateToHistory={() => setDetailView('history')}
        />
      </Modal>

      <Modal
        visible={detailView === 'recovery'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailView}
      >
        <RecoveryScreen
          theme={theme}
          isFocused={detailView === 'recovery'}
          onClose={closeDetailView}
        />
      </Modal>

      <Modal
        visible={detailView === 'history'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailView}
      >
        <HistoryScreen
          theme={theme}
          isFocused={detailView === 'history'}
          onClose={closeDetailView}
        />
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
  });
}
