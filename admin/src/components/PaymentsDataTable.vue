<script setup>
import { ref, computed } from 'vue';
import {
  Search, ChevronLeft, ChevronRight, Loader2, CreditCard
} from 'lucide-vue-next';
import { initials, avatarColor } from '../utils/avatar.js';

const props = defineProps({
  payments: { type: Array, default: () => [] },
  total: Number,
  page: Number,
  totalPages: Number,
  loading: Boolean
});
const emit = defineEmits(['search', 'status', 'page']);

const statusFilter = ref('all');

const statusClass = (s) => {
  if (s === 'success') return 'success';
  if (s === 'failed' || s === 'refunded') return 'danger';
  if (s === 'pending') return 'warning';
  return 'info';
};

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2014';

const from = props.total === 0 ? 0 : (props.page - 1) * props.payments.length + 1;
const to = (props.page - 1) * props.payments.length + props.payments.length;
const totalSize = computed(() =>
  props.payments.reduce((a, p) => a + (p.status === 'success' ? Number(p.amount) : 0), 0)
);
</script>

<template>
  <div class="card payments-card">
    <div class="head">
      <div class="title">
        <h3>Payments</h3>
        <span class="count">{{ total }}</span>
      </div>

      <div class="tools">
        <div class="seg">
          <button :class="{ on: statusFilter === 'all' }" @click="statusFilter = 'all'; emit('status', '')">All</button>
          <button :class="{ on: statusFilter === 'success' }" @click="statusFilter = 'success'; emit('status', 'success')">Success</button>
          <button :class="{ on: statusFilter === 'pending' }" @click="statusFilter = 'pending'; emit('status', 'pending')">Pending</button>
          <button :class="{ on: statusFilter === 'failed' }" @click="statusFilter = 'failed'; emit('status', 'failed')">Failed</button>
        </div>

        <div class="search">
          <Search :size="15" :stroke-width="2.2" />
          <input placeholder="Search reference, user, bill…" @input="emit('search', $event.target.value)" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <Loader2 :size="22" class="spin" />
      <p>Loading payments…</p>
    </div>

    <div v-else-if="payments.length === 0" class="empty">
      <CreditCard :size="28" :stroke-width="1.6" style="opacity: 0.5" />
      <p>No payments found</p>
    </div>

    <table v-else>
      <thead>
        <tr>
          <th>Payment</th>
          <th>Type</th>
          <th>User</th>
          <th>Meter</th>
          <th>Token</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td>
            <div class="mono ref">{{ p.paystackReference }}</div>
            <div class="muted-txt">{{ p.bill?.billReference || '—' }}</div>
          </td>
          <td>
            <span class="badge" :class="p.purpose === 'wallet_topup' ? 'info' : 'primary'">
              {{ p.purpose === 'wallet_topup' ? 'Top-up' : 'Bill' }}
            </span>
          </td>
          <td>
            <div class="user-cell">
              <div
                class="avatar"
                :style="{ background: avatarColor(p.user?.firstName || '') + '22', color: avatarColor(p.user?.firstName || ''), width: '34px', height: '34px', fontSize: '12px' }"
              >
                {{ initials(`${p.user?.firstName || ''} ${p.user?.lastName || ''}`) }}
              </div>
              <div>
                <div class="u-name">{{ p.user?.firstName }} {{ p.user?.lastName }}</div>
                <div class="u-user">@{{ p.user?.username || '—' }}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="mono">{{ p.bill?.account?.meterNumber || '—' }}</div>
            <div class="muted-txt">{{ p.bill?.account?.accountType }} • {{ p.bill?.account?.distributionCompany || '' }}</div>
          </td>
          <td><span v-if="p.bill?.token" class="tkn">{{ p.bill.token }}</span><span v-else class="muted-txt">—</span></td>
          <td class="amt">{{ naira(p.amount) }}</td>
          <td><span class="badge" :class="statusClass(p.status)">{{ p.status }}</span></td>
          <td class="muted-txt">{{ fmtDate(p.createdAt) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="foot">
      <span class="meta">
        Showing {{ from }}–{{ to }} of {{ total }} · success total {{ naira(totalSize) }}
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
.payments-card { overflow: hidden; }
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
.user-cell { display: flex; align-items: center; gap: 11px; }
.u-name { color: var(--heading); font-weight: 600; font-size: 13.5px; }
.u-user { color: var(--primary); font-size: 12px; font-weight: 600; }
.mono { font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--text); }
.ref { color: var(--primary); font-weight: 600; }
.amt { color: var(--primary); font-weight: 700; }
.tkn { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11px; color: var(--success); font-weight: 600; }
.muted-txt { color: var(--muted); font-size: 11.5px; }

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