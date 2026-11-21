import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// The service worker is registered by UpdateBanner (prompt mode, never auto-reloads).
createApp(App).use(createPinia()).use(router).mount('#app')
