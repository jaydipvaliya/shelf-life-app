import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Calendar,
  MapPin,
  Tag,
  CheckCircle,
  Trash2,
  Edit,
  Clock,
  Share2,
  Barcode,
  DollarSign,
} from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Header } from '../../components/layout/Header';
import { ExpiryBadge } from '../../components/items/ExpiryBadge';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { ItemForm } from '../../components/items/ItemForm';
import { CategoryIcon } from '../../components/ui/FoodIcon';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { FoodItem, itemsApi, CreateItemPayload } from '../../api/items';
import { restockApi } from '../../api/restock';
import { CATEGORIES } from '../../utils/categories';
import {
  formatDateDisplay,
  formatRelativeExpiry,
  calculateDaysRemaining,
  getUrgencyColorStyles,
} from '../../utils/date';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ItemDetailScreenProps {
  item: FoodItem;
  onBack: () => void;
}

export const ItemDetailScreen: React.FC<ItemDetailScreenProps> = ({
  item: initialItem,
  onBack,
}) => {
  const { colors, spacing, radius, typography } = useTheme();
  const currency = useAuthStore((state) => state.currency);
  const queryClient = useQueryClient();
  const [item, setItem] = useState<FoodItem>(initialItem);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState<'consumed' | 'discarded' | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const categoryInfo = CATEGORIES[item.category] || CATEGORIES.other;
  const days = calculateDaysRemaining(item.expiryDate);
  const urgencyStyles = getUrgencyColorStyles(item.urgency, colors);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateItemPayload>) =>
      itemsApi.updateItem(item._id, payload),
    onSuccess: (updatedItem) => {
      setItem(updatedItem);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err.response?.data?.message || 'Could not update item');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => itemsApi.deleteItem(item._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      onBack();
    },
    onError: (err: any) => {
      Alert.alert('Delete Failed', err.response?.data?.message || 'Could not delete item');
    },
  });

  const handleMarkStatus = async (status: 'consumed' | 'discarded') => {
    setStatusLoading(status);
    try {
      const updated = await itemsApi.updateItem(item._id, { status });
      setItem(updated);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['items-expiring-soon'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      Alert.alert(
        status === 'consumed' ? 'Great Job!' : 'Item Discarded',
        status === 'consumed'
          ? `Marked "${item.name}" as used. Want to add it to your Restock List?`
          : `Marked "${item.name}" as discarded. Want to add it to your Restock List?`,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Add to Restock',
            onPress: async () => {
              try {
                await restockApi.addItem({
                  name: item.name,
                  category: item.category,
                  location: item.location,
                  quantity: item.quantity,
                  unit: item.unit,
                  price: item.price ?? null,
                  source: status,
                  householdId: item.householdId?._id || null,
                });
                queryClient.invalidateQueries({ queryKey: ['restock'] });
              } catch {
                // Ignore transient error
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Could not update item status');
    } finally {
      setStatusLoading(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}" from your shelf?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  return (
    <Screen withSafeArea withBottomSafeArea>
      {/* Header with back & delete */}
      <Header
        title="Item Details"
        showBack
        onBack={onBack}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setIsEditModalOpen(true)}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                },
              ]}
            >
              <Edit size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: colors.urgentBg,
                  borderColor: colors.urgentBorder,
                },
              ]}
            >
              <Trash2 size={18} color={colors.urgent} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.lg, paddingBottom: 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Banner or Category Icon Banner */}
        <View
          style={[
            styles.bannerContainer,
            {
              backgroundColor: item.photoUrl && !imageFailed
                ? colors.surfaceSubtle
                : categoryInfo.color + '14',
              borderColor: colors.borderSubtle,
              borderRadius: radius.xl,
            },
          ]}
        >
          {item.photoUrl && !imageFailed ? (
            <Image
              source={{ uri: item.photoUrl }}
              style={styles.bannerImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.bannerEmojiBox}>
              <View
                style={[
                  styles.bannerIconCircle,
                  { backgroundColor: categoryInfo.color + '22' },
                ]}
              >
                <CategoryIcon category={item.category} size={56} color={categoryInfo.color} />
              </View>
            </View>
          )}

          {/* Floating Urgency Tag */}
          <View style={styles.floatingBadge}>
            <ExpiryBadge item={item} />
          </View>
        </View>

        {/* Item Title & Quantity */}
        <View style={styles.titleSection}>
          <Text
            style={[
              styles.itemName,
              {
                color: colors.text,
                fontSize: typography.fontSize.xxxl,
              },
            ]}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.itemSubtitle,
              {
                color: colors.textSecondary,
                fontSize: typography.fontSize.md,
                marginTop: 4,
              },
            ]}
          >
            {item.quantity} {item.unit} in {item.location}
          </Text>
        </View>

        {/* Prominent Expiry Countdown Card */}
        <View
          style={[
            styles.countdownCard,
            {
              backgroundColor: urgencyStyles.bg,
              borderColor: urgencyStyles.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
            },
          ]}
        >
          <View style={styles.countdownRow}>
            <Clock size={24} color={urgencyStyles.color} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: urgencyStyles.text,
                  fontWeight: '700',
                  fontSize: typography.fontSize.md,
                }}
              >
                {formatRelativeExpiry(days)}
              </Text>
              <Text
                style={{
                  color: urgencyStyles.text,
                  fontSize: typography.fontSize.xs,
                  marginTop: 2,
                }}
              >
                Best before {formatDateDisplay(item.expiryDate)}
              </Text>
            </View>
          </View>
        </View>

        {/* Details Grid */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginTop: spacing.md,
            },
          ]}
        >
          <View style={styles.detailRow}>
            <Tag size={16} color={colors.textMuted} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Category
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {categoryInfo.name}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.detailRow}>
            <MapPin size={16} color={colors.textMuted} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Location
            </Text>
            <Text
              style={[
                styles.detailValue,
                { color: colors.text, textTransform: 'capitalize' },
              ]}
            >
              {item.location}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.detailRow}>
            <Calendar size={16} color={colors.textMuted} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Expiry Date
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDateDisplay(item.expiryDate)}
            </Text>
          </View>

          {item.price !== undefined && item.price !== null ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.detailRow}>
                <DollarSign size={16} color={colors.textMuted} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Price
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatCurrency(item.price, currency, 2)}
                </Text>
              </View>
            </>
          ) : null}

          {item.barcode ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.detailRow}>
                <Barcode size={16} color={colors.textMuted} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Barcode
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {item.barcode}
                </Text>
              </View>
            </>
          ) : null}

          {item.householdId ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.detailRow}>
                <Share2 size={16} color={colors.primary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Pantry
                </Text>
                <Text style={[styles.detailValue, { color: colors.primary, fontWeight: '700' }]}>
                  {item.householdId.name}
                </Text>
              </View>
            </>
          ) : null}

          {item.notes ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
              <View style={{ marginTop: 8 }}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: colors.textSecondary, marginBottom: 4 },
                  ]}
                >
                  Notes
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                  {item.notes}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Action Buttons: Mark as Consumed / Discarded */}
        {item.status === 'active' ? (
          <View style={styles.statusActionButtonsRow}>
            <Button
              title="Mark as Used"
              variant="primary"
              size="lg"
              loading={statusLoading === 'consumed'}
              disabled={statusLoading !== null}
              icon={<CheckCircle size={18} color={colors.textInverse} />}
              onPress={() => handleMarkStatus('consumed')}
              style={{ flex: 1, marginRight: spacing.md }}
            />

            <Button
              title="Toss Out"
              variant="secondary"
              size="lg"
              loading={statusLoading === 'discarded'}
              disabled={statusLoading !== null}
              icon={<Trash2 size={18} color={colors.urgent} />}
              textStyle={{ color: colors.urgent }}
              onPress={() => handleMarkStatus('discarded')}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View
            style={[
              styles.completedStatusBanner,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                marginTop: spacing.xl,
              },
            ]}
          >
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: 'center',
                fontWeight: '600',
              }}
            >
              This item has been marked as{' '}
              <Text style={{ color: colors.primary, textTransform: 'capitalize' }}>
                {item.status}
              </Text>
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Item Modal */}
      <BottomSheet
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Item"
        subtitle={item.name}
      >
        <ItemForm
          initialItem={item}
          onSubmit={async (payload) => {
            await updateMutation.mutateAsync(payload);
          }}
          onCancel={() => setIsEditModalOpen(false)}
          loading={updateMutation.isPending}
        />
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 8,
  },
  bannerContainer: {
    height: 220,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerEmojiBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
  },
  titleSection: {
    marginTop: 18,
    marginBottom: 14,
  },
  itemName: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  itemSubtitle: {
    fontWeight: '500',
  },
  countdownCard: {
    borderWidth: 1,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsCard: {
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  statusActionButtonsRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  completedStatusBanner: {
    borderWidth: 1,
  },
});
