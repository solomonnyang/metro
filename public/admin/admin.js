const { createApp } = Vue;

const TOKEN_KEY = 'metroAdminToken';

const api = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['x-admin-token'] = token;

  const res = await fetch(`/api/admin${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
    throw new Error('Unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
  return data;
};

const naira = (n) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

createApp({
  data() {
    return {
      authed: !!localStorage.getItem(TOKEN_KEY),
      password: '',
      loginBusy: false,
      error: '',

      stats: null,
      view: 'users',

      users: [],
      paging: { page: 1, limit: 10, total: 0, totalPages: 0 },
      search: '',
      searchDebounce: null,
      loadingUsers: false,

      detail: null,
      detailBusy: false,
      busyId: null,
      toast: null
    };
  },
  computed: {
    pages() {
      const n = this.paging.totalPages || 1;
      return Array.from({ length: n }, (_, i) => i + 1);
    }
  },
  methods: {
    showToast(msg) {
      this.toast = msg;
      setTimeout(() => { this.toast = null; }, 2500);
    },

    async login() {
      this.loginBusy = true;
      this.error = '';
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: this.password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Invalid password');
        localStorage.setItem(TOKEN_KEY, data.token);
        this.authed = true;
        this.password = '';
        this.loadAll();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loginBusy = false;
      }
    },

    logout() {
      localStorage.removeItem(TOKEN_KEY);
      this.authed = false;
      window.location.reload();
    },

    async loadStats() {
      const data = await api('/stats');
      this.stats = data.stats;
    },

    async loadUsers() {
      this.loadingUsers = true;
      try {
        const qs = new URLSearchParams({
          page: this.paging.page,
          limit: this.paging.limit,
          search: this.search
        });
        const data = await api(`/users?${qs}`);
        this.users = data.users;
        this.paging = data.pagination;
      } finally {
        this.loadingUsers = false;
      }
    },

    onSearchInput() {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.paging.page = 1;
        this.loadUsers();
      }, 350);
    },

    async loadDetail(id) {
      this.detailBusy = true;
      try {
        const data = await api(`/users/${id}`);
        this.detail = data.user;
      } finally {
        this.detailBusy = false;
      }
    },

    async toggleActive(user) {
      this.busyId = user.id;
      try {
        await api(`/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !user.isActive })
        });
        user.isActive = !user.isActive;
        if (this.detail && this.detail.id === user.id) this.detail.isActive = user.isActive;
        this.showToast(`User ${user.isActive ? 'activated' : 'deactivated'}`);
        this.loadStats();
      } catch (e) {
        this.showToast(e.message);
      } finally {
        this.busyId = null;
      }
    },

    async deleteUser(user) {
      if (!confirm(`Delete ${user.firstName || user.email || 'this user'} and all their data? This cannot be undone.`)) return;
      this.busyId = user.id;
      try {
        await api(`/users/${user.id}`, { method: 'DELETE' });
        this.showToast('User deleted');
        if (this.detail && this.detail.id === user.id) this.detail = null;
        await this.loadUsers();
        await this.loadStats();
      } catch (e) {
        this.showToast(e.message);
      } finally {
        this.busyId = null;
      }
    },

    async loadAll() {
      try {
        await this.loadStats();
        await this.loadUsers();
      } catch (e) { /* 401 already handled */ }
    }
  },
  mounted() {
    if (this.authed) this.loadAll();
  },
  template: `
  <div v-if="!authed" class="login-wrap">
    <div class="login-card">
      <div class="logo">⚡</div>
      <h1>MetroElectric</h1>
      <p>Admin dashboard</p>
      <form @submit.prevent="login">
        <label>Password</label>
        <input type="password" v-model="password" autofocus placeholder="Enter admin password">
        <button class="btn" :disabled="loginBusy">{{ loginBusy ? 'Signing in...' : 'Sign In' }}</button>
      </form>
      <div v-if="error" class="login-error">{{ error }}</div>
    </div>
  </div>

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="brand"><span>⚡</span> MetroElectric</div>
      <button class="side-item" :class="{active: view==='users'}" @click="view='users'">👥 Users</button>
      <button class="side-item logout" @click="logout">⎋ Sign out</button>
    </aside>

    <main class="main">
      <div class="topbar">
        <div>
          <h2>Users</h2>
          <div class="sub">Manage customers who interact with the bot</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="ic">👥</div><div class="val">{{ stats?.totalUsers ?? '—' }}</div><div class="lbl">Total users</div></div>
        <div class="stat-card"><div class="ic">✅</div><div class="val green">{{ stats?.activeUsers ?? '—' }}</div><div class="lbl">Active users</div></div>
        <div class="stat-card"><div class="ic">🔌</div><div class="val">{{ stats?.totalAccounts ?? '—' }}</div><div class="lbl">Meter accounts</div></div>
        <div class="stat-card"><div class="ic">📄</div><div class="val">{{ stats?.pendingBills ?? '—' }}</div><div class="lbl">Pending bills</div></div>
        <div class="stat-card"><div class="ic">💳</div><div class="val">{{ stats?.successfulPayments ?? '—' }}</div><div class="lbl">Paid transactions</div></div>
        <div class="stat-card"><div class="ic">💰</div><div class="val green">{{ naira(stats?.revenue) }}</div><div class="lbl">Total revenue</div></div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <input v-model="search" @input="onSearchInput" placeholder="🔍  Search name, username, email, phone, Telegram ID...">
        </div>
        <div v-if="loadingUsers" class="loading">Loading users...</div>
        <div v-else-if="users.length === 0" class="empty">No users found</div>
        <table v-else>
          <thead>
            <tr>
              <th>User</th><th>Telegram</th><th>Contact</th><th>Meters</th><th>Payments</th><th>Total spent</th><th>Status</th><th>Joined</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td><strong style="color:#fff">{{ u.firstName }} {{ u.lastName }}</strong></td>
              <td><span style="color:#2aabee">@{{ u.username || '—' }}</span> <span style="color:#7c8db3">({{ u.telegramId }})</span></td>
              <td>{{ u.email || '—' }}<br><span style="color:#7c8db3;font-size:12px">{{ u.phone || '' }}</span></td>
              <td>{{ u.accountCount }}</td>
              <td>{{ u.paymentCount }}</td>
              <td style="color:#34d399;font-weight:700">{{ naira(u.totalSpent) }}</td>
              <td><span class="badge" :class="u.isActive ? 'active' : 'inactive'">{{ u.isActive ? 'Active' : 'Inactive' }}</span></td>
              <td style="color:#7c8db3;font-size:12px">{{ fmtDate(u.createdAt) }}</td>
              <td>
                <button class="btn-sm" @click="loadDetail(u.id)">View</button>
                <button class="btn-sm" :class="u.isActive ? 'danger' : 'success'" :disabled="busyId===u.id" @click="toggleActive(u)">{{ u.isActive ? 'Deactivate' : 'Activate' }}</button>
                <button class="btn-sm danger" :disabled="busyId===u.id" @click="deleteUser(u)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="paging">
          <span>Showing {{ users.length }} of {{ paging.total }} users</span>
          <div class="btns">
            <button :disabled="paging.page<=1" @click="paging.page--; loadUsers()">← Prev</button>
            <span style="margin:0 8px">Page {{ paging.page }} / {{ paging.totalPages || 1 }}</span>
            <button :disabled="paging.page>=paging.totalPages" @click="paging.page++; loadUsers()">Next →</button>
          </div>
        </div>
      </div>
    </main>
  </div>

  <div v-if="detail" class="overlay" @click.self="detail=null">
    <div class="modal">
      <button class="close" @click="detail=null">✕</button>
      <h3>{{ detail.firstName }} {{ detail.lastName }}</h3>
      <div class="idline">@{{ detail.username || 'no username' }} · User ID {{ detail.id }}</div>

      <div class="mod-col">
        <h4>Details</h4>
        <div class="kv"><b>Telegram ID</b><span>{{ detail.telegramId }}</span></div>
        <div class="kv"><b>Email</b><span>{{ detail.email || '—' }}</span></div>
        <div class="kv"><b>Phone</b><span>{{ detail.phone || '—' }}</span></div>
        <div class="kv"><b>Status</b><span><span class="badge" :class="detail.isActive ? 'active' : 'inactive'">{{ detail.isActive ? 'Active' : 'Inactive' }}</span></span></div>
        <div class="kv"><b>Joined</b><span>{{ fmtDate(detail.createdAt) }}</span></div>
        <div class="kv"><b>Last activity</b><span>{{ fmtDate(detail.lastInteraction) }}</span></div>
      </div>

      <div class="mod-col">
        <h4>Meter accounts ({{ (detail.accounts || []).length }})</h4>
        <p v-if="!detail.accounts || detail.accounts.length === 0" class="empty" style="padding:14px">No meter accounts</p>
        <table v-else class="mini-table">
          <thead><tr><th>Meter</th><th>Name</th><th>Type</th><th>Disco</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="a in detail.accounts" :key="a.id">
              <td>{{ a.meterNumber }}</td><td>{{ a.accountName }}</td><td>{{ a.accountType }}</td>
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
          <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Token</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="p in detail.payments" :key="p.id">
              <td style="color:#2aabee">{{ p.paystackReference }}</td>
              <td style="font-weight:600;color:#34d399">{{ naira(p.amount) }}</td>
              <td><span class="badge" :class="p.status==='success' ? 'active' : 'inactive'">{{ p.status }}</span></td>
              <td style="font-size:12px;color:#7c8db3">{{ p.bill?.token || '—' }}</td>
              <td style="font-size:12px;color:#7c8db3">{{ fmtDate(p.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button class="btn-accent" @click="toggleActive(detail)">{{ detail.isActive ? 'Deactivate user' : 'Activate user' }}</button>
        <button class="btn-danger" @click="deleteUser(detail)">Delete user</button>
        <button class="btn-outline" @click="detail=null">Close</button>
      </div>
    </div>
  </div>

  <div v-if="toast" class="toast">{{ toast }}</div>
  `
}).mount('#app');