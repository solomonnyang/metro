const AVATAR_COLORS = ['#7367f0', '#28c76f', '#ff9f43', '#00cfe8', '#ea5455', '#9b59b6', '#1e9ff2', '#3e9b9e'];

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || '?';

export const avatarColor = (name = '') => {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};