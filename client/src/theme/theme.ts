import { lightColors, darkColors, spacing, radius, typography, shadows, ColorTokens } from './tokens';
import { useAuthStore } from '../store/authStore';

export interface Theme {
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
  isDark: boolean;
}

export const useTheme = (): Theme => {
  const themeMode = useAuthStore((state) => state.theme);
  const isDark = themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return {
    colors,
    spacing,
    radius,
    typography,
    shadows,
    isDark,
  };
};

export { lightColors, darkColors, spacing, radius, typography, shadows };
