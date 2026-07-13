// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NUXT_RENDER_MODE !== 'true' },
  modules: ['@nuxt/fonts', '@nuxt/image'],
  css: ['~/assets/css/global.css', '~/assets/css/narrow-layout.css', '~/assets/css/legal.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Slot Animation Generator',
      meta: [
        {
          name: 'description',
          content: 'Four-slide slot animation generator.'
        }
      ]
    }
  }
})
