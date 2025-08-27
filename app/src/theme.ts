export const palettes = {
    purple: {
        primary: '#7C3AED', primaryDark: '#5B21B6', primaryLight: '#C4B5FD',
        bg: '#0F0F14', card: '#1B1524', text: '#FFFFFF', muted: '#A3A3A3',
        success: '#10B981', danger: '#EF4444', warning: '#F59E0B',
    },
    teal: {
        primary: '#14B8A6', primaryDark: '#0F766E', primaryLight: '#99F6E4',
        bg: '#0E1113', card: '#0F1C1A', text: '#FFFFFF', muted: '#9CA3AF',
        success: '#22C55E', danger: '#EF4444', warning: '#F59E0B',
    },
} as const;

export type PaletteName = keyof typeof palettes;
export const theme = (name: PaletteName = 'purple') => palettes[name];
