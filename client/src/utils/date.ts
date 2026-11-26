import { ItemUrgency } from '../api/items';
import { ColorTokens } from '../theme/tokens';

export const calculateDaysRemaining = (expiryDateString: string): number => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(expiryDateString);
  const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const diffTime = startOfExp.getTime() - startOfToday.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const getExpiryUrgency = (days: number): ItemUrgency => {
  if (days < 0) return 'expired';
  if (days <= 2) return 'urgent';
  if (days <= 5) return 'warning';
  return 'safe';
};

export const formatRelativeExpiry = (days: number): string => {
  if (days < -1) return `Expired ${Math.abs(days)} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 7) return `${days} days left`;
  if (days <= 30) {
    const weeks = Math.round(days / 7);
    return `~${weeks} week${weeks > 1 ? 's' : ''} left`;
  }
  const months = Math.round(days / 30);
  return `~${months} month${months > 1 ? 's' : ''} left`;
};

export const formatDateDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatShortDateWithWeekday = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const formatExpirySentence = (days: number): string => {
  if (days < -1) return `Expired ${Math.abs(days)} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 14) return `Expires in ${days} days`;
  if (days <= 45) {
    const weeks = Math.round(days / 7);
    return `Expires in ${weeks} wk${weeks > 1 ? 's' : ''}`;
  }
  const months = Math.round(days / 30);
  return `Expires in ${months} mo${months > 1 ? 's' : ''}`;
};

export const formatShortDayPill = (days: number): string => {
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days <= 14) return `${days} days`;
  if (days <= 45) {
    const weeks = Math.round(days / 7);
    return `${weeks} wk${weeks > 1 ? 's' : ''}`;
  }
  const months = Math.round(days / 30);
  return `${months} mo`;
};

export const getUrgencyColorStyles = (
  urgency: ItemUrgency,
  colors: ColorTokens
): {
  color: string;
  bg: string;
  border: string;
  text: string;
  label: string;
} => {
  switch (urgency) {
    case 'urgent':
      return {
        color: colors.urgent,
        bg: colors.urgentBg,
        border: colors.urgentBorder,
        text: colors.urgentText,
        label: 'Urgent',
      };
    case 'warning':
      return {
        color: colors.warning,
        bg: colors.warningBg,
        border: colors.warningBorder,
        text: colors.warningText,
        label: 'Expiring Soon',
      };
    case 'expired':
      return {
        color: colors.expired,
        bg: colors.expiredBg,
        border: colors.expiredBorder,
        text: colors.expiredText,
        label: 'Expired',
      };
    case 'consumed':
      return {
        color: colors.primary,
        bg: colors.surfaceSubtle,
        border: colors.border,
        text: colors.textSecondary,
        label: 'Consumed',
      };
    case 'discarded':
      return {
        color: colors.expired,
        bg: colors.surfaceSubtle,
        border: colors.border,
        text: colors.textMuted,
        label: 'Discarded',
      };
    case 'safe':
    default:
      return {
        color: colors.safe,
        bg: colors.safeBg,
        border: colors.safeBorder,
        text: colors.safeText,
        label: 'Fresh',
      };
  }
};
