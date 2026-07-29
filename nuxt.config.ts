// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SSR is Nuxt's default; stated explicitly per the plan.
  ssr: true,

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/ui',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
  ],

  // Serve Phosphor icons locally via the bundled `ph` collection.
  icon: {
    serverBundle: {
      collections: ['ph'],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
