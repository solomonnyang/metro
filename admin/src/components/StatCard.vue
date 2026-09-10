<script setup>
import { TrendingUp, TrendingDown } from 'lucide-vue-next';

defineProps({
  label: String,
  sub: String,
  value: [String, Number],
  icon: [Object, Function],
  color: { type: String, default: 'primary' },
  trend: String,
  trendUp: { type: Boolean, default: true },
  foot: String
});
</script>

<template>
  <div class="stat-card">
    <div class="head">
      <div>
        <div class="label">{{ label }}</div>
        <div class="sub">{{ sub }}</div>
      </div>
      <div class="chip" :class="color">
        <component :is="icon" :size="22" :stroke-width="2.2" />
      </div>
    </div>

    <div class="value">{{ value }}</div>

    <div class="foot">
      <span v-if="trend" class="trend" :class="trendUp ? 'up' : 'down'">
        <component :is="trendUp ? TrendingUp : TrendingDown" :size="14" :stroke-width="2.4" />
        {{ trend }}
      </span>
      <span class="foottext">{{ foot }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 20px 22px;
}
.head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.label { color: var(--muted); font-size: 13px; font-weight: 500; }
.sub { color: var(--text); font-size: 11px; margin-top: 2px; }
.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
}
.chip.primary { background: var(--primary-soft); color: var(--primary); }
.chip.success { background: var(--success-soft); color: var(--success); }
.chip.warning { background: var(--warning-soft); color: var(--warning); }
.chip.danger { background: var(--danger-soft); color: var(--danger); }
.chip.info { background: var(--info-soft); color: var(--info); }

.value { color: var(--heading); font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; min-height: 18px; }
.trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
}
.trend.up { color: var(--success); }
.trend.down { color: var(--danger); }
.foottext { color: var(--muted); font-size: 12px; }
</style>