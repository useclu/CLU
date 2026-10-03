<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsIdApi = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
  }) => void
  renderButton: (parent: HTMLElement, options: {
    type?: 'standard' | 'icon'
    theme?: 'outline' | 'filled_blue' | 'filled_black'
    size?: 'large' | 'medium' | 'small'
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
    shape?: 'rectangular' | 'pill' | 'circle' | 'square'
    logo_alignment?: 'left' | 'center'
    width?: number
  }) => void
}

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      id?: GoogleAccountsIdApi
    }
  }
}

const props = withDefaults(defineProps<{
  clientId: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  credential: [credential: string]
  error: [message: string]
}>()

const conteneur = ref<HTMLElement | null>(null)
let callbackActif: ((response: GoogleCredentialResponse) => void) | null = null
let scriptPromise: Promise<GoogleAccountsIdApi> | null = null
let clientIdInitialise: string | null = null
let callbackGlobal: ((response: GoogleCredentialResponse) => void) | null = null

function apiGoogle(): GoogleAccountsIdApi | null {
  if (typeof window === 'undefined') return null
  return (window as GoogleIdentityWindow).google?.accounts?.id ?? null
}

function chargerScriptGoogle(): Promise<GoogleAccountsIdApi> {
  const dejaCharge = apiGoogle()
  if (dejaCharge) return Promise.resolve(dejaCharge)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existant = document.querySelector<HTMLScriptElement>('script[data-clu-google-identity="true"]')
    const script = existant ?? document.createElement('script')

    const terminer = () => {
      const api = apiGoogle()
      if (api) resolve(api)
      else reject(new Error('Connexion Google indisponible.'))
    }

    const echouer = () => reject(new Error('Connexion Google indisponible.'))

    script.addEventListener('load', terminer, { once: true })
    script.addEventListener('error', echouer, { once: true })

    if (!existant) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.cluGoogleIdentity = 'true'
      document.head.appendChild(script)
    }
  }).catch((erreur) => {
    scriptPromise = null
    throw erreur
  })

  return scriptPromise
}

function assurerInitialisation(api: GoogleAccountsIdApi) {
  if (clientIdInitialise === props.clientId) return

  api.initialize({
    client_id: props.clientId,
    ux_mode: 'popup',
    callback: response => callbackGlobal?.(response),
  })

  clientIdInitialise = props.clientId
}

async function rendreBouton() {
  if (!conteneur.value || !props.clientId) return

  try {
    const api = await chargerScriptGoogle()
    if (!conteneur.value) return

    callbackActif = (response: GoogleCredentialResponse) => {
      const credential = String(response.credential || '').trim()
      if (!credential) {
        emit('error', 'Connexion Google indisponible.')
        return
      }
      emit('credential', credential)
    }
    callbackGlobal = callbackActif

    assurerInitialisation(api)
    conteneur.value.replaceChildren()
    api.renderButton(conteneur.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 280,
    })
  }
  catch {
    emit('error', 'Connexion Google indisponible.')
  }
}

onMounted(() => {
  void rendreBouton()
})

watch(() => props.clientId, () => {
  void rendreBouton()
})

onBeforeUnmount(() => {
  if (callbackGlobal === callbackActif) callbackGlobal = null
  callbackActif = null
})
</script>

<template>
  <div class="google-sign-in" :class="{ 'google-sign-in--disabled': disabled }">
    <div ref="conteneur" class="google-sign-in__host" />
  </div>
</template>

<style scoped>
.google-sign-in{display:flex;justify-content:center;min-height:44px}.google-sign-in--disabled{opacity:.48;pointer-events:none}.google-sign-in__host{display:flex;justify-content:center;min-height:44px}
</style>
