<script setup>
import { ref, provide, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getStats, clearToken } from '../api.js';
import AppSidebar from '../components/AppSidebar.vue';
import AppTopbar from '../components/AppTopbar.vue';

const router = useRouter();
const route = useRoute();

const badge = ref(0);
const refreshSeq = ref(0);
provide('refreshSeq', refreshSeq);
provide('notify', () => { refreshSeq.value++; loadBadge(); });

const loadBadge = async () => {
  try {
    const s = await getStats();
    badge.value = s.stats.pendingBills || 0;
  } catch {}
};

const logout = () => {
  clearToken();
  router.push('/login');
};

onMounted(loadBadge);
</script>

<template>
  <div class="layout">
    <AppSidebar @logout="logout" />
    <main class="main">
      <AppTopbar :title="route.meta.title || 'Dashboard'" :crumb="route.meta.crumb || 'Home'" :badge="badge" @refresh="refreshSeq++" @logout="logout" />
      <div class="content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: auto 1fr; min-height: 100vh; }
.main { min-width: 0; display: flex; flex-direction: column; }
.content { padding: 18px 28px 34px; display: flex; flex-direction: column; gap: 24px; }
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; width: 100%; }
  .content { padding: 16px; }
}
</style>