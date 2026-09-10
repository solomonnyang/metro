<script setup>
import { Bell, ChevronRight, LogOut, RefreshCw } from 'lucide-vue-next';

defineProps({
  title: { type: String, default: 'Users' },
  crumb: { type: String, default: 'Home' },
  badge: { type: Number, default: 0 }
});
defineEmits(['refresh', 'logout']);
</script>

<template>
  <header class="topbar">
    <div class="left">
      <div class="crumb">
        <span>{{ crumb }}</span>
        <ChevronRight :size="14" :stroke-width="2.4" />
        <strong>{{ title }}</strong>
      </div>
      <h2>Users</h2>
    </div>

    <div class="right">
      <button class="icon-btn ghost" title="Refresh" @click="$emit('refresh')">
        <RefreshCw :size="18" :stroke-width="2" />
      </button>

      <button class="icon-btn ghost bell" title="Notifications">
        <Bell :size="18" :stroke-width="2" />
        <span v-if="badge > 0" class="dot">{{ badge }}</span>
      </button>

      <div class="sep" />

      <button class="profile" title="Sign out" @click="$emit('logout')">
        <div class="avatar">AD</div>
        <div class="who">
          <div class="nm">Administrator</div>
          <div class="rl">Super admin</div>
        </div>
        <LogOut :size="15" :stroke-width="2" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 28px 8px;
}
.crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12.5px;
}
.crumb strong { color: var(--heading); font-weight: 600; }
.topbar h2 { font-size: 21px; font-weight: 700; margin-top: 2px; }

.right { display: flex; align-items: center; gap: 8px; }
.icon-btn.ghost { width: 36px; height: 36px; border-radius: 8px; color: var(--muted); }
.icon-btn.ghost:hover { background: var(--card); box-shadow: var(--shadow-sm); color: var(--primary); }
.bell { position: relative; }
.dot {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--body-bg);
}
.sep { width: 1px; height: 26px; background: var(--border); margin: 0 6px; }
.profile {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
  padding: 6px 12px 6px 6px;
  color: var(--muted);
  transition: all 0.18s ease;
}
.profile:hover { border-color: var(--primary); color: var(--primary); }
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7367f0, #9e95f5);
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.who { text-align: left; line-height: 1.15; }
.nm { color: var(--heading); font-size: 12.5px; font-weight: 600; }
.rl { color: var(--muted); font-size: 10.5px; }
</style>