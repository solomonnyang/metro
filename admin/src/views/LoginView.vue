<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login, setToken } from '../api.js';

const router = useRouter();
const password = ref('');
const busy = ref(false);
const error = ref('');

const submit = async () => {
  busy.value = true;
  error.value = '';
  try {
    const token = await login(password.value);
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
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo">⚡</div>
      <h1>MetroElectric</h1>
      <p>Admin dashboard</p>
      <form @submit.prevent="submit">
        <label for="pw">Password</label>
        <input id="pw" type="password" v-model="password" autofocus placeholder="Enter admin password" />
        <button type="submit" class="btn" :disabled="busy || !password">
          {{ busy ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
      <div v-if="error" class="login-error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(1000px 500px at 50% -10%, #172a5c 0%, #0b1120 60%);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 40px 34px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, .5);
}
.logo { font-size: 44px; text-align: center; margin-bottom: 12px; }
h1 { text-align: center; font-size: 22px; font-weight: 800; color: #fff; }
p { text-align: center; color: var(--muted); font-size: 13px; margin: 6px 0 28px; }
label { display: block; color: #9aa9c9; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
input {
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--border-2);
  color: #fff;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 15px;
  margin-bottom: 18px;
  transition: border-color .15s;
}
input:focus { outline: none; border-color: var(--accent); }
.btn {
  width: 100%;
  background: linear-gradient(90deg, var(--accent), #229ed9);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  padding: 13px;
  border-radius: 10px;
  transition: opacity .15s;
}
.btn:disabled { opacity: .55; cursor: not-allowed; }
.login-error { color: var(--red); font-size: 13px; margin-top: 12px; text-align: center; }
</style>