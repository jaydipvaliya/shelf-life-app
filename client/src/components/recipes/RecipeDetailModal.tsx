import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import {
  Clock,
  Users,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Utensils,
  Circle,
  ShoppingCart,
} from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useTheme } from '../../theme/theme';
import { RecipeSuggestion, useRecipeDetails } from '../../api/recipes';
import { itemsApi } from '../../api/items';
import { restockApi } from '../../api/restock';
import { useQueryClient } from '@tanstack/react-query';

interface RecipeDetailModalProps {
  recipe: RecipeSuggestion | null;
  visible: boolean;
  onClose: () => void;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  visible,
  onClose,
}) => {
  const { colors, spacing, radius, typography } = useTheme();
  const queryClient = useQueryClient();
  const [imageFailed, setImageFailed] = useState(false);
  const [markingUsed, setMarkingUsed] = useState(false);
  const [addingMissing, setAddingMissing] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [recipe?.id]);

  const needsRemoteDetails = Boolean(
    recipe &&
      (!recipe.instructions || recipe.instructions.length === 0)
  );

  const { data: fetchedDetails, isLoading: loadingDetails } = useRecipeDetails(
    recipe?.id ?? null,
    Boolean(visible && needsRemoteDetails)
  );

  if (!recipe) return null;

  const instructions =
    recipe.instructions && recipe.instructions.length > 0
      ? recipe.instructions
      : fetchedDetails?.instructions || [];

  const ingredientsList =
    recipe.ingredientsList && recipe.ingredientsList.length > 0
      ? recipe.ingredientsList
      : fetchedDetails?.ingredientsList || [];

  const readyInMinutes = recipe.readyInMinutes || fetchedDetails?.readyInMinutes;
  const servings = recipe.servings || fetchedDetails?.servings;
  const expiringMatched = recipe.expiringMatchedIngredients || [];
  const matchedIds = recipe.matchedItemIds || [];

  const handleMarkIngredientsUsed = async () => {
    if (matchedIds.length === 0) return;

    setMarkingUsed(true);
    try {
      await Promise.all(
        matchedIds.map((id) => itemsApi.updateItem(id, { status: 'consumed' }))
      );

      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['items-expiring-soon'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-plan'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });

      Alert.alert(
        'Meal Logged',
        `Marked ${matchedIds.length} kitchen item${matchedIds.length > 1 ? 's' : ''} as used!`
      );
      onClose();
    } catch {
      Alert.alert('Update Failed', 'Could not update your kitchen items right now.');
    } finally {
      setMarkingUsed(false);
    }
  };

  const handleOpenSource = async () => {
    if (!recipe.sourceUrl) return;
    try {
      await Linking.openURL(recipe.sourceUrl);
    } catch {
      Alert.alert('Unable to open recipe link', recipe.sourceUrl);
    }
  };

  const handleAddMissingToRestock = async () => {
    const missing = recipe.missedIngredients || [];
    if (missing.length === 0) return;
    setAddingMissing(true);
    try {
      await Promise.all(
        missing.map((ing) =>
          restockApi.addItem({
            name: ing,
            source: 'recipe',
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['restock'] });
      Alert.alert(
        'Added to Restock List',
        `Added ${missing.length} missing ingredient${missing.length > 1 ? 's' : ''} to your grocery list.`
      );
    } catch {
      Alert.alert('Error', 'Could not add missing ingredients right now.');
    } finally {
      setAddingMissing(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={recipe.title}
      subtitle={
        expiringMatched.length > 0
          ? `Rescues ${expiringMatched.length} expiring item${expiringMatched.length > 1 ? 's' : ''}`
          : `Uses ${recipe.usedCount} item${recipe.usedCount === 1 ? '' : 's'} from your kitchen`
      }
    >
      {/* Hero Banner */}
      <View
        style={[
          styles.heroBox,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.borderSubtle,
            borderRadius: radius.lg,
          },
        ]}
      >
        {recipe.image && !imageFailed ? (
          <Image
            source={{ uri: recipe.image }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.heroFallback}>
            <View
              style={[
                styles.heroIconCircle,
                { backgroundColor: colors.primary + '1F' },
              ]}
            >
              <Utensils size={36} color={colors.primary} />
            </View>
          </View>
        )}
      </View>

      {/* Meta Badges */}
      <View style={styles.metaRow}>
        {readyInMinutes ? (
          <View
            style={[
              styles.metaPill,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Clock size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
              {readyInMinutes} mins
            </Text>
          </View>
        ) : null}

        {servings ? (
          <View
            style={[
              styles.metaPill,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Users size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
              {servings} serving{servings > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        <Badge
          label={`Uses ${recipe.usedCount} in kitchen`}
          backgroundColor={colors.safeBg}
          color={colors.safeText}
          borderColor={colors.safeBorder}
          size="sm"
        />
      </View>

      {/* Expiring Items Rescued Highlight */}
      {expiringMatched.length > 0 && (
        <View
          style={[
            styles.rescueBox,
            {
              backgroundColor: colors.warningBg,
              borderColor: colors.warningBorder,
              borderRadius: radius.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Sparkles size={15} color={colors.warning} style={{ marginRight: 6 }} />
            <Text
              style={{
                color: colors.warningText,
                fontWeight: '700',
                fontSize: typography.fontSize.sm,
              }}
            >
              Expiring Items You Will Rescue
            </Text>
          </View>
          <Text
            style={{
              color: colors.warningText,
              fontSize: typography.fontSize.xs,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            {expiringMatched.join(' • ')}
          </Text>
        </View>
      )}

      {/* From Your Kitchen */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, fontSize: typography.fontSize.md },
          ]}
        >
          From Your Kitchen
        </Text>
        <View style={styles.chipWrap}>
          {recipe.usedIngredients.map((ing, idx) => (
            <View
              key={`used-${idx}`}
              style={[
                styles.ingChip,
                {
                  backgroundColor: colors.safeBg,
                  borderColor: colors.safeBorder,
                },
              ]}
            >
              <CheckCircle2 size={13} color={colors.safe} style={{ marginRight: 5 }} />
              <Text style={{ color: colors.safeText, fontSize: 12, fontWeight: '600' }}>
                {ing}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Full Ingredients or Missing */}
      {ingredientsList.length > 0 ? (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, fontSize: typography.fontSize.md },
            ]}
          >
            Ingredients Needed
          </Text>
          {ingredientsList.map((line, idx) => (
            <View key={`ing-${idx}`} style={styles.listItemRow}>
              <Circle size={6} color={colors.primary} fill={colors.primary} style={{ marginTop: 6, marginRight: 10 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1, lineHeight: 20 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      ) : recipe.missedIngredients.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.missingHeaderRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text, fontSize: typography.fontSize.md, marginBottom: 0 },
              ]}
            >
              Additional Ingredients
            </Text>
            <TouchableOpacity
              onPress={handleAddMissingToRestock}
              disabled={addingMissing}
              style={[
                styles.addMissingChip,
                { backgroundColor: colors.safeBg, borderColor: colors.safeBorder },
              ]}
            >
              <ShoppingCart size={12} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                {addingMissing ? 'Adding...' : '+ Add All to Restock'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.chipWrap, { marginTop: 10 }]}>
            {recipe.missedIngredients.map((ing, idx) => (
              <TouchableOpacity
                key={`miss-${idx}`}
                onPress={async () => {
                  try {
                    await restockApi.addItem({ name: ing, source: 'recipe' });
                    queryClient.invalidateQueries({ queryKey: ['restock'] });
                    Alert.alert('Added', `"${ing}" added to your Restock List.`);
                  } catch {
                    // Ignore
                  }
                }}
                style={[
                  styles.ingChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
                  + {ing}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {/* Step-by-Step Cooking Instructions */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, fontSize: typography.fontSize.md },
          ]}
        >
          How to Make It
        </Text>

        {loadingDetails ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10 }}>
              Loading cooking steps...
            </Text>
          </View>
        ) : instructions.length > 0 ? (
          instructions.map((step, idx) => (
            <View
              key={`step-${idx}`}
              style={[
                styles.stepRow,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radius.md,
                  padding: spacing.md,
                },
              ]}
            >
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.textInverse, fontSize: 12, fontWeight: '700' }}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>
                {step}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {recipe.sourceUrl
              ? 'Full instructions are available on the original recipe page below.'
              : 'Combine the ingredients above, season to taste, and cook until warm and tender.'}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        {matchedIds.length > 0 && (
          <Button
            title={`Cooked This — Mark ${matchedIds.length} Item${matchedIds.length > 1 ? 's' : ''} Used`}
            variant="primary"
            size="lg"
            loading={markingUsed}
            icon={<CheckCircle2 size={18} color={colors.textInverse} />}
            onPress={handleMarkIngredientsUsed}
            fullWidth
          />
        )}

        {recipe.sourceUrl ? (
          <TouchableOpacity
            onPress={handleOpenSource}
            style={[
              styles.sourceLinkBtn,
              {
                borderColor: colors.border,
                borderRadius: radius.md,
                marginTop: matchedIds.length > 0 ? spacing.sm : 0,
              },
            ]}
          >
            <ExternalLink size={15} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
              Open Full Web Recipe
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  heroBox: {
    height: 160,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    borderWidth: 1,
  },
  rescueBox: {
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginBottom: 18,
  },
  missingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addMissingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 99,
    borderWidth: 1,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 99,
    borderWidth: 1,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  actionsSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  sourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
});
