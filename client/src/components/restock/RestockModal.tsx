import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Check,
  Plus,
  Trash2,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { CategoryIcon } from '../ui/FoodIcon';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { CATEGORIES } from '../../utils/categories';
import { RestockItem, restockApi, useRestockItems } from '../../api/restock';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface RestockModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({ visible, onClose }) => {
  const { colors, spacing, radius } = useTheme();
  const currency = useAuthStore((state) => state.currency);
  const queryClient = useQueryClient();

  const [newItemName, setNewItemName] = useState('');
  const { data: items = [], isLoading } = useRestockItems();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['restock'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['search-items'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['recipe-suggestions'] });
    queryClient.invalidateQueries({ queryKey: ['kitchen-plan'] });
  };

  const addMutation = useMutation({
    mutationFn: (name: string) =>
      restockApi.addItem({ name, source: 'manual' }),
    onSuccess: () => {
      setNewItemName('');
      queryClient.invalidateQueries({ queryKey: ['restock'] });
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Could not add item to restock list'
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      restockApi.toggleChecked(id, isChecked),
    onMutate: async ({ id, isChecked }) => {
      await queryClient.cancelQueries({ queryKey: ['restock'] });
      const prev = queryClient.getQueryData<RestockItem[]>(['restock']);
      queryClient.setQueryData<RestockItem[]>(['restock'], (old = []) =>
        old.map((it) => (it._id === id ? { ...it, isChecked } : it))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['restock'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['restock'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restockApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock'] });
    },
  });

  const stockBoughtMutation = useMutation({
    mutationFn: () => restockApi.stockBought(),
    onSuccess: (res) => {
      invalidateAll();
      Alert.alert(
        'Kitchen Restocked',
        `Moved ${res.count} bought item${res.count === 1 ? '' : 's'} into Your Kitchen with smart expiry dates!`
      );
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Could not move bought items to kitchen'
      );
    },
  });

  const handleAdd = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  };

  const toBuy = items.filter((i) => !i.isChecked);
  const bought = items.filter((i) => i.isChecked);

  const renderRow = (item: RestockItem) => {
    const catInfo = CATEGORIES[item.category] || CATEGORIES.other;
    const sourceTag =
      item.source === 'recipe'
        ? 'From recipe'
        : item.source === 'consumed' || item.source === 'discarded'
        ? 'Restock'
        : null;

    return (
      <View
        key={item._id}
        style={[
          styles.row,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.borderSubtle,
            borderRadius: radius.md,
            opacity: item.isChecked ? 0.65 : 1,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            toggleMutation.mutate({ id: item._id, isChecked: !item.isChecked })
          }
          style={[
            styles.checkbox,
            {
              backgroundColor: item.isChecked ? colors.primary : colors.surface,
              borderColor: item.isChecked ? colors.primary : colors.border,
            },
          ]}
        >
          {item.isChecked && <Check size={13} color={colors.textInverse} />}
        </TouchableOpacity>

        <View
          style={[
            styles.catBadge,
            { backgroundColor: catInfo.color + '18', borderRadius: radius.sm },
          ]}
        >
          <CategoryIcon category={item.category} size={15} color={catInfo.color} />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 14,
              fontWeight: '600',
              textDecorationLine: item.isChecked ? 'line-through' : 'none',
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
            {item.quantity} {item.unit}
            {item.price ? ` · ${formatCurrency(item.price, currency)}` : ''}
            {sourceTag ? ` · ${sourceTag}` : ''}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => deleteMutation.mutate(item._id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Restock & Grocery List"
      subtitle="Check off items as you shop, then stock Your Kitchen in 1 tap"
    >
      {/* Quick Add Input Row */}
      <View style={styles.addRow}>
        <TextInput
          placeholder="Add item to buy (e.g. Whole Milk)..."
          placeholderTextColor={colors.textMuted}
          value={newItemName}
          onChangeText={setNewItemName}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          style={[
            styles.addInput,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              color: colors.text,
              borderRadius: radius.md,
            },
          ]}
        />
        <TouchableOpacity
          onPress={handleAdd}
          disabled={addMutation.isPending || !newItemName.trim()}
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              opacity: !newItemName.trim() ? 0.5 : 1,
            },
          ]}
        >
          {addMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Plus size={20} color={colors.textInverse} />
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <ShoppingCart size={28} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            Your grocery list is empty
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 19,
            }}
          >
            Add items above, restock after finishing food, or add missing recipe ingredients.
          </Text>
        </View>
      ) : (
        <>
          {toBuy.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
                TO BUY ({toBuy.length})
              </Text>
              {toBuy.map(renderRow)}
            </View>
          )}

          {bought.length > 0 && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
                BOUGHT ({bought.length})
              </Text>
              {bought.map(renderRow)}
            </View>
          )}

          {bought.length > 0 && (
            <Button
              title={`Move ${bought.length} Bought Item${bought.length > 1 ? 's' : ''} to Kitchen`}
              variant="primary"
              size="lg"
              loading={stockBoughtMutation.isPending}
              icon={<ArrowRight size={18} color={colors.textInverse} />}
              iconPosition="right"
              onPress={() => stockBoughtMutation.mutate()}
              fullWidth
            />
          )}
        </>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  addBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  catBadge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
