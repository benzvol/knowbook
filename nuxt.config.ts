// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SSR is Nuxt's default; stated explicitly per the plan.
  ssr: true,

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: '/favicon-32x32.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '16x16',
          href: '/favicon-16x16.png',
        },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

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
    // Bundle the icons used in the app for the browser too. Without this,
    // every client-side icon relies on a runtime request to the local API.
    clientBundle: {
      scan: true,
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
