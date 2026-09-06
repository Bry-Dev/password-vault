import { createRouter, createWebHistory } from 'vue-router'
import SetupView from '@/views/SetupView.vue'
import UnlockView from '@/views/UnlockView.vue'
import VaultView from '@/views/VaultView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/unlock' },
    { path: '/setup', component: SetupView },
    { path: '/unlock', component: UnlockView },
    { path: '/vault', component: VaultView },
    { path: '/:pathMatch(.*)*', redirect: '/unlock' },
  ],
})
