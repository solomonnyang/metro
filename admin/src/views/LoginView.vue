<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Zap, User, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, Users, BarChart3, KeyRound
} from 'lucide-vue-next';
import { login, setToken } from '../api.js';

const router = useRouter();
const username = ref('');
const password = ref('');
const show = ref(false);
const focusUser = ref(false);
const focusPass = ref(false);
const busy = ref(false);
const error = ref('');

const submit = async () => {
  busy.value = true;
  error.value = '';
  try {
    const token = await login(username.value.trim(), password.value);
    setToken(token);
    router.push('/');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div class="login-shell">
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>

    <div class="login-card">
      <div class="brand">
        <div class="logo"><Zap :size="20" :stroke-width="2.6" /></div>
        <span>MetroElectric</span>
      </div>

      <div class="head">
        <h1>Welcome back!</h1>
        <p>Sign in to the admin dashboard</p>
      </div>

      <form @submit.prevent="submit" novalidate>
        <label for="username">Username</label>
        <div class="field" :class="{ focus: focusUser }">
          <User :size="17" :stroke-width="2" class="ic" />
          <input
            id="username"
            type="text"
            v-model="username"
            placeholder="Enter your username"
            autocomplete="username"
            spellcheck="false"
            @focus="focusUser = true"
            @blur="focusUser = false"
          />
        </div>

        <label for="password">Password</label>
        <div class="field" :class="{ focus: focusPass }">
          <Lock :size="17" :stroke-width="2" class="ic" />
          <input
            id="password"
            :type="show ? 'text' : 'password'"
            v-model="password"
            placeholder="Enter your password"
            autocomplete="current-password"
            @focus="focusPass = true"
            @blur="focusPass = false"
            @keydown.enter="submit"
          />
          <button type="button" class="eye" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
            <component :is="show ? EyeOff : Eye" :size="17" :stroke-width="2" />
          </button>
        </div>

        <Transition name="err">
          <div v-if="error" class="error-banner">
            <AlertCircle :size="16" :stroke-width="2.2" />
            {{ error }}
          </div>
        </Transition>

        <button type="submit" class="btn btn-primary submit" :disabled="busy || !username || !password">
          <span v-if="busy" class="spinner"></span>
          <LogIn v-else :size="17" :stroke-width="2.2" />
          {{ busy ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>

      <div class="feats">
        <div class="feat"><Users :size="15" :stroke-width="2" /> Manage users &amp; meters</div>
        <div class="feat"><BarChart3 :size="15" :stroke-width="2" /> Track revenue live</div>
        <div class="feat"><KeyRound :size="15" :stroke-width="2" /> Secure admin access</div>
      </div>

      <div class="foot-note">
        <ShieldCheck :size="13" :stroke-width="2" />
        Protected area &middot; All attempts are monitored
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(700px 420px at 12% -8%, rgba(115, 103, 240, 0.12) 0%, transparent 60%),
    radial-gradient(700px 420px at 92% 108%, rgba(0, 207, 232, 0.1) 0%, transparent 60%),
    var(--body-bg);
}
.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
}
.glow-a { width: 340px; height: 340px; background: rgba(115, 103, 240, 0.14); top: -140px; left: 28%; }
.glow-b { width: 300px; height: 300px; background: rgba(0, 207, 232, 0.12); bottom: -120px; right: 20%; }

.login-card {
  position: relative;
  width: 100%;
  max-width: 430px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 34px 36px 28px;
}
.brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 26px; }
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7367f0, #9e95f5);
  color: #fff;
  box-shadow: 0 4px 12px rgba(115, 103, 240, 0.45);
}
.brand span { color: var(--heading); font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }

.head { text-align: center; margin-bottom: 26px; }
.head h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.head p { color: var(--muted); font-size: 13px; margin-top: 5px; }

form label {
  display: block;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 600;
  margin: 0 2px 7px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 13px;
  margin-bottom: 17px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.field .ic { color: var(--muted); flex-shrink: 0; }
.field input {
  flex: 1;
  background: none;
  border: none;
  color: var(--heading);
  font-size: 14px;
  padding: 12px 0;
  outline: none;
}
.field input::placeholder { color: #c9c6cf; }
.field.focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.field.focus .ic { color: var(--primary); }
.eye {
  background: none;
  border: none;
  color: var(--muted);
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.eye:hover { color: var(--primary); }

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--danger-soft);
  border: 1px solid rgba(234, 84, 85, 0.25);
  color: var(--danger);
  font-size: 13px;
  font-weight: 600;
  padding: 11px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
}
.err-enter-active, .err-leave-active { transition: opacity 0.2s, transform 0.2s; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(-4px); }

.submit {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  font-size: 14px;
}
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.feats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 22px; }
.feat {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 500;
  padding: 8px 10px;
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.feat svg { color: var(--primary); flex-shrink: 0; }

.foot-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--muted);
  font-size: 11.5px;
  margin-top: 22px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.foot-note svg { color: var(--success); }

@media (max-width: 480px) {
  .login-card { padding: 26px 20px 22px; }
}
</style>