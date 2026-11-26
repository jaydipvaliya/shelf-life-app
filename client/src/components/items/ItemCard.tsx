import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Check, Trash2, MapPin, Users } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { CategoryIcon } from '../ui/FoodIcon';
import { ExpiryBadge } from './ExpiryBadge';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { FoodItem } from '../../api/items';
import { CATEGORIES } from '../../utils/categories';
import {
  getUrgencyColorStyles,
  getExpiryUrgency,
  calculateDaysRemaining,
  formatExpirySentence,
  formatShortDayPill,
} from '../../utils/date';

interface ItemCardProps {
  item: FoodItem;
  onPress: () => void;
  onConsume?: (item: FoodItem) => void;
  onDiscard?: (item: FoodItem) => void;
  showActions?: boolean;
  variant?: 'card' | 'row';
  showBottomDivider?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onPress,
  onConsume,
  onDiscard,
  showActions = true,
  variant = 'card',
  showBottomDivider = false,
  style,
}) => {
  const { colors, spacing, radius, typography } = useTheme();
  const currency = useAuthStore((state) => state.currency);
  const [imageFailed, setImageFailed] = useState(false);

  const categoryInfo = CATEGORIES[item.category] || CATEGORIES.other;
  const days =
    item.daysUntilExpiry !== undefined
      ? item.daysUntilExpiry
      : calculateDaysRemaining(item.expiryDate);
  const urgency = item.urgency || getExpiryUrgency(days);
  const urgencyStyle = getUrgencyColorStyles(urgency, colors);

  const isConsumed = item.status === 'consumed';
  const isDiscarded = item.status === 'discarded';

  const pillBg =
    days <= 1
      ? colors.urgentBg
      : days <= 5
      ? colors.warningBg
      : colors.safeBg;
  const pillText =
    days <= 1
      ? colors.urgentText
      : days <= 5
      ? colors.warningText
      : colors.safeText;

  const locationLabel =
    item.location.charAt(0).toUpperCase() + item.location.slice(1);

  if (variant === 'row') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.rowItem,
          showBottomDivider && {
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
          },
          style,
        ]}
      >
        <View
          style={[
            styles.rowIconBox,
            {
              backgroundColor:
                item.photoUrl && !imageFailed
                  ? colors.surfaceSubtle
                  : categoryInfo.color + '16',
              borderRadius: radius.md,
            },
          ]}
        >
          {item.photoUrl && !imageFailed ? (
            <Image
              source={{ uri: item.photoUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <CategoryIcon category={item.category} size={20} color={categoryInfo.color} />
          )}
        </View>

        <View style={styles.rowTextCol}>
          <Text
            style={[
              styles.rowTitle,
              {
                color: colors.text,
                fontSize: typography.fontSize.md,
              },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.fontSize.xs,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {locationLabel} · {formatExpirySentence(days)}
            {item.price !== undefined && item.price !== null && item.price > 0
              ? ` · ${formatCurrency(item.price, currency)}`
              : ''}
            {item.householdId ? ` · ${item.householdId.name}` : ''}
          </Text>
        </View>

        <View style={[styles.dayPill, { backgroundColor: pillBg }]}>
          <Text style={[styles.dayPillText, { color: pillText }]}>
            {formatShortDayPill(days)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Card
      onPress={onPress}
      accentBorderLeft={isConsumed || isDiscarded ? undefined : urgencyStyle.color}
      style={[
        styles.card,
        {
          padding: spacing.md,
          marginBottom: spacing.md,
          opacity: isConsumed || isDiscarded ? 0.6 : 1,
        },
        style,
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <View
          style={[
            styles.imageContainer,
            {
              backgroundColor:
                item.photoUrl && !imageFailed
                  ? colors.surfaceSubtle
                  : categoryInfo.color + '18',
              borderRadius: radius.md,
              borderColor:
                item.photoUrl && !imageFailed
                  ? colors.border
                  : categoryInfo.color + '35',
            },
          ]}
        >
          {item.photoUrl && !imageFailed ? (
            <Image
              source={{ uri: item.photoUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <CategoryIcon category={item.category} size={22} color={categoryInfo.color} />
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.nameText,
                {
                  color: colors.text,
                  fontSize: typography.fontSize.md,
                  textDecorationLine: isConsumed ? 'line-through' : 'none',
                },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.quantityText,
                {
                  color: colors.textSecondary,
                  fontSize: typography.fontSize.xs,
                },
              ]}
            >
              {item.quantity} {item.unit}
            </Text>

            <View style={styles.separatorDot} />

            <View style={styles.locationBadge}>
              <MapPin size={11} color={colors.textMuted} style={{ marginRight: 2 }} />
              <Text
                style={[
                  styles.locationText,
                  {
                    color: colors.textMuted,
                    fontSize: typography.fontSize.xs,
                    textTransform: 'capitalize',
                  },
                ]}
              >
                {item.location}
              </Text>
            </View>

            {item.householdId && (
              <>
                <View style={styles.separatorDot} />
                <View style={styles.locationBadge}>
                  <Users size={11} color={colors.primary} style={{ marginRight: 3 }} />
                  <Text
                    style={[
                      styles.householdTag,
                      {
                        color: colors.primary,
                        fontSize: typography.fontSize.xs,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.householdId.name}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <ExpiryBadge item={item} size="sm" />
        </View>
      </View>

      {showActions && !isConsumed && !isDiscarded && (
        <View
          style={[
            styles.actionsRow,
            {
              borderTopColor: colors.borderSubtle,
              paddingTop: spacing.sm,
              marginTop: spacing.sm,
            },
          ]}
        >
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onConsume?.(item);
            }}
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.safeBg,
                borderColor: colors.safeBorder,
              },
            ]}
          >
            <Check size={14} color={colors.safe} style={{ marginRight: 4 }} />
            <Text style={[styles.actionText, { color: colors.safe }]}>Used</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDiscard?.(item);
            }}
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.urgentBg,
                borderColor: colors.urgentBorder,
                marginLeft: spacing.sm,
              },
            ]}
          >
            <Trash2 size={13} color={colors.urgent} style={{ marginRight: 4 }} />
            <Text style={[styles.actionText, { color: colors.urgent }]}>Toss</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowIconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowTextCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  rowTitle: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dayPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 99,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    paddingVertical: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameText: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  quantityText: {
    fontWeight: '500',
  },
  separatorDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
    marginHorizontal: 6,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontWeight: '500',
  },
  householdTag: {
    fontWeight: '600',
  },
  badgeContainer: {
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
