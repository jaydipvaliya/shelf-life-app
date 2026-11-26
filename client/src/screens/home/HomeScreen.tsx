import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Plus, AlertTriangle, ShoppingBag, ShoppingCart } from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { ItemCard } from '../../components/items/ItemCard';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { Avatar } from '../../components/ui/Avatar';
import { AddItemModal } from '../../components/items/AddItemModal';
import { RestockModal } from '../../components/restock/RestockModal';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import {
  CreateItemPayload,
  FoodItem,
  FoodLocation,
  itemsApi,
} from '../../api/items';
import { analyticsApi } from '../../api/analytics';
import { useRestockItems } from '../../api/restock';
import { calculateDaysRemaining } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface HomeScreenProps {
  onSelectItem: (item: FoodItem) => void;
  onOpenSettings: () => void;
  onOpenRecipes?: () => void;
}

const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectItem,
  onOpenSettings,
}) => {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const user = useAuthStore((state) => state.user);
  const currency = useAuthStore((state) => state.currency);
  const queryClient = useQueryClient();

  const [selectedLocation, setSelectedLocation] = useState<FoodLocation | 'all'>('all');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [restockVisible, setRestockVisible] = useState(false);

  const { data: restockItems = [] } = useRestockItems();
  const pendingRestockCount = restockItems.filter((r) => !r.isChecked).length;

  const {
    data: items = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['items', selectedLocation],
    queryFn: () => itemsApi.getItems({ location: selectedLocation }),
  });

  const { data: summary } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.getSummary(),
  });

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateItemPayload) => itemsApi.createItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['items-expiring-soon'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-plan'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setAddModalVisible(false);
    },
  });

  const expiringSoonCount = useMemo(() => {
    if (summary?.expiringSoonCount !== undefined && selectedLocation === 'all') {
      return summary.expiringSoonCount;
    }
    return items.filter((i) => calculateDaysRemaining(i.expiryDate) <= 3).length;
  }, [items, summary?.expiringSoonCount, selectedLocation]);

  const atRiskValue = useMemo(() => {
    if (summary?.atRiskValue !== undefined && selectedLocation === 'all') {
      return summary.atRiskValue;
    }
    return Math.round(
      items
        .filter((i) => calculateDaysRemaining(i.expiryDate) <= 7)
        .reduce(
          (sum, i) =>
            sum + (typeof i.price === 'number' && i.price >= 0 ? i.price : 4.5),
          0
        )
    );
  }, [items, summary?.atRiskValue, selectedLocation]);

  const firstName = user?.name?.trim().split(' ')[0] || 'Chef';

  const locationTabs: Array<{ id: FoodLocation | 'all'; label: string }> = [
    { id: 'all', label: 'All items' },
    { id: 'fridge', label: 'Fridge' },
    { id: 'freezer', label: 'Freezer' },
    { id: 'pantry', label: 'Pantry' },
  ];

  const sectionTitle =
    selectedLocation === 'all'
      ? expiringSoonCount > 0
        ? 'Expiring soon'
        : 'Kitchen items'
      : selectedLocation.charAt(0).toUpperCase() + selectedLocation.slice(1);

  return (
    <Screen withSafeArea>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 110,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
              void queryClient.invalidateQueries({ queryKey: ['analytics'] });
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Top Greeting & Avatar Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.fontSize.sm,
                fontWeight: '500',
              }}
            >
              {getTimeGreeting()}, {firstName}
            </Text>
            <Text
              style={[
                styles.heroTitle,
                { color: colors.text, fontSize: 28 },
              ]}
            >
              Your Kitchen
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setRestockVisible(true)}
              activeOpacity={0.8}
              style={[
                styles.cartBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  ...shadows.subtle,
                },
              ]}
              accessibilityLabel="Open restock grocery list"
            >
              <ShoppingCart size={18} color={colors.primary} />
              {pendingRestockCount > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: colors.urgent }]}>
                  <Text style={styles.cartBadgeText}>
                    {pendingRestockCount > 9 ? '9+' : pendingRestockCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOpenSettings}
              activeOpacity={0.8}
              accessibilityLabel="Open account and settings"
            >
              <Avatar name={user?.name || 'User'} imageUrl={user?.avatar} size={40} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Two KPI Summary Cards */}
        <View style={styles.kpiRow}>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.xl,
                ...shadows.subtle,
              },
            ]}
          >
            <Text style={[styles.kpiValue, { color: colors.urgent }]}>
              {expiringSoonCount}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              Expiring soon
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.xl,
                ...shadows.subtle,
              },
            ]}
          >
            <Text style={[styles.kpiValue, { color: colors.text }]}>
              {formatCurrency(atRiskValue, currency, 0)}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              At risk this week
            </Text>
          </View>
        </View>

        {/* Location Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {locationTabs.map((tab) => {
            const isSelected = selectedLocation === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedLocation(tab.id)}
                activeOpacity={0.8}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.textInverse : colors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                    fontSize: 13,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, fontSize: typography.fontSize.md },
            ]}
          >
            {sectionTitle}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.fontSize.xs,
              fontWeight: '500',
            }}
          >
            {items.length} item{items.length === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Unified White Item List Card */}
        {isLoading ? (
          <View>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : isError ? (
          <View
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
            <AlertTriangle size={30} color={colors.urgent} />
            <Text
              style={{
                color: colors.text,
                fontWeight: '700',
                fontSize: typography.fontSize.md,
                marginTop: 12,
              }}
            >
              Unable to load kitchen items
            </Text>
            <TouchableOpacity
              onPress={() => void refetch()}
              style={[
                styles.emptyBtn,
                { backgroundColor: colors.primary, borderRadius: radius.md },
              ]}
            >
              <Text style={{ color: colors.textInverse, fontWeight: '700', fontSize: 13 }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View
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
              <ShoppingBag size={30} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontWeight: '700',
                fontSize: typography.fontSize.lg,
                textAlign: 'center',
              }}
            >
              Your {selectedLocation === 'all' ? 'kitchen' : selectedLocation} is empty
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
              Scan a barcode, snap a photo, or add groceries manually to track freshness.
            </Text>
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={[
                styles.emptyBtn,
                { backgroundColor: colors.primary, borderRadius: radius.md },
              ]}
            >
              <Plus size={16} color={colors.textInverse} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.textInverse, fontWeight: '700', fontSize: 13 }}>
                Add First Item
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.listCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.xl,
                ...shadows.subtle,
              },
            ]}
          >
            {items.map((item, idx) => (
              <ItemCard
                key={item._id}
                item={item}
                variant="row"
                showBottomDivider={idx < items.length - 1}
                onPress={() => onSelectItem(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Rounded Square Deep Forest Green FAB */}
      <TouchableOpacity
        onPress={() => setAddModalVisible(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            ...shadows.modal,
          },
        ]}
        activeOpacity={0.85}
        accessibilityLabel="Add food item"
      >
        <Plus size={26} color={colors.textInverse} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Add Item Full Modal with Scan | Photo | Manual | Haul */}
      <AddItemModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSubmit={async (payload) => {
          await createItemMutation.mutateAsync(payload);
        }}
        loading={createItemMutation.isPending}
      />

      {/* Smart Restock & Grocery List Modal */}
      <RestockModal
        visible={restockVisible}
        onClose={() => setRestockVisible(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  heroTitle: {
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 18,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  listCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
