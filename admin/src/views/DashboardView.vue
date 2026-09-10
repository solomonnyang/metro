<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { getStats, getUsers, patchUser, deleteUser, clearToken } from '../api.js';
import StatCard from '../components/StatCard.vue';
import UserDetailModal from '../components/UserDetailModal.vue';

const router = useRouter();
const stats = ref(null);
const users = ref([]);
const paging = ref({ page: 1, limit: 10, total: 0, totalPages: 0 });
const search = ref('');
const loadingUsers = ref(false);
const busyId = ref(null);
const detailUser = ref(null);
const toast = ref(null);
let toastTimer = null;
let searchTimer = null;

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';

const showToast = (msg) => {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2500);
};

const loadStats = async () => {
  stats.value = (await getStats()).stats;
};

const loadUsers = async () => {
  loadingUsers.value = true;
  try {
    const data = await getUsers({ page: paging.value.page, limit: paging.value.limit, search: search.value });
    users.value = data.users;
    paging.value = data.pagination;
  } finally {
    loadingUsers.value = false;
  }
};

const onSearchInput = () => {
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
    <aside class="sidebar">
      <div class="brand"><span>⚡</span> MetroElectric</div>
      <div class="nav">
        <button class="side-item active">👥 Users</button>
        <button class="side-item logout" @click="logout">⎋ Sign out</button>
      </div>
    </aside>

    <main class="main">
      <div class="topbar">
        <div>
          <h2>Users</h2>
          <div class="sub">Manage customers who interact with the bot</div>
        </div>
      </div>

      <div class="stats-grid" v-if="stats">
        <StatCard icon="👥" :value="stats.totalUsers" label="Total users" />
        <StatCard icon="✅" :value="stats.activeUsers" label="Active users" green />
        <StatCard icon="🔌" :value="stats.totalAccounts" label="Meter accounts" />
        <StatCard icon="📄" :value="stats.pendingBills" label="Pending bills" />
        <StatCard icon="💳" :value="stats.successfulPayments" label="Paid transactions" />
        <StatCard icon="💰" :value="naira(stats.revenue)" label="Total revenue" green />
      </div>
      <div v-else class="loading">Loading stats...</div>

      <div class="panel">
        <div class="panel-head">
          <input v-model="search" @input="onSearchInput" placeholder="🔍  Search name, username, email, phone, Telegram ID..." />
        </div>

        <div v-if="loadingUsers" class="loading">Loading users...</div>
        <div v-else-if="users.length === 0" class="empty">No users found</div>

        <table v-else>
          <thead>
            <tr>
              <th>User</th>
              <th>Telegram</th>
              <th>Contact</th>
              <th>Meters</th>
              <th>Payments</th>
              <th>Total spent</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td><strong style="color:#fff">{{ u.firstName }} {{ u.lastName }}</strong></td>
              <td>
                <span style="color:var(--accent)">@{{ u.username || '—' }}</span>
                <span style="color:var(--muted)">({{ u.telegramId }})</span>
              </td>
              <td>
                {{ u.email || '—' }}<br />
                <span style="color:var(--muted);font-size:12px">{{ u.phone || '' }}</span>
              </td>
              <td>{{ u.accountCount }}</td>
              <td>{{ u.paymentCount }}</td>
              <td style="color:var(--green);font-weight:700">{{ naira(u.totalSpent) }}</td>
              <td><span class="badge" :class="u.isActive ? 'active' : 'inactive'">{{ u.isActive ? 'Active' : 'Inactive' }}</span></td>
              <td style="color:var(--muted);font-size:12px">{{ fmtDate(u.createdAt) }}</td>
              <td>
                <button class="btn-sm" @click="detailUser = u">View</button>
                <button
                  class="btn-sm"
                  :class="u.isActive ? 'danger' : 'success'"
                  :disabled="busyId === u.id"
                  @click="toggleActive(u)"
                >
                  {{ u.isActive ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="paging">
          <span>Showing {{ users.length }} of {{ paging.total }} users</span>
          <div class="btns">
            <button :disabled="paging.page <= 1" @click="changePage(-1)">← Prev</button>
            <span>Page {{ paging.page }} / {{ paging.totalPages || 1 }}</span>
            <button :disabled="paging.page >= paging.totalPages" @click="changePage(1)">Next →</button>
          </div>
        </div>
      </div>
    </main>

    <UserDetailModal v-if="detailUser" :user="detailUser" @close="detailUser = null" @changed="handleChanged" />
  </div>

  <Transition name="tst">
    <div v-if="toast" class="toast">{{ toast }}</div>
  </Transition>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar {
  background: #0e1629;
  border-right: 1px solid #1c2742;
  padding: 24px 18px;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 16px; color: #fff; margin-bottom: 30px; }
.brand span { font-size: 22px; }
.nav { flex: 1; }
.side-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 10px;
  color: #8ea0c4;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
}
.side-item:hover { background: var(--hover); color: #dbe4f5; }
.side-item.active { background: #1c2f57; color: #fff; }
.side-item.logout { color: var(--red); }

.main { padding: 28px 32px; }
.topbar { margin-bottom: 26px; }
.topbar h2 { font-size: 22px; font-weight: 800; color: #fff; }
.topbar .sub { color: var(--muted); font-size: 13px; margin-top: 3px; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
.panel-head { padding: 16px 18px; border-bottom: 1px solid var(--border); }
.panel-head input {
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--border-2);
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
}
.panel-head input:focus { outline: none; border-color: var(--accent); }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
tr:hover td { background: #141f38; }

.paging {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  color: var(--muted);
  font-size: 13px;
}
.paging .btns button {
  background: #1c2f57;
  border: none;
  color: #fff;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  margin-left: 6px;
  font-size: 13px;
}
.paging .btns button:disabled { opacity: .4; cursor: not-allowed; }

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #1c2f57;
  color: #fff;
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 12px 30px rgba(0, 0, 0, .4);
  z-index: 60;
}
.tst-enter-active, .tst-leave-active { transition: opacity .2s, transform .2s; }
.tst-enter-from, .tst-leave-to { opacity: 0; transform: translateY(6px); }

@media (max-width: 820px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; }
  .main { padding: 20px; }
}
</style>