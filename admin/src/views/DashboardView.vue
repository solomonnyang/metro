<script setup>
import { ref, inject, watch, onMounted } from 'vue';
import { Users, UserCheck, Zap, Wallet } from 'lucide-vue-next';
import { getStats } from '../api.js';
import StatCard from '../components/StatCard.vue';
import RevenueChart from '../components/RevenueChart.vue';
import RecentActivity from '../components/RecentActivity.vue';

const stats = ref(null);
const refreshSeq = inject('refreshSeq');

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);

const loadStats = async () => {
  stats.value = (await getStats()).stats;
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

onMounted(loadStats);
watch(refreshSeq, loadStats);
</script>

<template>
  <template v-if="!stats"><div class="loading">Loading stats…</div></template>
  <template v-else>
    <div class="stats-grid">
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
        label="Wallet top-ups"
        sub="Funds added via Paystack"
        :value="naira(stats.revenue)"
        :trend="revenuePct() !== null ? `${revenuePct() > 0 ? '+' : ''}${revenuePct()}%` : null"
        :trend-up="(revenuePct() || 0) >= 0"
        :foot="`${naira(stats.walletLiabilities)} in wallets`"
      />
    </div>

    <div class="mid-grid">
      <RevenueChart :labels="stats.revenueByMonth.labels" :totals="stats.revenueByMonth.totals" />
      <RecentActivity :items="stats.recentPayments" />
    </div>
  </template>
</template>

<style scoped>
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
@media (max-width: 1100px) {
  .mid-grid { grid-template-columns: 1fr; }
}
</style>