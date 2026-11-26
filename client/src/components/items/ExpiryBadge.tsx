import React from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import { Badge } from '../ui/Badge';
import { useTheme } from '../../theme/theme';
import { FoodItem, ItemUrgency } from '../../api/items';
import {
  calculateDaysRemaining,
  formatRelativeExpiry,
  getExpiryUrgency,
  getUrgencyColorStyles,
} from '../../utils/date';

interface ExpiryBadgeProps {
  item?: FoodItem;
  expiryDate?: string;
  urgency?: ItemUrgency;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const ExpiryBadge: React.FC<ExpiryBadgeProps> = ({
  item,
  expiryDate,
  urgency,
  style,
  textStyle,
  size = 'md',
}) => {
  const { colors } = useTheme();

  const targetDate = item?.expiryDate || expiryDate || new Date().toISOString();
  const days = item?.daysUntilExpiry !== undefined ? item.daysUntilExpiry : calculateDaysRemaining(targetDate);
  const resolvedUrgency = urgency || item?.urgency || getExpiryUrgency(days);

  const urgencyStyles = getUrgencyColorStyles(resolvedUrgency, colors);
  const label = item?.status === 'consumed'
    ? 'Consumed'
    : item?.status === 'discarded'
    ? 'Discarded'
    : formatRelativeExpiry(days);

  return (
    <Badge
      label={label}
      color={urgencyStyles.text}
      backgroundColor={urgencyStyles.bg}
      borderColor={urgencyStyles.border}
      withDot={resolvedUrgency === 'urgent' || resolvedUrgency === 'warning'}
      dotColor={urgencyStyles.color}
      size={size}
      style={style}
      textStyle={textStyle}
    />
  );
};
