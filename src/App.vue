<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import { useVaultStore } from '@/stores/vault'

const vault = useVaultStore()
const router = useRouter()

onMounted(async () => {
  await vault.bootstrap()

  if (!vault.initialized && router.currentRoute.value.path !== '/setup') {
    await router.replace('/setup')
  }
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
