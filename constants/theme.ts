// ─── ExploreEase Design System ───────────────────────────────────────────────
// Material Design 3 · Blue–Orange Travel Theme · Android 12+

export const Colors = {
  light: {
    // Primary – Ocean Blue
    primary: '#1565C0',
    primaryLight: '#42A5F5',
    primaryContainer: '#DBEAFE',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#0D2F6E',

    // Secondary – Sunset Orange
    secondary: '#F97316',
    secondaryLight: '#FDBA74',
    secondaryContainer: '#FFEDD5',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#7C2D12',

    // Surfaces
    background: '#F0F4FF',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    surfaceElevated: '#FFFFFF',

    // Text
    onBackground: '#0D1B2A',
    onSurface: '#1E293B',
    onSurfaceVariant: '#64748B',
    placeholder: '#94A3B8',
    disabled: '#CBD5E1',

    // Semantic
    error: '#EF4444',
    errorContainer: '#FEE2E2',
    success: '#10B981',
    successContainer: '#D1FAE5',
    warning: '#F59E0B',
    warningContainer: '#FEF3C7',
    info: '#3B82F6',
    infoContainer: '#DBEAFE',

    // UI
    outline: '#E2E8F0',
    outlineVariant: '#F1F5F9',
    scrim: 'rgba(0,0,0,0.5)',

    // Bottom Tab
    tabActive: '#1565C0',
    tabInactive: '#94A3B8',
    tabBackground: '#FFFFFF',
  },

  dark: {
    primary: '#90CAF9',
    primaryLight: '#42A5F5',
    primaryContainer: '#1E3A5F',
    onPrimary: '#0D2137',
    onPrimaryContainer: '#BFDBFE',

    secondary: '#FB923C',
    secondaryLight: '#FDBA74',
    secondaryContainer: '#7C2D12',
    onSecondary: '#3D1F00',
    onSecondaryContainer: '#FED7AA',

    background: '#0A0F1E',
    surface: '#131929',
    surfaceVariant: '#1E2535',
    surfaceElevated: '#1A2236',

    onBackground: '#F1F5F9',
    onSurface: '#E2E8F0',
    onSurfaceVariant: '#94A3B8',
    placeholder: '#475569',
    disabled: '#334155',

    error: '#F87171',
    errorContainer: '#7F1D1D',
    success: '#34D399',
    successContainer: '#064E3B',
    warning: '#FBBF24',
    warningContainer: '#78350F',
    info: '#60A5FA',
    infoContainer: '#1E3A5F',

    outline: '#2D3748',
    outlineVariant: '#1E2535',
    scrim: 'rgba(0,0,0,0.7)',

    tabActive: '#90CAF9',
    tabInactive: '#475569',
    tabBackground: '#131929',
  },
}

// ─── Typography ───────────────────────────────────────────────────────────────
export const Typography = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400' as const },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400' as const },

  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },

  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },

  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },

  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
}

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
}

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
}

// ─── Elevation / Shadow ───────────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 10,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  }),
}

// ─── Z-Index ──────────────────────────────────────────────────────────────────
export const ZIndex = {
  base: 0,
  card: 1,
  dropdown: 10,
  modal: 100,
  toast: 200,
}

export default {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadow,
  ZIndex,
}
