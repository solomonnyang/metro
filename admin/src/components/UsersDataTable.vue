<script setup>
import { ref, computed } from 'vue';
import {
  Search, Eye, CheckCircle2, Ban, Trash2, ChevronLeft, ChevronRight, Loader2, Users
} from 'lucide-vue-next';
import { initials, avatarColor } from '../utils/avatar.js';

const props = defineProps({
  users: { type: Array, default: () => [] },
  total: Number,
  page: Number,
  totalPages: Number,
  loading: Boolean,
  busy: { type: String, default: null }
});
const emit = defineEmits(['search', 'page', 'view', 'toggle', 'remove']);

const statusFilter = ref('all');
const filtered = computed(() =>
  statusFilter.value === 'all'
    ? props.users
    : props.users.filter((u) => (statusFilter.value === 'active' ? u.isActive : !u.isActive))
);

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';

const from = props.total === 0 ? 0 : (props.page - 1) * props.users.length + 1;
const to = (props.page - 1) * props.users.length + props.users.length;

const confirmRemove = (u) => {
  if (confirm(`Delete ${u.firstName || u.email} and all their data?\n\nThis cannot be undone.`)) emit('remove', u);
};
</script>

<template>
  <div class="card users-card">
    <div class="head">
      <div class="title">
        <h3>Users</h3>
        <span class="count">{{ total }}</span>
      </div>

      <div class="tools">
        <div class="seg">
          <button :class="{ on: statusFilter === 'all' }" @click="statusFilter = 'all'">All</button>
          <button :class="{ on: statusFilter === 'active' }" @click="statusFilter = 'active'">Active</button>
          <button :class="{ on: statusFilter === 'inactive' }" @click="statusFilter = 'inactive'">Inactive</button>
        </div>

        <div class="search">
          <Search :size="15" :stroke-width="2.2" />
          <input
            placeholder="Search name, email, Telegram…"
            @input="emit('search', $event.target.value)"
          />
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <Loader2 :size="22" class="spin" />
      <p>Loading users…</p>
    </div>

    <div v-else-if="filtered.length === 0" class="empty">
      <Users :size="28" :stroke-width="1.6" style="opacity: 0.5" />
      <p>No users found</p>
    </div>

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
          <th class="ta-r">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in filtered" :key="u.id">
          <td>
            <div class="user-cell">
              <div
                :class="['avatar']"
                :style="{ background: avatarColor((u.firstName || '') + (u.lastName || '')) + '22', color: avatarColor((u.firstName || '') + (u.lastName || '')), width: '36px', height: '36px', fontSize: '12.5px' }"
              >
                {{ initials(`${u.firstName || ''} ${u.lastName || ''}`) }}
              </div>
              <div>
                <div class="u-name">{{ u.firstName }} {{ u.lastName }}</div>
                <div class="u-user">@{{ u.username || 'no username' }}</div>
              </div>
            </div>
          </td>
          <td class="mono">{{ u.telegramId }}</td>
          <td>
            <div class="cnt">{{ u.email || '—' }}</div>
            <div class="cnt-sub">{{ u.phone || '' }}</div>
          </td>
          <td class="num">{{ u.accountCount }}</td>
          <td class="num">{{ u.paymentCount }}</td>
          <td class="spent">{{ naira(u.totalSpent) }}</td>
          <td>
            <span class="badge" :class="u.isActive ? 'success' : 'danger'">
              {{ u.isActive ? 'Active' : 'Inactive' }}
            </span>
          </td>
          <td class="muted-txt">{{ fmtDate(u.createdAt) }}</td>
          <td class="ta-r">
            <button class="icon-btn" title="View user" @click="emit('view', u)">
              <Eye :size="16" :stroke-width="2" />
            </button>
            <button
              class="icon-btn"
              :class="u.isActive ? 'danger' : 'success'"
              :title="u.isActive ? 'Deactivate' : 'Activate'"
              :disabled="busy === u.id"
              @click="emit('toggle', u)"
            >
              <component :is="u.isActive ? Ban : CheckCircle2" :size="16" :stroke-width="2" />
            </button>
            <button class="icon-btn danger" title="Delete user" @click="confirmRemove(u)">
              <Trash2 :size="16" :stroke-width="2" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="foot">
      <span class="meta">
        Showing {{ from }}–{{ to }} of {{ total }} users
      </span>
      <div class="pager">
        <button class="btn btn-outline" :disabled="page <= 1" @click="emit('page', -1)">
          <ChevronLeft :size="15" :stroke-width="2.2" />
          Prev
        </button>
        <span class="pg">Page {{ page }} / {{ totalPages || 1 }}</span>
        <button class="btn btn-outline" :disabled="page >= totalPages" @click="emit('page', 1)">
          Next
          <ChevronRight :size="15" :stroke-width="2.2" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-card { overflow: hidden; }
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.title { display: flex; align-items: center; gap: 10px; }
.title h3 { font-size: 16px; font-weight: 700; }
.count {
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
}
.tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.seg {
  display: inline-flex;
  background: #f0eef2;
  border-radius: 8px;
  padding: 3px;
}
.seg button {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.seg button.on { background: #fff; color: var(--primary); box-shadow: var(--shadow-sm); }
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 12px;
  color: var(--muted);
  min-width: 240px;
  background: #fff;
}
.search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.search input { border: none; outline: none; font-size: 13px; color: var(--text); width: 100%; background: transparent; }

table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
th, td { text-align: left; padding: 13px 24px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th {
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  background: #fafafa;
}
tr:hover td { background: #fbfbfd; }
.ta-r { text-align: right; }
.user-cell { display: flex; align-items: center; gap: 12px; }
.u-name { color: var(--heading); font-weight: 600; font-size: 13.5px; }
.u-user { color: var(--primary); font-size: 12px; font-weight: 600; }
.mono { font-variant-numeric: tabular-nums; color: var(--text); font-size: 12.5px; }
.cnt { color: var(--text); font-size: 13px; }
.cnt-sub { color: var(--muted); font-size: 11.5px; }
.num { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text); }
.spent { color: var(--primary); font-weight: 700; }
.muted-txt { color: var(--muted); font-size: 12px; }

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 16px 24px;
}
.meta { color: var(--muted); font-size: 12.5px; }
.pager { display: flex; align-items: center; gap: 10px; }
.pg { color: var(--text); font-size: 12.5px; font-weight: 600; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>