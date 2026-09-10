<script setup>
import { ref, computed, onMounted } from 'vue';
import {
  CreditCard, MessageCircle, KeyRound, Server, Globe, ShieldCheck, UserCog, CheckCircle2, XCircle, Loader2
} from 'lucide-vue-next';
import { getConfig } from '../api.js';

const config = ref(null);

onMounted(async () => {
  config.value = (await getConfig()).config;
});

const maskedKey = computed(() => config.value?.paystackPublicKey || 'Not configured');
const secretOk = computed(() => !!config.value?.webhookSecretConfigured);
</script>

<template>
  <div v-if="!config" class="loading">
    <Loader2 :size="22" class="spin" />
    <p>Loading settings…</p>
  </div>

  <div v-else class="settings">
    <div class="card">
      <div class="sec-head">
        <div class="icon primary"><MessageCircle :size="20" :stroke-width="2" /></div>
        <div>
          <h3>Telegram bot</h3>
          <div class="sub">The bot users interact with</div>
        </div>
      </div>
      <div class="kv"><span>Bot username</span><a :href="config.botLink" target="_blank" rel="noopener">@{{ config.botUsername || 'Not configured' }}</a></div>
      <div class="kv"><span>Deep link</span><span class="mono">{{ config.botLink || '—' }}</span></div>
    </div>

    <div class="card">
      <div class="sec-head">
        <div class="icon success"><CreditCard :size="20" :stroke-width="2" /></div>
        <div>
          <h3>Paystack integration</h3>
          <div class="sub">Payment processor status</div>
        </div>
      </div>
      <div class="kv"><span>Public key</span><span class="mono">{{ maskedKey }}</span></div>
      <div class="kv">
        <span>Secret key</span>
        <span class="badge" :class="config.paystackSecretConfigured ? 'success' : 'danger'">{{ config.paystackSecretConfigured ? 'Configured' : 'Missing' }}</span>
      </div>
      <div class="kv">
        <span>Webhook secret</span>
        <span class="badge" :class="secretOk ? 'success' : 'warning'">{{ secretOk ? 'Configured' : 'Using placeholder' }}</span>
      </div>
      <div class="kv"><span>Webhook endpoint</span><span class="mono">{{ config.webhookUrl }}</span></div>
      <p class="hint" v-if="!secretOk">
        Set the real webhook secret from your Paystack dashboard and point the webhook URL to <b>your server host + {{ config.webhookUrl }}</b>.
      </p>
    </div>

    <div class="card">
      <div class="sec-head">
        <div class="icon warning"><KeyRound :size="20" :stroke-width="2" /></div>
        <div>
          <h3>Administration</h3>
          <div class="sub">Who manages the dashboard</div>
        </div>
      </div>
      <div class="kv"><span>Admin username</span><span class="mono">{{ config.adminUsername }}</span></div>
      <div class="kv"><span>Access</span><span class="badge primary">x-admin-token</span></div>
    </div>

    <div class="card">
      <div class="sec-head">
        <div class="icon info"><Server :size="20" :stroke-width="2" /></div>
        <div>
          <h3>Environment</h3>
          <div class="sub">Runtime information</div>
        </div>
      </div>
      <div class="kv"><span>Platform</span><span class="mono">{{ config.platform }}</span></div>
      <div class="kv"><span>Node.js</span><span class="mono">{{ config.nodeVersion }}</span></div>
      <div class="kv"><span>Server time</span><span>{{ new Date(config.serverTime).toLocaleString('en-GB') }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.card { padding: 22px 24px; }
.sec-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.sec-head h3 { font-size: 15.5px; font-weight: 700; }
.sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  flex-shrink: 0;
}
.icon.primary { background: var(--primary-soft); color: var(--primary); }
.icon.success { background: var(--success-soft); color: var(--success); }
.icon.warning { background: var(--warning-soft); color: var(--warning); }
.icon.info { background: var(--info-soft); color: var(--info); }

.kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-size: 13px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border);
}
.kv:last-of-type { border-bottom: none; }
.kv span:first-child { color: var(--muted); font-weight: 500; }
.kv a { color: var(--primary); font-weight: 600; }
.mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11.5px; color: var(--text); word-break: break-all; text-align: right; }
.hint { margin-top: 12px; color: var(--muted); font-size: 12px; line-height: 1.55; background: var(--warning-soft); color: var(--warning); padding: 10px 12px; border-radius: 8px; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>