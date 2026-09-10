<script setup>
import { useRoute } from 'vue-router';
import { LayoutDashboard, Users, CreditCard, Settings, LogOut, Zap } from 'lucide-vue-next';

defineEmits(['logout']);
const route = useRoute();
</script>

<template>
  <aside class="sidebar">
    <RouterLink to="/" class="brand">
      <div class="logo"><Zap :size="18" :stroke-width="2.6" /></div>
      <span>MetroElectric</span>
    </RouterLink>

    <nav>
      <div class="section">Overview</div>
      <RouterLink to="/" class="item" :class="{ active: route.path === '/' }">
        <LayoutDashboard :size="18" :stroke-width="2" /> Dashboard
      </RouterLink>

      <div class="section">Management</div>
      <RouterLink to="/users" class="item" :class="{ active: route.path === '/users' }">
        <Users :size="18" :stroke-width="2" /> Users
      </RouterLink>
      <RouterLink to="/payments" class="item" :class="{ active: route.path === '/payments' }">
        <CreditCard :size="18" :stroke-width="2" /> Payments
      </RouterLink>

      <div class="section">General</div>
      <RouterLink to="/settings" class="item" :class="{ active: route.path === '/settings' }">
        <Settings :size="18" :stroke-width="2" /> Settings
      </RouterLink>
    </nav>

    <div class="bottom">
      <a class="item" @click.prevent="$emit('logout')"><LogOut :size="18" :stroke-width="2" /> Sign out</a>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background: var(--menu-bg);
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  padding: 22px 16px;
}
.brand { display: flex; align-items: center; gap: 11px; padding: 0 10px 24px; text-decoration: none; }
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, #7367f0, #9e95f5);
  color: #fff;
  box-shadow: 0 4px 12px rgba(115, 103, 240, 0.45);
}
.brand span { color: #fff; font-weight: 700; font-size: 15.5px; letter-spacing: -0.01em; }

nav { flex: 1; overflow-y: auto; }
.section {
  color: #676b7e;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  padding: 14px 12px 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--menu-text);
  font-size: 13.5px;
  font-weight: 500;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.18s ease;
  text-decoration: none;
}
.item svg { opacity: 0.85; }
.item:hover { background: rgba(255, 255, 255, 0.06); color: #d6d6d9; }
.item.active {
  background: #fff;
  color: var(--menu-bg);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  font-weight: 600;
}
.item.active svg { color: var(--primary); opacity: 1; }
.bottom { border-top: 1px solid rgba(255, 255, 255, 0.07); padding-top: 14px; margin-top: 10px; }
</style>