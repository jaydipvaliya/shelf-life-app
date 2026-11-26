import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import {
  ChefHat,
  Clock,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  Utensils,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { RecipeDetailModal } from '../../components/recipes/RecipeDetailModal';
import { useTheme } from '../../theme/theme';
import { RecipeSuggestion, useKitchenPlan } from '../../api/recipes';
import { calculateDaysRemaining } from '../../utils/date';

export const RecipesScreen: React.FC = () => {
  const { colors, spacing, radius, typography } = useTheme();

  const [scope, setScope] = useState<'all' | 'expiring'>('all');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<RecipeSuggestion | null>(null);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const {
    data: plan,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useKitchenPlan({
    days: 5,
    scope,
    ingredients: selectedIngredients,
  });

  const expiringItems = plan?.expiringItems || [];
  const kitchenItems = plan?.kitchenItems || [];
  const recipes = plan?.recipes || [];
  const quickTips = plan?.quickTips || [];

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  return (
    <Screen withSafeArea>
      <Header
        title="Kitchen Recipes"
        subtitle="Meal ideas to cook what you have"
      />

      {/* Scope Toggle Pills */}
      <View style={[styles.scopeRow, { paddingHorizontal: spacing.lg }]}>
        <TouchableOpacity
          onPress={() => setScope('all')}
          style={[
            styles.scopePill,
            {
              backgroundColor: scope === 'all' ? colors.primary : colors.surfaceSubtle,
              borderColor: scope === 'all' ? colors.primary : colors.border,
              borderRadius: radius.full,
            },
          ]}
        >
          <Utensils
            size={14}
            color={scope === 'all' ? colors.textInverse : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={{
              color: scope === 'all' ? colors.textInverse : colors.text,
              fontWeight: scope === 'all' ? '700' : '500',
              fontSize: 13,
            }}
          >
            All Kitchen ({kitchenItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setScope('expiring')}
          style={[
            styles.scopePill,
            {
              backgroundColor: scope === 'expiring' ? colors.primary : colors.surfaceSubtle,
              borderColor: scope === 'expiring' ? colors.primary : colors.border,
              borderRadius: radius.full,
            },
          ]}
        >
          <Sparkles
            size={14}
            color={scope === 'expiring' ? colors.textInverse : colors.warning}
            style={{ marginRight: 6 }}
          />
          <Text
            style={{
              color: scope === 'expiring' ? colors.textInverse : colors.text,
              fontWeight: scope === 'expiring' ? '700' : '500',
              fontSize: 13,
            }}
          >
            Rescue Expiring ({expiringItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 90,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Interactive Ingredient Picker */}
        {kitchenItems.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.7,
                }}
              >
                PICK INGREDIENTS IN YOUR KITCHEN
              </Text>
              {selectedIngredients.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedIngredients([])}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                    Clear ({selectedIngredients.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 8 }}
            >
              {kitchenItems.map((item) => {
                const isSelected = selectedIngredients.includes(item.name);
                const days = calculateDaysRemaining(item.expiryDate);
                const isUrgent = days <= 5;

                return (
                  <TouchableOpacity
                    key={item._id}
                    onPress={() => toggleIngredient(item.name)}
                    style={[
                      styles.ingFilterChip,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : isUrgent
                          ? colors.warningBg
                          : colors.surfaceSubtle,
                        borderColor: isSelected
                          ? colors.primary
                          : isUrgent
                          ? colors.warningBorder
                          : colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    {isUrgent && !isSelected && (
                      <View
                        style={[
                          styles.urgentDot,
                          { backgroundColor: days <= 2 ? colors.urgent : colors.warning },
                        ]}
                      />
                    )}
                    <Text
                      style={{
                        color: isSelected
                          ? colors.textInverse
                          : isUrgent
                          ? colors.warningText
                          : colors.text,
                        fontSize: 12,
                        fontWeight: isSelected || isUrgent ? '700' : '500',
                      }}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Quick Food-Saving Tips for Expiring Items */}
        {quickTips.length > 0 && (
          <Card
            style={[
              styles.tipsCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <View style={styles.tipsHeader}>
              <Lightbulb size={16} color={colors.warning} style={{ marginRight: 6 }} />
              <Text
                style={{
                  color: colors.text,
                  fontWeight: '700',
                  fontSize: typography.fontSize.sm,
                }}
              >
                Smart Ways to Save Expiring Food
              </Text>
            </View>

            {quickTips.slice(0, 3).map((tip) => (
              <View
                key={tip.itemId}
                style={[styles.tipRow, { borderTopColor: colors.borderSubtle }]}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '700',
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  {tip.itemName}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
                  {tip.tip}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Recipes Section */}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.7,
            marginBottom: 10,
          }}
        >
          RECOMMENDED RECIPES ({recipes.length})
        </Text>

        {isLoading ? (
          <View>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : isError ? (
          <Card
            style={[
              styles.emptyCard,
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
              Unable to load recipes
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
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
        ) : recipes.length === 0 ? (
          <Card
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.xl,
                padding: spacing.xxl,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.surfaceSubtle },
              ]}
            >
              <ChefHat size={34} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontWeight: '700',
                fontSize: typography.fontSize.lg,
                textAlign: 'center',
              }}
            >
              {kitchenItems.length === 0
                ? 'Your kitchen is empty'
                : 'No matching recipes found'}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.fontSize.sm,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 20,
              }}
            >
              {kitchenItems.length === 0
                ? 'Add items to your inventory to get personalized meal suggestions and step-by-step recipes.'
                : 'Try switching to "All Kitchen" or clearing selected ingredient filters.'}
            </Text>
          </Card>
        ) : (
          recipes.map((recipe) => {
            const expiringCount = recipe.expiringMatchCount || 0;
            return (
              <Card
                key={recipe.id}
                onPress={() => setActiveRecipe(recipe)}
                style={[
                  styles.recipeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radius.lg,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <View style={styles.recipeRow}>
                  <View
                    style={[
                      styles.thumbBox,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    {recipe.image && !failedImages[recipe.id] ? (
                      <Image
                        source={{ uri: recipe.image }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [recipe.id]: true }))
                        }
                      />
                    ) : (
                      <Utensils size={24} color={colors.primary} />
                    )}
                  </View>

                  <View style={styles.recipeInfo}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        fontSize: typography.fontSize.md,
                      }}
                      numberOfLines={2}
                    >
                      {recipe.title}
                    </Text>

                    <View style={styles.recipeMetaRow}>
                      {expiringCount > 0 ? (
                        <Badge
                          label={`Rescues ${expiringCount} expiring`}
                          backgroundColor={colors.warningBg}
                          color={colors.warningText}
                          borderColor={colors.warningBorder}
                          size="sm"
                        />
                      ) : (
                        <Badge
                          label={`Uses ${recipe.usedCount} item${recipe.usedCount === 1 ? '' : 's'}`}
                          backgroundColor={colors.safeBg}
                          color={colors.safeText}
                          borderColor={colors.safeBorder}
                          size="sm"
                        />
                      )}

                      {recipe.readyInMinutes ? (
                        <View style={styles.timeBadge}>
                          <Clock size={12} color={colors.textMuted} style={{ marginRight: 3 }} />
                          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                            {recipe.readyInMinutes}m
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {recipe.usedIngredients.length > 0 && (
                      <View style={styles.matchedLine}>
                        <CheckCircle2 size={12} color={colors.safe} style={{ marginRight: 4 }} />
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}
                          numberOfLines={1}
                        >
                          {recipe.usedIngredients.join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <RecipeDetailModal
        recipe={activeRecipe}
        visible={Boolean(activeRecipe)}
        onClose={() => setActiveRecipe(null)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ingFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  urgentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tipsCard: {
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  recipeCard: {
    borderWidth: 1,
    padding: 12,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbBox: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
});
