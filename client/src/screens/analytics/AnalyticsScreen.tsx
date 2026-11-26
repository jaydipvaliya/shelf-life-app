import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  TrendingUp,
  Leaf,
  Flame,
  AlertTriangle,
  Utensils,
} from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Card } from '../../components/ui/Card';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { RecipeDetailModal } from '../../components/recipes/RecipeDetailModal';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { analyticsApi } from '../../api/analytics';
import { RecipeSuggestion, useRecipeSuggestions } from '../../api/recipes';
import { useQuery } from '@tanstack/react-query';

export const AnalyticsScreen: React.FC = () => {
  const { colors, spacing, radius, shadows, isDark } = useTheme();
  const currency = useAuthStore((state) => state.currency);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const {
    data: summary,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.getSummary(),
  });

  const { data: recipes = [] } = useRecipeSuggestions(5, 'all');

  const currentMonthLabel = new Date().toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const weeklyBars = summary?.weeklySavings || [
    { label: 'W1', amount: 0, isCurrent: false },
    { label: 'W2', amount: 0, isCurrent: false },
    { label: 'W3', amount: 0, isCurrent: false },
    { label: 'W4', amount: 0, isCurrent: false },
    { label: 'W5', amount: 0, isCurrent: true },
  ];

  const maxWeeklyAmount = Math.max(...weeklyBars.map((b) => b.amount), 10);
  const moneySaved = Math.round(summary?.estimatedMoneySaved || 0);
  const foodSavedKg = summary?.foodSavedKg ?? 0;
  const streakDays = summary?.currentStreakDays ?? 0;
  const deltaPercent = summary?.monthlySavings?.deltaPercent ?? 0;
  const hasPrevMonth = (summary?.monthlySavings?.previousMonthSaved ?? 0) > 0;

  return (
    <Screen withSafeArea>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 90,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Your Impact</Text>
          <Text style={[styles.monthSubtitle, { color: colors.textSecondary }]}>
            {currentMonthLabel}
          </Text>
        </View>

        {isLoading ? (
          <View>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : isError ? (
          <Card
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.urgentBorder,
                borderRadius: radius.xl,
                padding: spacing.xxl,
              },
            ]}
          >
            <AlertTriangle size={32} color={colors.urgent} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 12 }}>
              Unable to load impact stats
            </Text>
            <TouchableOpacity
              onPress={() => void refetch()}
              style={[
                styles.retryBtn,
                { backgroundColor: colors.primary, borderRadius: radius.md },
              ]}
            >
              <Text style={{ color: colors.textInverse, fontWeight: '700', fontSize: 13 }}>
                Retry
              </Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {/* Deep Forest Green Hero Savings Card */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: isDark ? '#1B3B2B' : colors.primary,
                  borderRadius: radius.xl,
                  ...shadows.card,
                },
              ]}
            >
              <View style={styles.heroDecoCircle} />
              <Text style={styles.heroAmount}>
                {formatCurrency(moneySaved, currency, 0)} saved
              </Text>
              <Text style={styles.heroSubtext}>from food you didn't waste</Text>

              <View style={styles.deltaPill}>
                <TrendingUp size={13} color="#A8DFBC" style={{ marginRight: 5 }} />
                <Text style={styles.deltaText}>
                  {hasPrevMonth
                    ? `${deltaPercent >= 0 ? '+' : ''}${deltaPercent}% vs last month`
                    : `${summary?.savedRate ?? 100}% freshness score`}
                </Text>
              </View>
            </View>

            {/* Two Stat Cards Row */}
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radius.xl,
                    ...shadows.subtle,
                  },
                ]}
              >
                <View style={[styles.statIconBox, { backgroundColor: colors.safeBg }]}>
                  <Leaf size={18} color={colors.safe} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {foodSavedKg} kg
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Food saved
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radius.xl,
                    ...shadows.subtle,
                  },
                ]}
              >
                <View style={[styles.statIconBox, { backgroundColor: colors.warningBg }]}>
                  <Flame size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {streakDays} day{streakDays === 1 ? '' : 's'}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Current streak
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly Savings Bar Chart Card */}
            <View
              style={[
                styles.chartCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radius.xl,
                  ...shadows.subtle,
                },
              ]}
            >
              <Text style={[styles.chartTitle, { color: colors.text }]}>
                Weekly savings
              </Text>

              <View style={styles.barsRow}>
                {weeklyBars.map((bar) => {
                  const heightPct = Math.max(
                    18,
                    Math.round((bar.amount / maxWeeklyAmount) * 90)
                  );
                  return (
                    <View key={bar.label} style={styles.barColumn}>
                      {bar.isCurrent ? (
                        <Text style={[styles.barTopLabel, { color: colors.text }]}>
                          {formatCurrency(bar.amount, currency, 0)}
                        </Text>
                      ) : (
                        <Text style={styles.barTopSpacer}> </Text>
                      )}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: heightPct,
                              backgroundColor: bar.isCurrent
                                ? colors.primary
                                : isDark
                                ? '#2A3F32'
                                : '#D7E0D7',
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.barBottomLabel,
                          {
                            color: bar.isCurrent ? colors.text : colors.textSecondary,
                            fontWeight: bar.isCurrent ? '700' : '500',
                          },
                        ]}
                      >
                        {bar.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recipes for what's expiring */}
            {recipes.length > 0 && (
              <View style={styles.recipesSection}>
                <Text style={[styles.recipesHeading, { color: colors.text }]}>
                  Recipes for what's expiring
                </Text>

                {recipes.slice(0, 4).map((recipe, idx) => {
                  const tintBg =
                    idx % 2 === 0 ? colors.safeBg : colors.warningBg;
                  const tintColor =
                    idx % 2 === 0 ? colors.safe : colors.warning;
                  const usedCount =
                    recipe.expiringMatchCount && recipe.expiringMatchCount > 0
                      ? recipe.expiringMatchCount
                      : recipe.usedCount;
                  const subtitle = `${recipe.readyInMinutes || 15} min · uses ${usedCount} ${
                    recipe.expiringMatchCount && recipe.expiringMatchCount > 0
                      ? 'expiring'
                      : 'kitchen'
                  } item${usedCount === 1 ? '' : 's'}`;

                  return (
                    <TouchableOpacity
                      key={recipe.id}
                      onPress={() => setSelectedRecipe(recipe)}
                      activeOpacity={0.75}
                      style={[
                        styles.recipeRowCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.borderSubtle,
                          borderRadius: radius.lg,
                          ...shadows.subtle,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.recipeThumb,
                          { backgroundColor: tintBg, borderRadius: radius.md },
                        ]}
                      >
                        {recipe.image && !failedImages[recipe.id] ? (
                          <Image
                            source={{ uri: recipe.image }}
                            style={styles.recipeImg}
                            resizeMode="cover"
                            onError={() =>
                              setFailedImages((prev) => ({
                                ...prev,
                                [recipe.id]: true,
                              }))
                            }
                          />
                        ) : (
                          <Utensils size={20} color={tintColor} />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={[styles.recipeTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {recipe.title}
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <RecipeDetailModal
        recipe={selectedRecipe}
        visible={Boolean(selectedRecipe)}
        onClose={() => setSelectedRecipe(null)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  monthSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  errorCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  heroCard: {
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  heroDecoCircle: {
    position: 'absolute',
    right: -25,
    top: -15,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroSubtext: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 99,
    marginTop: 14,
  },
  deltaText: {
    color: '#E6F4EA',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  chartCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 135,
    paddingHorizontal: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTopLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  barTopSpacer: {
    fontSize: 11,
    marginBottom: 4,
  },
  barTrack: {
    width: '74%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  barBottomLabel: {
    fontSize: 11,
    marginTop: 8,
  },
  recipesSection: {
    marginBottom: 12,
  },
  recipesHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  recipeRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  recipeThumb: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recipeImg: {
    width: '100%',
    height: '100%',
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
});
