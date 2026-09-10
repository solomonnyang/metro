<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login, setToken } from '../api.js';

const router = useRouter();
const username = ref('');
const password = ref('');
const show = ref(false);
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
    <div class="brand-panel">
      <div class="glow glow-a"></div>
      <div class="glow glow-b"></div>
      <div class="brand-inner">
        <div class="brand-logo">⚡</div>
        <h1>Metro<span>Electric</span></h1>
        <p class="tag">Admin control center for the electricity bill bot.</p>
        <ul class="feats">
          <li><span>👥</span> Manage every user &amp; meter account</li>
          <li><span>💰</span> Track revenue and payments live</li>
          <li><span>🔑</span> Toggle accounts and tokens securely</li>
        </ul>
      </div>
      <div class="brand-foot">Secure admin access · v1.0</div>
    </div>

    <div class="form-side">
      <div class="form-card">
        <div class="card-head">
          <div class="mini-bolt">⚡</div>
          <h2>Welcome back</h2>
          <p>Sign in to the MetroElectric dashboard</p>
        </div>

        <form @submit.prevent="submit" novalidate>
          <label for="username">Username</label>
          <div class="field" :class="{ focus: focusUser }">
            <span class="ic">👤</span>
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
            <span class="ic">🔒</span>
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
              {{ show ? '🙈' : '👁️' }}
            </button>
          </div>

          <Transition name="err">
            <div v-if="error" class="error-banner">⚠️ {{ error }}</div>
          </Transition>

          <button type="submit" class="submit" :disabled="busy || !username || !password">
            <span v-if="busy" class="spinner"></span>
            <span>{{ busy ? 'Signing in…' : 'Sign In →' }}</span>
          </button>
        </form>
      </div>
      <p class="foot-note">Protected area · All attempts are monitored</p>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: #070b16;
}

/* Brand panel */
.brand-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 64px;
  background:
    radial-gradient(900px 500px at 85% -5%, #143269 0%, transparent 60%),
    linear-gradient(160deg, #0f1e3f 0%, #0a142c 55%, #070b16 100%);
}
.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: .55;
}
.glow-a { width: 340px; height: 340px; background: rgba(42, 171, 238, .35); top: -120px; right: -60px; }
.glow-b { width: 260px; height: 260px; background: rgba(124, 58, 237, .3); bottom: -80px; left: -40px; }
.brand-inner { position: relative; z-index: 1; }
.brand-logo {
  width: 62px; height: 62px;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px;
  background: linear-gradient(135deg, rgba(42, 171, 238, .25), rgba(42, 171, 238, .08));
  border: 1px solid rgba(42, 171, 238, .35);
  border-radius: 16px;
  margin-bottom: 26px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, .35);
}
h1 { color: #fff; font-size: 34px; font-weight: 800; letter-spacing: -.5px; }
h1 span { color: #2aabee; }
.tag { color: #93a5c8; font-size: 15px; margin-top: 10px; max-width: 380px; line-height: 1.6; }
.feats { list-style: none; margin-top: 34px; display: grid; gap: 14px; }
.feats li {
  display: flex; align-items: center; gap: 12px;
  color: #cdd8ee; font-size: 14px; font-weight: 500;
  padding: 12px 14px;
  background: rgba(255, 255, 255, .04);
  border: 1px solid rgba(255, 255, 255, .07);
  border-radius: 12px;
}
.feats li span { font-size: 17px; }
.brand-foot { position: relative; z-index: 1; color: #54678c; font-size: 12px; letter-spacing: .04em; }

/* Form side */
.form-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: radial-gradient(600px 400px at 50% 0%, #0f1b33 0%, #070b16 60%);
}
.form-card { width: 100%; max-width: 400px; }
.card-head { margin-bottom: 28px; text-align: center; }
.mini-bolt { font-size: 26px; margin-bottom: 10px; }
.card-head h2 { color: #fff; font-size: 23px; font-weight: 800; letter-spacing: -.3px; }
.card-head p { color: var(--muted); font-size: 13px; margin-top: 6px; }

form label {
  display: block;
  color: #9aa9c9;
  font-size: 12px;
  font-weight: 600;
  margin: 0 2px 7px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(13, 21, 38, .85);
  border: 1px solid #22314f;
  border-radius: 12px;
  padding: 0 14px;
  margin-bottom: 18px;
  transition: border-color .2s, box-shadow .2s, background .2s;
}
.field .ic { font-size: 15px; opacity: .8; }
.field input {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-size: 15px;
  padding: 13px 0;
  outline: none;
}
.field input::placeholder { color: #46587d; }
.field.focus {
  border-color: #2aabee;
  background: rgba(13, 21, 38, 1);
  box-shadow: 0 0 0 4px rgba(42, 171, 238, .12);
}
.eye { background: none; border: none; font-size: 16px; padding: 4px; }

.error-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(248, 113, 113, .12);
  border: 1px solid rgba(248, 113, 113, .28);
  color: #fca5a5;
  font-size: 13px;
  font-weight: 600;
  padding: 11px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
}
.err-enter-active, .err-leave-active { transition: opacity .2s, transform .2s; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(-4px); }

.submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(90deg, #2aabee, #1f8fd4);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  padding: 14px;
  border-radius: 12px;
  margin-top: 6px;
  transition: transform .15s, box-shadow .15s, opacity .15s;
  box-shadow: 0 14px 34px rgba(42, 171, 238, .3);
}
.submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 18px 40px rgba(42, 171, 238, .4); }
.submit:disabled { opacity: .5; cursor: not-allowed; }
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255, 255, 255, .4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.foot-note { color: #46587d; font-size: 12px; margin-top: 26px; }

@media (max-width: 820px) {
  .login-shell { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
  .form-side { padding: 28px; }
}
</style>