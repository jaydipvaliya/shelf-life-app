import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Clock, Utensils, ChevronRight } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { useTheme } from '../../theme/theme';
import { RecipeSuggestion } from '../../api/recipes';

interface RecipeCardProps {
  recipe: RecipeSuggestion;
  onPress?: (recipe: RecipeSuggestion) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  const { colors, spacing, radius, typography } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);

  const handlePress = async () => {
    if (onPress) {
      onPress(recipe);
      return;
    }

    if (!recipe.sourceUrl) return;
    try {
      await Linking.openURL(recipe.sourceUrl);
    } catch {
      Alert.alert('Unable to open recipe link', recipe.sourceUrl);
    }
  };

  const usedCount = recipe.usedCount || recipe.usedIngredients?.length || 0;
  const expiringCount = recipe.expiringMatchCount || 0;

  return (
    <Card
      onPress={handlePress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radius.lg,
          marginRight: spacing.md,
        },
      ]}
    >
      {/* Recipe Image with Fallback */}
      <View
        style={[
          styles.imageContainer,
          { backgroundColor: colors.surfaceSubtle },
        ]}
      >
        {recipe.image && !imageFailed ? (
          <Image
            source={{ uri: recipe.image }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: colors.primary + '12' }]}>
            <Utensils size={28} color={colors.primary} />
          </View>
        )}

        {/* Uses X / Rescues Expiring Badge */}
        <View style={styles.badgeOverlay}>
          <Badge
            label={
              expiringCount > 0
                ? `Rescues ${expiringCount} expiring`
                : `Uses ${usedCount} item${usedCount === 1 ? '' : 's'}`
            }
            backgroundColor={expiringCount > 0 ? colors.warning : colors.safe}
            color="#FFFFFF"
            size="sm"
          />
        </View>
      </View>

      {/* Title & Ingredients content */}
      <View style={[styles.content, { padding: spacing.md }]}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: typography.fontSize.sm,
              },
            ]}
            numberOfLines={2}
          >
            {recipe.title}
          </Text>
          <ChevronRight size={15} color={colors.textMuted} style={styles.linkIcon} />
        </View>

        {recipe.readyInMinutes ? (
          <View style={styles.timeRow}>
            <Clock size={11} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
              {recipe.readyInMinutes} mins
            </Text>
          </View>
        ) : null}

        {/* Used Ingredients Chips */}
        {recipe.usedIngredients && recipe.usedIngredients.length > 0 && (
          <View style={styles.ingredientChipsRow}>
            {recipe.usedIngredients.slice(0, 3).map((ing, idx) => (
              <View
                key={`${ing}-${idx}`}
                style={[
                  styles.ingredientChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ingredientChipText,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {ing}
                </Text>
              </View>
            ))}
            {recipe.usedIngredients.length > 3 && (
              <Text style={[styles.moreText, { color: colors.textMuted }]}>
                +{recipe.usedIngredients.length - 3} more
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};

export const RecipeCardSkeleton: React.FC = () => {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        styles.skeletonCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radius.lg,
          marginRight: spacing.md,
        },
      ]}
    >
      <Skeleton width="100%" height={120} borderRadius={0} />
      <View style={{ padding: spacing.md }}>
        <Skeleton width="85%" height={16} borderRadius={4} />
        <Skeleton
          width="50%"
          height={14}
          borderRadius={4}
          style={{ marginTop: 8 }}
        />
        <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
          <Skeleton width={60} height={18} borderRadius={99} />
          <Skeleton width={60} height={18} borderRadius={99} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 224,
    borderWidth: 1,
    overflow: 'hidden',
  },
  skeletonCard: {
    borderWidth: 1,
  },
  imageContainer: {
    width: '100%',
    height: 116,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  linkIcon: {
    marginLeft: 4,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ingredientChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    alignItems: 'center',
  },
  ingredientChip: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 100,
  },
  ingredientChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moreText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
});
