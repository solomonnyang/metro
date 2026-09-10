import { createRouter, createWebHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import AppLayout from './views/AppLayout.vue';
import DashboardView from './views/DashboardView.vue';
import UsersView from './views/UsersView.vue';
import PaymentsView from './views/PaymentsView.vue';
import SettingsView from './views/SettingsView.vue';
import { isAuthenticated } from './api.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard', crumb: 'Dashboards' } },
        { path: 'users', name: 'users', component: UsersView, meta: { title: 'Users', crumb: 'Management' } },
        { path: 'payments', name: 'payments', component: PaymentsView, meta: { title: 'Payments', crumb: 'Billing' } },
        { path: 'settings', name: 'settings', component: SettingsView, meta: { title: 'Settings', crumb: 'General' } }
      ]
    }
  ]
});

router.beforeEach((to) => {
  if (to.name !== 'login' && !isAuthenticated()) return { name: 'login' };
  if (to.name === 'login' && isAuthenticated()) return { name: 'dashboard' };
});

export default router;