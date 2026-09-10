<script setup>
defineProps({
  icon: String,
  value: [String, Number],
  label: String,
  green: Boolean
});
</script>

<template>
  <div class="stat-card">
    <div class="ic">{{ icon }}</div>
    <div class="val" :class="{ green }">{{ value }}</div>
    <div class="lbl">{{ label }}</div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
}
.ic { font-size: 20px; margin-bottom: 10px; }
.val { font-size: 26px; font-weight: 800; color: #fff; }
.val.green { color: var(--green); }
.lbl { font-size: 12px; color: var(--muted); margin-top: 4px; font-weight: 500; }
</style>