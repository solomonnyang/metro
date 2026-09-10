<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { X, Phone, Mail, Hash, CalendarDays, Activity, UserCheck, UserX, Trash2, CheckCircle2 } from 'lucide-vue-next';
import { getUserDetail, patchUser, deleteUser } from '../api.js';
import { initials, avatarColor } from '../utils/avatar.js';

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

const fullName = computed(() =>
  `${(detail.value?.firstName || '')} ${(detail.value?.lastName || '')}`.trim() || detail.value?.username || 'User'
);

const load = async () => {
  detail.value = (await getUserDetail(props.user.id)).user;
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

const ok = (s) => s === 'success' || s === 'paid' || s === true;

onMounted(load);
watch(() => props.user.id, load);
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <button class="close icon-btn" @click="emit('close')"><X :size="18" :stroke-width="2" /></button>

      <div v-if="!detail" class="loading">Loading user…</div>
      <template v-else>
        <div class="profile-head">
          <div
            class="avatar big"
            :style="{ background: avatarColor(fullName) + '22', color: avatarColor(fullName) }"
          >
            {{ initials(fullName) }}
          </div>
          <div class="muted-wrap">
            <h3>{{ fullName }}</h3>
            <div class="idline">@{{ detail.username || 'no username' }} · {{ detail.id }}</div>
            <div class="status-row">
              <span class="badge" :class="detail.isActive ? 'success' : 'danger'">
                {{ detail.isActive ? 'Active' : 'Inactive' }}
              </span>
              <span class="badge primary">{{ (detail.accounts || []).length }} meters</span>
              <span class="badge info">{{ (detail.payments || []).length }} payments</span>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="mod-col">
            <h4>Contact details</h4>
            <div class="kv"><Hash :size="14" :stroke-width="2" /><span><b>Telegram ID</b>{{ detail.telegramId }}</span></div>
            <div class="kv"><Mail :size="14" :stroke-width="2" /><span><b>Email</b>{{ detail.email || '—' }}</span></div>
            <div class="kv"><Phone :size="14" :stroke-width="2" /><span><b>Phone</b>{{ detail.phone || '—' }}</span></div>
            <div class="kv"><CalendarDays :size="14" :stroke-width="2" /><span><b>Joined</b>{{ fmtDate(detail.createdAt) }}</span></div>
            <div class="kv"><Activity :size="14" :stroke-width="2" /><span><b>Last activity</b>{{ fmtDate(detail.lastInteraction) }}</span></div>
          </div>
        </div>

        <div class="mod-col">
          <h4>Meter accounts ({{ (detail.accounts || []).length }})</h4>
          <p v-if="!detail.accounts || detail.accounts.length === 0" class="empty">No meter accounts yet</p>
          <table v-else class="mini-table">
            <thead>
              <tr><th>Meter</th><th>Name on account</th><th>Type</th><th>Disco</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in detail.accounts" :key="a.id">
                <td class="mono">{{ a.meterNumber }}</td>
                <td>{{ a.accountName }}</td>
                <td class="cap">{{ a.accountType }}</td>
                <td>{{ a.distributionCompany }}</td>
                <td><span class="badge" :class="a.isActive ? 'success' : 'danger'">{{ a.isActive ? 'Active' : 'Inactive' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mod-col">
          <h4>Recent payments ({{ (detail.payments || []).length }})</h4>
          <p v-if="!detail.payments || detail.payments.length === 0" class="empty">No payments yet</p>
          <table v-else class="mini-table">
            <thead>
              <tr><th>Reference</th><th>Amount</th><th>Status</th><th>Token</th><th>Date</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in detail.payments" :key="p.id">
                <td class="mono py">{{ p.paystackReference }}</td>
                <td class="amt">{{ naira(p.amount) }}</td>
                <td><span class="badge" :class="ok(p.status) ? 'success' : 'danger'">{{ p.status }}</span></td>
                <td class="tkn">{{ p.bill?.token || '—' }}</td>
                <td class="muted-txt">{{ fmtDate(p.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="actions">
          <button class="btn btn-primary" :disabled="busy" @click="toggleActive">
            <component :is="detail.isActive ? UserX : UserCheck" :size="16" :stroke-width="2" />
            {{ detail.isActive ? 'Deactivate user' : 'Activate user' }}
          </button>
          <button class="btn btn-danger" :disabled="busy" @click="remove">
            <Trash2 :size="16" :stroke-width="2" />
            Delete user
          </button>
          <button class="btn btn-outline" @click="emit('close')">
            <CheckCircle2 :size="16" :stroke-width="2" />
            Close
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(34, 41, 47, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 40;
}
.modal {
  position: relative;
  width: 100%;
  max-width: 760px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(34, 41, 47, 0.3);
  padding: 26px 28px;
}
.close { position: absolute; top: 16px; right: 16px; }

.profile-head { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.avatar.big { width: 62px; height: 62px; font-size: 21px; border-radius: 16px; }
h3 { font-size: 19px; font-weight: 700; color: var(--heading); }
.idline { color: var(--muted); font-size: 12px; margin: 3px 0 10px; word-break: break-all; }
.status-row { display: flex; gap: 8px; flex-wrap: wrap; }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.mod-col { margin-bottom: 22px; }
.mod-col h4 {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
.kv { display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 9px; color: var(--primary); }
.kv span { color: var(--text); }
.kv b { display: inline-block; width: 108px; color: var(--muted); font-weight: 600; }
.kv span b { color: var(--muted); }

.mini-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.mini-table th, .mini-table td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.mini-table th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.mini-table tr:hover td { background: #fbfbfd; }
.mono { font-variant-numeric: tabular-nums; color: var(--primary); font-weight: 600; }
.mono.py { color: var(--text); }
.amt { color: var(--success); font-weight: 700; }
.tkn { color: var(--muted); font-size: 11.5px; }
.cap { text-transform: capitalize; }
.muted-txt { color: var(--muted); font-size: 11.5px; }

.actions { display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
.actions .btn { flex: 1; min-width: 150px; }
</style>