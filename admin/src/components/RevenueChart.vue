<script setup>
import { computed } from 'vue';
import { TrendingUp } from 'lucide-vue-next';

const props = defineProps({
  labels: { type: Array, default: () => [] },
  totals: { type: Array, default: () => [] }
});

const W = 620;
const H = 200;
const PAD_X = 0;
const PAD_TOP = 14;
const PAD_BOT = 8;

const sum = computed(() => props.totals.reduce((a, b) => a + Number(b || 0), 0));
const max = computed(() => Math.max(...props.totals.map(Number), 1));
const last = computed(() => Number(props.totals[props.totals.length - 1] || 0));
const lastLabel = computed(() => props.labels[props.labels.length - 1] || '');
const prev = computed(() => Number(props.totals[props.totals.length - 2] || 0));
const pct = computed(() =>
  prev.value > 0 ? Math.round(((last.value - prev.value) / prev.value) * 100) : null
);

const points = computed(() => {
  const n = props.totals.length;
  const usable = W - PAD_X * 2;
  const step = n > 1 ? usable / (n - 1) : 0;
  return props.totals.map((t, i) => {
    const v = Number(t || 0);
    const x = PAD_X + (n > 1 ? i * step : usable / 2);
    const y = PAD_TOP + (H - PAD_TOP - PAD_BOT) * (1 - v / max.value);
    return { x, y };
  });
});

const line = computed(() => points.value.map((p) => `${p.x},${p.y}`).join(' '));
const area = computed(() => {
  if (!points.value.length) return '';
  const first = points.value[0];
  const lastP = points.value[points.value.length - 1];
  return `${line.value} ${lastP.x},${H - PAD_BOT} ${first.x},${H - PAD_BOT}`;
});
const lastPoint = computed(() => points.value[points.value.length - 1] || { x: 0, y: 0 });
</script>

<template>
  <div class="card chart-card">
    <div class="head">
      <div>
        <h3>Top-up Growth</h3>
        <div class="sub">Monthly wallet top-ups via Paystack</div>
      </div>
      <div class="stat">
        <span class="amt">₦{{ sum.toLocaleString() }}</span>
        <span v-if="pct !== null" class="pct">
          <TrendingUp :size="14" :stroke-width="2.4" />
          {{ pct }}% vs last month
        </span>
        <span v-else class="pct muted">November&ensp;•&ensp;{{ lastLabel }}</span>
      </div>
    </div>

    <div class="body">
      <svg v-if="points.length" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="chart">
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7367f0" stop-opacity="0.28" />
            <stop offset="100%" stop-color="#7367f0" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0" y1="22" x2="620" y2="22"
          stroke="#f0eef2" stroke-width="1" stroke-dasharray="4 5"
        />
        <line
          x1="0" y1="110" x2="620" y2="110"
          stroke="#f0eef2" stroke-width="1" stroke-dasharray="4 5"
        />
        <polygon :points="area" fill="url(#revFill)" />
        <polyline :points="line" fill="none" stroke="#7367f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle :cx="lastPoint.x" :cy="lastPoint.y" r="3" fill="#fff" stroke="#7367f0" stroke-width="2.5" />
      </svg>
      <div v-else class="loading">No payment data yet</div>
      <div v-if="labels.length" class="axis">
        <span v-for="(l, i) in labels" :key="i" :class="{ strong: i === labels.length - 1 }">{{ l }}</span>
      </div>
    </div>

    <div class="legend">
      <span class="dot" />
      Revenue
      <span class="total">Last month: ₦{{ last.toLocaleString() }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart-card { padding: 22px 24px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.head h3 { font-size: 16px; font-weight: 700; }
.sub { color: var(--muted); font-size: 12px; margin-top: 3px; }
.stat { text-align: right; }
.amt { display: block; color: var(--heading); font-size: 17px; font-weight: 700; }
.pct {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
  font-size: 12px;
  font-weight: 700;
  margin-top: 4px;
}
.pct.muted { color: var(--muted); font-weight: 500; }
.body svg { width: 100%; height: 180px; display: block; }
.axis { display: flex; justify-content: space-between; margin-top: 10px; }
.axis span { color: var(--muted); font-size: 11.5px; font-weight: 500; }
.axis span.strong { color: var(--heading); font-weight: 700; }
.legend { display: flex; align-items: center; gap: 7px; margin-top: 16px; color: var(--text); font-size: 12px; }
.dot { width: 9px; height: 9px; border-radius: 3px; background: var(--primary); }
.total { color: var(--muted); margin-left: auto; }
</style>