import ViteYaml from '@modyfi/vite-plugin-yaml'
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'

const customTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}',
    },
  },
})

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      cluApiBaseUrl: 'https://api.useclu.pro',
      cluGoogleClientId: '451693879310-tq2mti1fbrpqnaut77mu4u83pkb2pdmu.apps.googleusercontent.com',
    },
  },

  app: {
    head: {
      title: 'CLU • Créateur de lignes urbaines',

      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: './favicon.ico',
        },
      ],

    },
  },

  imports: {
    autoImport: false,
  },

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  typescript: {
    tsConfig: {
      compilerOptions: {
        moduleResolution: 'bundler',
      },
    },
  },

  build: {
    transpile: ['vue-i18n'],
  },

  vite: {
    server: {
      proxy: {
        '/clu-api': {
          target: 'https://api.useclu.pro',
          changeOrigin: true,
          secure: true,
          rewrite: path => path.replace(/^\/clu-api/, ''),
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => {
              // En développement, le navigateur envoie Origin: http://localhost:....
              // Le Worker CLU refuse volontairement cette origine. Comme /clu-api
              // est un proxy local same-origin, on retire Origin avant le transfert.
              proxyReq.removeHeader('origin')
            })
          },
        },
      },
    },

    vue: {
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    },

    plugins: [
      ViteYaml(),
    ],

    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  },

  experimental: {
    typedPages: true,
  },

  ssr: false,

  css: [
    '@unocss/reset/tailwind-compat.css',
    '~/assets/style/custom.css',
  ],

  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@nuxtjs/critters',
    '@nuxtjs/color-mode',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@primevue/nuxt-module',
    '@nuxt/fonts',
    '@le-pepe/nuxt-snow-effect',
  ],

  fonts: {
    // Les familles sont déclarées directement dans le CSS de CLU.
    // Évite que @nuxt/fonts interprète des variables comme --font-size
    // comme des noms de familles à résoudre auprès d'un provider.
    processCSSVariables: false,
  },

  colorMode: {
    preference: 'system',
    fallback: 'light',
    classPrefix: '',
    classSuffix: '-mode',
    storageKey: 'color-scheme',
  },

  primevue: {
    options: {
      theme: {
        preset: customTheme,
        options: {
          darkModeSelector: '.dark-mode',
        },
      },
    },

    importPT: {
      as: 'Passthrough',
      from: '/utils/passthrough.ts',
    },
  },

  compatibilityDate: '2024-07-20',
})