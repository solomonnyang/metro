<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { CheckCircle2 } from 'lucide-vue-next';
import { Users, UserCheck, Zap, Wallet } from 'lucide-vue-next';
import { getStats, getUsers, patchUser, deleteUser, clearToken } from '../api.js';
import { initials } from '../utils/avatar.js';
import StatCard from '../components/StatCard.vue';
import RevenueChart from '../components/RevenueChart.vue';
import RecentActivity from '../components/RecentActivity.vue';
import UsersDataTable from '../components/UsersDataTable.vue';
import AppSidebar from '../components/AppSidebar.vue';
import AppTopbar from '../components/AppTopbar.vue';
import UserDetailModal from '../components/UserDetailModal.vue';

const router = useRouter();

const stats = ref(null);
const users = ref([]);
const paging = ref({ page: 1, limit: 10, total: 0, totalPages: 0 });
const loadingUsers = ref(false);
const busyId = ref(null);
const detailUser = ref(null);
const toast = ref(null);
let toastTimer = null;
let searchTimer = null;

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);

const showToast = (msg) => {
  toast.value = { msg };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2500);
};

const loadStats = async () => {
  stats.value = (await getStats()).stats;
};

const loadUsers = async () => {
  loadingUsers.value = true;
  try {
    const data = await getUsers({ page: paging.value.page, limit: paging.value.limit, search: searchTerm.value });
    users.value = data.users;
    paging.value = data.pagination;
  } finally {
    loadingUsers.value = false;
  }
};

const refresh = async () => {
  await Promise.all([loadStats(), loadUsers()]);
  showToast('Dashboard refreshed');
};

const searchTerm = ref('');
const onSearch = (q) => {
  searchTerm.value = q;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    paging.value.page = 1;
    loadUsers();
  }, 350);
};

const changePage = (delta) => {
  paging.value.page += delta;
  loadUsers();
};

const toggleActive = async (user) => {
  busyId.value = user.id;
  try {
    const res = await patchUser(user.id, { isActive: !user.isActive });
    user.isActive = res.user.isActive;
    showToast(`User ${user.isActive ? 'activated' : 'deactivated'}`);
    loadStats();
  } catch (e) {
    showToast(e.message);
  } finally {
    busyId.value = null;
  }
};

const removeUser = async (user) => {
  busyId.value = user.id;
  try {
    await deleteUser(user.id);
    showToast('User deleted');
    loadUsers();
  } catch (e) {
    showToast(e.message);
  } finally {
    busyId.value = null;
  }
};

const handleChanged = (updated) => {
  if (updated.deleted) {
    showToast('User deleted');
    loadUsers();
  } else {
    const idx = users.value.findIndex((u) => u.id === updated.id);
    if (idx !== -1) users.value[idx].isActive = updated.isActive;
  }
  loadStats();
};

const logout = () => {
  clearToken();
  router.push('/login');
};

const revenuePct = () => {
  const t = stats.value?.revenueByMonth?.totals || [];
  if (t.length < 2) return null;
  const last = Number(t[t.length - 1] || 0);
  const prev = Number(t[t.length - 2] || 0);
  if (prev <= 0) return null;
  return Math.round(((last - prev) / prev) * 100);
};
const revenueYoy = () =>
  stats.value?.revenueByMonth?.labels?.[stats.value.revenueByMonth.labels.length - 1] || '';

onMounted(async () => {
  await loadStats();
  await loadUsers();
});
onBeforeUnmount(() => {
  clearTimeout(toastTimer);
  clearTimeout(searchTimer);
});
</script>

<template>
  <div class="layout">
    <AppSidebar @logout="logout" />

    <main class="main">
      <AppTopbar :badge="stats?.pendingBills || 0" @refresh="refresh" @logout="logout" />

      <div class="content">
        <div class="stats-grid" v-if="stats">
          <StatCard
            :icon="Users"
            color="primary"
            label="Total users"
            sub="All registered accounts"
            :value="stats.totalUsers"
            :foot="`${stats.activeUsers} active`"
          />
          <StatCard
            :icon="UserCheck"
            color="success"
            label="Active users"
            sub="Interacting with the bot"
            :value="stats.activeUsers"
            :foot="`${stats.paidBills} bills paid`"
          />
          <StatCard
            :icon="Zap"
            color="warning"
            label="Meter accounts"
            sub="Linked meter numbers"
            :value="stats.totalAccounts"
            :foot="`${stats.pendingBills} pending bills`"
          />
          <StatCard
            :icon="Wallet"
            color="info"
            label="Revenue"
            sub="From completed payments"
            :value="naira(stats.revenue)"
            :trend="revenuePct() !== null ? `${revenuePct() > 0 ? '+' : ''}${revenuePct()}%` : null"
            :trend-up="(revenuePct() || 0) >= 0"
            :foot="`vs ${revenueYoy()}`"
          />
        </div>
        <div v-else class="loading">Loading stats…</div>

        <div class="mid-grid" v-if="stats">
          <RevenueChart
            :labels="stats.revenueByMonth.labels"
            :totals="stats.revenueByMonth.totals"
          />
          <RecentActivity :items="stats.recentPayments" />
        </div>

        <UsersDataTable
          @search="onSearch"
          @page="changePage"
          @view="detailUser = $event"
          @toggle="toggleActive"
          @remove="removeUser"
          :users="users"
          :total="paging.total"
          :page="paging.page"
          :total-pages="paging.totalPages"
          :loading="loadingUsers"
          :busy="busyId"
        />
      </div>
    </main>

    <UserDetailModal v-if="detailUser" :user="detailUser" @close="detailUser = null" @changed="handleChanged" />
  </div>

  <Transition name="tst">
    <div v-if="toast" class="toast">
      <CheckCircle2 :size="16" :stroke-width="2.4" />
      {{ toast.msg }}
    </div>
  </Transition>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: auto 1fr; min-height: 100vh; }
.main { min-width: 0; display: flex; flex-direction: column; }
.content { padding: 18px 28px 34px; display: flex; flex-direction: column; gap: 24px; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 20px;
}

.mid-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr);
  gap: 20px;
}

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--card);
  color: var(--heading);
  border: 1px solid var(--border);
  border-left: 4px solid var(--success);
  box-shadow: var(--shadow);
  padding: 12px 18px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  z-index: 60;
}
.toast svg { color: var(--success); }
.tst-enter-active, .tst-leave-active { transition: opacity 0.2s, transform 0.2s; }
.tst-enter-from, .tst-leave-to { opacity: 0; transform: translateY(6px); }

@media (max-width: 1100px) {
  .mid-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; width: 100%; }
  .content { padding: 16px; }
}
</style>