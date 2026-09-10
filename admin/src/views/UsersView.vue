<script setup>
import { ref, inject, watch, onMounted } from 'vue';
import { CheckCircle2 } from 'lucide-vue-next';
import { getUsers, patchUser, deleteUser } from '../api.js';
import UsersDataTable from '../components/UsersDataTable.vue';
import UserDetailModal from '../components/UserDetailModal.vue';

const users = ref([]);
const paging = ref({ page: 1, limit: 10, total: 0, totalPages: 0 });
const loadingUsers = ref(false);
const busyId = ref(null);
const detailUser = ref(null);
const toast = ref(null);
let toastTimer = null;
let searchTimer = null;
let searchTerm = '';

const refreshSeq = inject('refreshSeq');
const notify = inject('notify');

const showToast = (msg) => {
  toast.value = { msg };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2500);
};

const loadUsers = async () => {
  loadingUsers.value = true;
  try {
    const data = await getUsers({ page: paging.value.page, limit: paging.value.limit, search: searchTerm });
    users.value = data.users;
    paging.value = data.pagination;
  } finally {
    loadingUsers.value = false;
  }
};

const onSearch = (q) => {
  searchTerm = q;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    paging.value.page = 1;
    loadUsers();
  }, 350);
};

const changePage = (delta) => {
  paging.value.page += delta;
  loadUsers();
};

const toggleActive = async (user) => {
  busyId.value = user.id;
  try {
    const res = await patchUser(user.id, { isActive: !user.isActive });
    user.isActive = res.user.isActive;
    showToast(`User ${user.isActive ? 'activated' : 'deactivated'}`);
    notify();
  } catch (e) {
    showToast(e.message);
  } finally {
    busyId.value = null;
  }
};

const removeUser = async (user) => {
  busyId.value = user.id;
  try {
    await deleteUser(user.id);
    showToast('User deleted');
    notify();
  } catch (e) {
    showToast(e.message);
  } finally {
    busyId.value = null;
  }
};

const handleChanged = (updated) => {
  if (updated.deleted) {
    showToast('User deleted');
    loadUsers();
  } else {
    const idx = users.value.findIndex((u) => u.id === updated.id);
    if (idx !== -1) users.value[idx].isActive = updated.isActive;
  }
  notify();
};

onMounted(loadUsers);
watch(refreshSeq, loadUsers);
</script>

<template>
  <UsersDataTable
    @search="onSearch"
    @page="changePage"
    @view="detailUser = $event"
    @toggle="toggleActive"
    @remove="removeUser"
    :users="users"
    :total="paging.total"
    :page="paging.page"
    :total-pages="paging.totalPages"
    :loading="loadingUsers"
    :busy="busyId"
  />

  <UserDetailModal v-if="detailUser" :user="detailUser" @close="detailUser = null" @changed="handleChanged" />

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