<script setup>
import { ref, watch, onMounted } from 'vue';
import { getUserDetail, patchUser, deleteUser } from '../api.js';

const props = defineProps({
  user: { type: Object, required: true }
});
const emit = defineEmits(['close', 'changed']);

const detail = ref(null);
const busy = ref(false);

const naira = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2014';

const load = async () => {
  detail.value = await getUserDetail(props.user.id);
};

const toggleActive = async () => {
  busy.value = true;
  try {
    const res = await patchUser(detail.value.id, { isActive: !detail.value.isActive });
    detail.value.isActive = res.user.isActive;
    emit('changed', res.user);
  } finally {
    busy.value = false;
  }
};

const remove = async () => {
  if (!confirm(`Delete ${detail.value.firstName || detail.value.email} and all their data?\n\nThis cannot be undone.`)) return;
  busy.value = true;
  try {
    await deleteUser(detail.value.id);
    emit('changed', { id: detail.value.id, deleted: true });
    emit('close');
  } finally {
    busy.value = false;
  }
};

onMounted(load);
watch(() => props.user.id, load);

const status = (s) => s === 'success' || s === 'paid' || s === true;
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <button class="close" @click="emit('close')">✕</button>

      <div v-if="!detail" class="loading">Loading user...</div>
      <template v-else>
        <h3>{{ detail.firstName }} {{ detail.lastName }}</h3>
        <div class="idline">@{{ detail.username || 'no username' }} · {{ detail.id }}</div>

        <div class="mod-col">
          <h4>Details</h4>
          <div class="kv"><b>Telegram ID</b><span>{{ detail.telegramId }}</span></div>
          <div class="kv"><b>Email</b><span>{{ detail.email || '—' }}</span></div>
          <div class="kv"><b>Phone</b><span>{{ detail.phone || '—' }}</span></div>
          <div class="kv">
            <b>Status</b>
            <span><span class="badge" :class="detail.isActive ? 'active' : 'inactive'">{{ detail.isActive ? 'Active' : 'Inactive' }}</span></span>
          </div>
          <div class="kv"><b>Joined</b><span>{{ fmtDate(detail.createdAt) }}</span></div>
          <div class="kv"><b>Last activity</b><span>{{ fmtDate(detail.lastInteraction) }}</span></div>
        </div>

        <div class="mod-col">
          <h4>Meter accounts ({{ (detail.accounts || []).length }})</h4>
          <p v-if="!detail.accounts || detail.accounts.length === 0" class="empty" style="padding:14px">No meter accounts</p>
          <table v-else class="mini-table">
            <thead>
              <tr><th>Meter</th><th>Name</th><th>Type</th><th>Disco</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in detail.accounts" :key="a.id">
                <td>{{ a.meterNumber }}</td>
                <td>{{ a.accountName }}</td>
                <td>{{ a.accountType }}</td>
                <td>{{ a.distributionCompany }}</td>
                <td><span class="badge" :class="a.isActive ? 'active' : 'inactive'">{{ a.isActive ? 'Active' : 'Inactive' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mod-col">
          <h4>Recent payments ({{ (detail.payments || []).length }})</h4>
          <p v-if="!detail.payments || detail.payments.length === 0" class="empty" style="padding:14px">No payments</p>
          <table v-else class="mini-table">
            <thead>
              <tr><th>Reference</th><th>Amount</th><th>Status</th><th>Token</th><th>Date</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in detail.payments" :key="p.id">
                <td style="color:var(--accent)">{{ p.paystackReference }}</td>
                <td style="font-weight:600;color:var(--green)">{{ naira(p.amount) }}</td>
                <td><span class="badge" :class="status(p.status) ? 'active' : 'inactive'">{{ p.status }}</span></td>
                <td style="font-size:12px;color:var(--muted)">{{ p.bill?.token || '—' }}</td>
                <td style="font-size:12px;color:var(--muted)">{{ fmtDate(p.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-actions">
          <button class="btn-accent" :disabled="busy" @click="toggleActive">
            {{ detail.isActive ? 'Deactivate user' : 'Activate user' }}
          </button>
          <button class="btn-danger" :disabled="busy" @click="remove">Delete user</button>
          <button class="btn-outline" @click="emit('close')">Close</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 18, .72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 40;
}
.modal {
  width: 100%;
  max-width: 720px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border-2);
  border-radius: 16px;
  padding: 24px;
}
h3 { color: #fff; font-size: 18px; font-weight: 800; margin-bottom: 4px; }
.idline { color: var(--muted); font-size: 12px; margin-bottom: 18px; }
.close { float: right; background: none; border: none; color: var(--muted); font-size: 20px; }
.kv {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 8px 12px;
  font-size: 13px;
  margin-bottom: 6px;
}
.kv b { color: var(--muted); font-weight: 600; }
.kv span { color: #e2e8f0; }
.mod-col { margin-bottom: 20px; }
.mod-col h4 {
  color: #b9c7e8;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 10px;
}
.mini-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.mini-table th, .mini-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.mini-table th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.modal-actions { display: flex; gap: 10px; margin-top: 16px; }
.modal-actions button {
  flex: 1;
  padding: 11px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  border: none;
}
.btn-accent { background: linear-gradient(90deg, var(--accent), #229ed9); color: #fff; }
.btn-outline { background: none; color: var(--muted); border: 1px solid var(--border-2) !important; }
.btn-danger { background: rgba(248, 113, 113, .15); color: var(--red); border: 1px solid rgba(248, 113, 113, .3) !important; }
.modal-actions button:disabled { opacity: .5; cursor: not-allowed; }
</style>