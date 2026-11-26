export interface ColorTokens {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryGradient: [string, string];
  accent: string;
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Urgency status colors
  urgent: string;
  urgentBg: string;
  urgentText: string;
  urgentBorder: string;

  warning: string;
  warningBg: string;
  warningText: string;
  warningBorder: string;

  safe: string;
  safeBg: string;
  safeText: string;
  safeBorder: string;

  expired: string;
  expiredBg: string;
  expiredText: string;
  expiredBorder: string;

  // Feedback
  success: string;
  danger: string;
  dangerBg: string;
  info: string;
}

export const lightColors: ColorTokens = {
  primary: '#1E3F2B', // Deep pine forest green matching mockup
  primaryLight: '#2E5E40',
  primaryDark: '#12291B',
  primaryGradient: ['#1E3F2B', '#12291B'],
  accent: '#5B8E6D',
  background: '#F4F3EE', // Warm stone / alabaster surface
  surface: '#FFFFFF',
  surfaceSubtle: '#ECEAE3',
  surfaceElevated: '#FFFFFF',
  border: '#E4E1D8',
  borderSubtle: '#ECEAE2',
  text: '#17201A',
  textSecondary: '#666E67',
  textMuted: '#8F968F',
  textInverse: '#FFFFFF',

  // Urgency pastel pills matching mockup
  urgent: '#C54B3E',
  urgentBg: '#F9E6E4',
  urgentText: '#B43C30',
  urgentBorder: '#F2CBC7',

  warning: '#C78A28',
  warningBg: '#F8EED8',
  warningText: '#946214',
  warningBorder: '#EEDB9F',

  safe: '#2D6A4F',
  safeBg: '#E6F2EA',
  safeText: '#21543D',
  safeBorder: '#C7E2D0',

  expired: '#6C757D',
  expiredBg: '#ECECE8',
  expiredText: '#555C57',
  expiredBorder: '#DCDCD5',

  success: '#1E3F2B',
  danger: '#C54B3E',
  dangerBg: '#F9E6E4',
  info: '#3B6E9C',
};

export const darkColors: ColorTokens = {
  primary: '#6EB88A',
  primaryLight: '#8FD0A6',
  primaryDark: '#1E3F2B',
  primaryGradient: ['#1E3F2B', '#12291B'],
  accent: '#8FD0A6',
  background: '#111613',
  surface: '#19211C',
  surfaceSubtle: '#222D27',
  surfaceElevated: '#27342D',
  border: '#2A3830',
  borderSubtle: '#232F28',
  text: '#F3F5F2',
  textSecondary: '#A8B3AA',
  textMuted: '#728075',
  textInverse: '#111613',

  // Urgency
  urgent: '#F07167',
  urgentBg: '#3A1D1B',
  urgentText: '#F8A9A3',
  urgentBorder: '#5E2B27',

  warning: '#E9B949',
  warningBg: '#382B14',
  warningText: '#F5D586',
  warningBorder: '#57421B',

  safe: '#6EB88A',
  safeBg: '#163022',
  safeText: '#A8DFBC',
  safeBorder: '#244C36',

  expired: '#9CA3AF',
  expiredBg: '#232725',
  expiredText: '#CBD2CE',
  expiredBorder: '#343A37',

  success: '#6EB88A',
  danger: '#F07167',
  dangerBg: '#3A1D1B',
  info: '#6DA4D8',
};

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  fontSize: {
    xxs: 11,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    hero: 38,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};

export const shadows = {
  subtle: {
    shadowColor: '#161F19',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: '#161F19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
};
