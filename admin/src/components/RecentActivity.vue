<script setup>
import { ArrowDownLeft, ArrowUpRight, Inbox } from 'lucide-vue-next';
import { initials, avatarColor } from '../utils/avatar.js';

defineProps({ items: { type: Array, default: () => [] } });

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
</script>

<template>
  <div class="card act-card">
    <div class="head">
      <div>
        <h3>Recent Transactions</h3>
        <div class="sub">Latest successful payments</div>
      </div>
      <span class="badge success">Live</span>
    </div>

    <div v-if="items.length === 0" class="empty">
      <Inbox :size="28" :stroke-width="1.6" style="opacity: 0.5" />
      <p>No payments yet</p>
    </div>

    <div v-else class="rows">
      <div v-for="p in items" :key="p.id" class="row">
        <div
          class="avatar"
          :style="{ background: avatarColor(p.userName) + '22', color: avatarColor(p.userName), width: '38px', height: '38px', fontSize: '13px' }"
        >
          {{ initials(p.userName) }}
        </div>

        <div class="info">
          <div class="name">{{ p.userName }}</div>
          <div class="ref">
            {{ p.billReference || p.paystackReference }}
            <span v-if="p.token" class="tkn">• {{ p.token.slice(0, 8) }}…</span>
          </div>
        </div>

        <div class="right">
          <div class="amt">{{ naira(p.amount) }}</div>
          <div class="date">{{ fmtDate(p.createdAt) }}</div>
        </div>

        <div class="chip success" :title="p.status">
          <ArrowDownLeft :size="14" :stroke-width="2.4" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.act-card { padding: 22px 24px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.head h3 { font-size: 16px; font-weight: 700; }
.sub { color: var(--muted); font-size: 12px; margin-top: 3px; }
.rows { display: flex; flex-direction: column; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border);
}
.row:last-child { border-bottom: none; }
.info { flex: 1; min-width: 0; }
.name { color: var(--heading); font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ref { color: var(--muted); font-size: 11.5px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tkn { color: var(--primary); font-weight: 600; }
.right { text-align: right; }
.amt { color: var(--heading); font-size: 13.5px; font-weight: 700; }
.date { color: var(--muted); font-size: 11px; margin-top: 2px; }
.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
}
.chip.success { background: var(--success-soft); color: var(--success); }
</style>