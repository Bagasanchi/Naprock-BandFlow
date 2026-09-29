export type Role = 'worker' | 'boss';

export type RoleTheme = {
  background: string;
  surface: string;
  sheet: string;
  border: string;
  title: string;
  body: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  inputBg: string;
  danger: string;
  success: string;
  backdrop: string;
};

// Colors match Dashboard.tsx (boss, purple) and WorkerDashboard.tsx (worker, blue)
// so Profile, Settings, and the side menu feel like part of each role's pages.
const palettes: Record<Role, { dark: RoleTheme; light: RoleTheme }> = {
  boss: {
    dark: {
      background: '#170827', surface: 'rgba(38, 15, 59, 0.92)', sheet: '#210D35', border: 'rgba(232, 208, 255, 0.18)',
      title: '#FFF7FF', body: '#DFC8F4', accent: '#C43BEF', accentText: '#FFFFFF', accentSoft: 'rgba(196, 59, 239, 0.16)',
      inputBg: 'rgba(255, 255, 255, 0.06)', danger: '#FF8F8F', success: '#7CE1BB', backdrop: 'rgba(5, 0, 12, 0.6)',
    },
    light: {
      background: '#FAF3FF', surface: '#FFFFFF', sheet: '#FFFFFF', border: '#E8D5F7',
      title: '#2F0A4B', body: '#705485', accent: '#8F23C9', accentText: '#FFFFFF', accentSoft: '#F0D8FF',
      inputBg: '#FBF7FE', danger: '#D93A3A', success: '#14744E', backdrop: 'rgba(47, 10, 75, 0.35)',
    },
  },
  worker: {
    dark: {
      background: '#07111F', surface: 'rgba(11, 22, 39, 0.92)', sheet: '#0B1627', border: 'rgba(161, 182, 214, 0.2)',
      title: '#F4F8FF', body: '#A7B4C9', accent: '#56A7FF', accentText: '#04111F', accentSoft: 'rgba(86, 167, 255, 0.16)',
      inputBg: 'rgba(255, 255, 255, 0.06)', danger: '#FF8F8F', success: '#7CE1BB', backdrop: 'rgba(0, 4, 12, 0.6)',
    },
    light: {
      background: '#EEF5FF', surface: '#FFFFFF', sheet: '#FFFFFF', border: '#C7DAF2',
      title: '#14243A', body: '#4A5D77', accent: '#1A67C9', accentText: '#FFFFFF', accentSoft: '#D8EAFE',
      inputBg: '#F5F9FF', danger: '#D93A3A', success: '#14744E', backdrop: 'rgba(20, 36, 58, 0.35)',
    },
  },
};

export function getRoleTheme(role: Role, isDarkTheme: boolean) {
  return palettes[role][isDarkTheme ? 'dark' : 'light'];
}
