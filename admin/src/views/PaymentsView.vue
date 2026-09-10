<script setup>
import { ref, inject, watch, onMounted } from 'vue';
import { CheckCircle2 } from 'lucide-vue-next';
import { getPayments } from '../api.js';
import PaymentsDataTable from '../components/PaymentsDataTable.vue';

const payments = ref([]);
const paging = ref({ page: 1, limit: 10, total: 0, totalPages: 0 });
const loading = ref(false);
const toast = ref(null);
let toastTimer = null;
let searchTimer = null;
const filters = ref({ search: '', status: '' });

const refreshSeq = inject('refreshSeq');

const showToast = (msg) => {
  toast.value = { msg };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2500);
};

const load = async () => {
  loading.value = true;
  try {
    const data = await getPayments({ ...filters.value, page: paging.value.page, limit: paging.value.limit });
    payments.value = data.payments;
    paging.value = data.pagination;
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
};

const onSearch = (q) => {
  filters.value.search = q;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    paging.value.page = 1;
    load();
  }, 350);
};

const onStatus = (s) => {
  filters.value.status = s;
  paging.value.page = 1;
  load();
};

onMounted(load);
watch(refreshSeq, load);
</script>

<template>
  <PaymentsDataTable
    :payments="payments"
    :total="paging.total"
    :page="paging.page"
    :total-pages="paging.totalPages"
    :loading="loading"
    @search="onSearch"
    @status="onStatus"
    @page="paging.page += $event; load()"
  />

  <Transition name="tst">
    <div v-if="toast" class="toast">
      <CheckCircle2 :size="16" :stroke-width="2.4" />
      {{ toast.msg }}
    </div>
  </Transition>
</template>

<style>
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
</style>