import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  Search as SearchIcon,
  X,
  RotateCcw,
  ChevronDown,
  Check,
  ShoppingCart,
} from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Header } from '../../components/layout/Header';
import { Input } from '../../components/ui/Input';
import { ItemCard } from '../../components/items/ItemCard';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { RestockModal } from '../../components/restock/RestockModal';
import { CategoryIcon, LocationIcon } from '../../components/ui/FoodIcon';
import { useTheme } from '../../theme/theme';
import {
  FoodCategory,
  FoodItem,
  FoodLocation,
  ItemStatus,
  itemsApi,
} from '../../api/items';
import { restockApi, useRestockItems } from '../../api/restock';
import { CATEGORIES, CATEGORY_LIST, LOCATIONS } from '../../utils/categories';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SearchScreenProps {
  onSelectItem: (item: FoodItem) => void;
}

type ActiveDropdown = 'status' | 'location' | 'category' | null;

const STATUS_OPTIONS: Array<{ id: ItemStatus | 'all'; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'consumed', label: 'Used' },
  { id: 'discarded', label: 'Tossed' },
  { id: 'all', label: 'All Status' },
];

export const SearchScreen: React.FC<SearchScreenProps> = ({ onSelectItem }) => {
  const { colors, spacing, radius } = useTheme();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<FoodLocation | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | 'all'>('active');
  const [openDropdown, setOpenDropdown] = useState<ActiveDropdown>(null);
  const [restockVisible, setRestockVisible] = useState(false);
  const [restockPromptItem, setRestockPromptItem] = useState<{
    item: FoodItem;
    action: 'consumed' | 'discarded';
  } | null>(null);

  const { data: restockItems = [] } = useRestockItems();
  const pendingRestockCount = restockItems.filter((r) => !r.isChecked).length;

  // Debounce search query 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const hasActiveFilters =
    Boolean(debouncedQuery) ||
    selectedCategory !== 'all' ||
    selectedLocation !== 'all' ||
    selectedStatus !== 'active';

  const resetFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedStatus('active');
  };

  const {
    data: items = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      'search-items',
      debouncedQuery,
      selectedCategory,
      selectedLocation,
      selectedStatus,
    ],
    queryFn: () =>
      itemsApi.getItems({
        search: debouncedQuery,
        category: selectedCategory,
        location: selectedLocation,
        status: selectedStatus,
      }),
  });

  const consumeMutation = useMutation({
    mutationFn: (item: FoodItem) =>
      itemsApi.updateItem(item._id, { status: 'consumed' }),
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-plan'] });
      setRestockPromptItem({ item, action: 'consumed' });
    },
  });

  const discardMutation = useMutation({
    mutationFn: (item: FoodItem) =>
      itemsApi.updateItem(item._id, { status: 'discarded' }),
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['search-items'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-plan'] });
      setRestockPromptItem({ item, action: 'discarded' });
    },
  });

  useEffect(() => {
    if (!restockPromptItem) return;
    const timer = setTimeout(() => setRestockPromptItem(null), 5000);
    return () => clearTimeout(timer);
  }, [restockPromptItem]);

  const handleQuickRestock = async () => {
    if (!restockPromptItem) return;
    const { item, action } = restockPromptItem;
    setRestockPromptItem(null);
    try {
      await restockApi.addItem({
        name: item.name,
        category: item.category,
        location: item.location,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price ?? null,
        source: action,
        householdId: item.householdId?._id || null,
      });
      queryClient.invalidateQueries({ queryKey: ['restock'] });
    } catch {
      // Ignore transient error
    }
  };

  const statusLabel =
    STATUS_OPTIONS.find((s) => s.id === selectedStatus)?.label || 'Active';
  const locationLabel =
    selectedLocation === 'all'
      ? 'Location'
      : LOCATIONS.find((l) => l.id === selectedLocation)?.name || 'Location';
  const categoryLabel =
    selectedCategory === 'all'
      ? 'Category'
      : CATEGORIES[selectedCategory]?.name || 'Category';

  const statusActive = selectedStatus !== 'active';
  const locationActive = selectedLocation !== 'all';
  const categoryActive = selectedCategory !== 'all';

  return (
    <Screen withSafeArea>
      <Header
        title="Kitchen Inventory"
        subtitle="Search, filter & manage all items"
        rightAction={
          <TouchableOpacity
            onPress={() => setRestockVisible(true)}
            style={[
              styles.cartBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
            accessibilityLabel="Open restock list"
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
        }
      />

      {/* Search Input Bar */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Input
          placeholder="Search by food name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={{ marginBottom: 10 }}
          leftIcon={<SearchIcon size={18} color={colors.textMuted} />}
          rightIcon={
            searchQuery ? <X size={16} color={colors.textMuted} /> : undefined
          }
          onRightIconPress={() => setSearchQuery('')}
        />
      </View>

      {/* Compact Single-Row Filter Dropdowns */}
      <View
        style={[
          styles.dropdownRow,
          { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
        ]}
      >
        {/* Status Dropdown Trigger */}
        <TouchableOpacity
          onPress={() => setOpenDropdown('status')}
          activeOpacity={0.75}
          style={[
            styles.dropdownBtn,
            {
              backgroundColor: statusActive ? colors.primary : colors.surface,
              borderColor: statusActive ? colors.primary : colors.borderSubtle,
              borderRadius: radius.md,
            },
          ]}
        >
          <Text
            style={[
              styles.dropdownText,
              { color: statusActive ? colors.textInverse : colors.text },
            ]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
          <ChevronDown
            size={14}
            color={statusActive ? colors.textInverse : colors.textMuted}
          />
        </TouchableOpacity>

        {/* Location Dropdown Trigger */}
        <TouchableOpacity
          onPress={() => setOpenDropdown('location')}
          activeOpacity={0.75}
          style={[
            styles.dropdownBtn,
            {
              backgroundColor: locationActive ? colors.primary : colors.surface,
              borderColor: locationActive ? colors.primary : colors.borderSubtle,
              borderRadius: radius.md,
            },
          ]}
        >
          <Text
            style={[
              styles.dropdownText,
              { color: locationActive ? colors.textInverse : colors.text },
            ]}
            numberOfLines={1}
          >
            {locationLabel}
          </Text>
          <ChevronDown
            size={14}
            color={locationActive ? colors.textInverse : colors.textMuted}
          />
        </TouchableOpacity>

        {/* Category Dropdown Trigger */}
        <TouchableOpacity
          onPress={() => setOpenDropdown('category')}
          activeOpacity={0.75}
          style={[
            styles.dropdownBtn,
            {
              backgroundColor: categoryActive ? colors.primary : colors.surface,
              borderColor: categoryActive ? colors.primary : colors.borderSubtle,
              borderRadius: radius.md,
            },
          ]}
        >
          <Text
            style={[
              styles.dropdownText,
              { color: categoryActive ? colors.textInverse : colors.text },
            ]}
            numberOfLines={1}
          >
            {categoryLabel}
          </Text>
          <ChevronDown
            size={14}
            color={categoryActive ? colors.textInverse : colors.textMuted}
          />
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity
            onPress={resetFilters}
            style={[
              styles.resetIconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radius.md,
              },
            ]}
            accessibilityLabel="Reset filters"
          >
            <RotateCcw size={15} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: spacing.lg, paddingBottom: 80 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => onSelectItem(item)}
            showActions={item.status === 'active'}
            onConsume={(it) => consumeMutation.mutate(it)}
            onDiscard={(it) => discardMutation.mutate(it)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <View style={styles.emptyResults}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: colors.surfaceSubtle },
                ]}
              >
                <SearchIcon size={26} color={colors.textMuted} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                No matching items
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: 'center',
                  marginTop: 6,
                }}
              >
                {debouncedQuery
                  ? `No items found matching "${debouncedQuery}"`
                  : 'No items match the selected filters'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity
                  onPress={resetFilters}
                  style={[
                    styles.resetBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <RotateCcw size={14} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                    Reset Filters
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {/* Floating Restock Prompt Toast */}
      {restockPromptItem && (
        <View
          style={[
            styles.restockToast,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
            },
          ]}
        >
          <Text
            style={{ color: colors.textInverse, fontSize: 13, fontWeight: '600', flex: 1 }}
            numberOfLines={1}
          >
            Marked {restockPromptItem.item.name} {restockPromptItem.action === 'consumed' ? 'used' : 'tossed'}
          </Text>
          <TouchableOpacity
            onPress={() => void handleQuickRestock()}
            style={styles.toastActionBtn}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
              + Restock
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <RestockModal
        visible={restockVisible}
        onClose={() => setRestockVisible(false)}
      />

      {/* Dropdown Picker Sheet */}
      <BottomSheet
        visible={openDropdown !== null}
        onClose={() => setOpenDropdown(null)}
        title={
          openDropdown === 'status'
            ? 'Filter by Status'
            : openDropdown === 'location'
            ? 'Filter by Location'
            : 'Filter by Category'
        }
        maxHeightRatio={0.65}
      >
        {openDropdown === 'status' &&
          STATUS_OPTIONS.map((st) => {
            const isSelected = selectedStatus === st.id;
            return (
              <TouchableOpacity
                key={st.id}
                onPress={() => {
                  setSelectedStatus(st.id);
                  setOpenDropdown(null);
                }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: isSelected ? colors.safeBg : 'transparent',
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.safeText : colors.text,
                    fontSize: 15,
                    fontWeight: isSelected ? '700' : '500',
                    flex: 1,
                  }}
                >
                  {st.label}
                </Text>
                {isSelected && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}

        {openDropdown === 'location' && (
          <>
            <TouchableOpacity
              onPress={() => {
                setSelectedLocation('all');
                setOpenDropdown(null);
              }}
              style={[
                styles.optionRow,
                {
                  backgroundColor:
                    selectedLocation === 'all' ? colors.safeBg : 'transparent',
                  borderRadius: radius.md,
                },
              ]}
            >
              <View style={{ marginRight: 12 }}>
                <LocationIcon location="all" size={18} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: selectedLocation === 'all' ? colors.safeText : colors.text,
                  fontSize: 15,
                  fontWeight: selectedLocation === 'all' ? '700' : '500',
                  flex: 1,
                }}
              >
                All Locations
              </Text>
              {selectedLocation === 'all' && <Check size={18} color={colors.primary} />}
            </TouchableOpacity>

            {LOCATIONS.map((loc) => {
              const isSelected = selectedLocation === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  onPress={() => {
                    setSelectedLocation(loc.id);
                    setOpenDropdown(null);
                  }}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: isSelected ? colors.safeBg : 'transparent',
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <View style={{ marginRight: 12 }}>
                    <LocationIcon location={loc.id} size={18} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: isSelected ? colors.safeText : colors.text,
                      fontSize: 15,
                      fontWeight: isSelected ? '700' : '500',
                      flex: 1,
                    }}
                  >
                    {loc.name}
                  </Text>
                  {isSelected && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {openDropdown === 'category' && (
          <>
            <TouchableOpacity
              onPress={() => {
                setSelectedCategory('all');
                setOpenDropdown(null);
              }}
              style={[
                styles.optionRow,
                {
                  backgroundColor:
                    selectedCategory === 'all' ? colors.safeBg : 'transparent',
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={{
                  color: selectedCategory === 'all' ? colors.safeText : colors.text,
                  fontSize: 15,
                  fontWeight: selectedCategory === 'all' ? '700' : '500',
                  flex: 1,
                }}
              >
                All Categories
              </Text>
              {selectedCategory === 'all' && <Check size={18} color={colors.primary} />}
            </TouchableOpacity>

            {CATEGORY_LIST.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setOpenDropdown(null);
                  }}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: isSelected ? colors.safeBg : 'transparent',
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <View style={{ marginRight: 12 }}>
                    <CategoryIcon category={cat.id} size={18} color={cat.color} />
                  </View>
                  <Text
                    style={{
                      color: isSelected ? colors.safeText : colors.text,
                      fontSize: 15,
                      fontWeight: isSelected ? '700' : '500',
                      flex: 1,
                    }}
                  >
                    {cat.name}
                  </Text>
                  {isSelected && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
    flex: 1,
  },
  resetIconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  listContent: {
    paddingTop: 4,
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginTop: 16,
  },
  cartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
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
  restockToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    elevation: 6,
  },
  toastActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
});
