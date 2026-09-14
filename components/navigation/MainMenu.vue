<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OpenPresetButton from '~/components/navigation/menu/OpenPresetButton.vue'
import useLoadProject from '~/composables/useLoadProject'
import { useProject } from '~/stores/useProject'

const emit = defineEmits<{
  openCustomIndices: []
  openModePictograms: []
  openSave: []
}>()

const { reset } = useProject()

const importProject = useLoadProject()

const confirm = useConfirm()
const { t } = useI18n()

/*
 * =========================================================
 * PROFIL CLU
 * =========================================================
 *
 * Le profil permet de transférer les données personnelles
 * locales de CLU vers un autre navigateur / ordinateur.
 */

const PROFILE_TYPE = 'CLU_PROFILE'
const PROFILE_VERSION = 1

const PROFILE_FIXED_STORAGE_KEYS = [
  'project',
  'customLineIndices',
  'snow',
  'color-scheme',
] as const

const PROFILE_STORAGE_PREFIXES = [
  'clu-',
  'clu.',
] as const

interface CluProfile {
  type: typeof PROFILE_TYPE
  profileVersion: number
  exportedAt: string
  storage: Record<string, string>
}

const profileImportInput =
  ref<HTMLInputElement | null>(null)

/*
 * Détermine si une clé localStorage appartient à CLU.
 */
function isProfileStorageKey(
  key: string,
) {
  if (
    PROFILE_FIXED_STORAGE_KEYS.some(
      storageKey =>
        storageKey === key,
    )
  ) {
    return true
  }

  return PROFILE_STORAGE_PREFIXES.some(
    prefix =>
      key.startsWith(prefix),
  )
}

/*
 * Récupère toutes les clés CLU actuellement présentes.
 */
function getProfileStorageKeys() {
  const keys =
    new Set<string>(
      PROFILE_FIXED_STORAGE_KEYS,
    )

  for (
    let index = 0;
    index < localStorage.length;
    index++
  ) {
    const key =
      localStorage.key(index)

    if (
      key
      && isProfileStorageKey(key)
    ) {
      keys.add(key)
    }
  }

  return Array.from(keys)
}

/*
 * =========================================================
 * EXPORT DU PROFIL
 * =========================================================
 */
function exportProfile() {
  const storage:
    Record<string, string> = {}

  for (
    const key
    of getProfileStorageKeys()
  ) {
    const value =
      localStorage.getItem(key)

    if (value !== null) {
      storage[key] = value
    }
  }

  const profile: CluProfile = {
    type: PROFILE_TYPE,
    profileVersion:
      PROFILE_VERSION,
    exportedAt:
      new Date().toISOString(),
    storage,
  }

  const blob =
    new Blob(
      [
        JSON.stringify(
          profile,
          null,
          2,
        ),
      ],
      {
        type:
          'application/json;charset=utf-8',
      },
    )

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url
  link.download = 'CLU-Profil.json'

  document.body.appendChild(link)

  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}

/*
 * =========================================================
 * IMPORT DU PROFIL
 * =========================================================
 */
function openProfileImport() {
  profileImportInput.value?.click()
}

function parseProfile(
  content: string,
): CluProfile | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  }
  catch {
    return null
  }

  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
  ) {
    return null
  }

  const candidate =
    parsed as Record<string, unknown>

  if (
    candidate.type !== PROFILE_TYPE
    || candidate.profileVersion
      !== PROFILE_VERSION
  ) {
    return null
  }

  if (
    !candidate.storage
    || typeof candidate.storage
      !== 'object'
    || Array.isArray(
      candidate.storage,
    )
  ) {
    return null
  }

  const rawStorage =
    candidate.storage as
    Record<string, unknown>

  const storage:
    Record<string, string> = {}

  for (
    const [key, value]
    of Object.entries(rawStorage)
  ) {
    if (!isProfileStorageKey(key)) {
      continue
    }

    if (typeof value !== 'string') {
      return null
    }

    storage[key] = value
  }

  return {
    type: PROFILE_TYPE,
    profileVersion:
      PROFILE_VERSION,
    exportedAt:
      typeof candidate.exportedAt
        === 'string'
        ? candidate.exportedAt
        : '',
    storage,
  }
}

function applyProfile(
  profile: CluProfile,
) {
  const allKeys =
    new Set<string>([
      ...getProfileStorageKeys(),
      ...Object.keys(
        profile.storage,
      ),
    ])

  const previousStorage =
    new Map<
      string,
      string | null
    >()

  for (const key of allKeys) {
    previousStorage.set(
      key,
      localStorage.getItem(key),
    )
  }

  try {
    for (const key of allKeys) {
      localStorage.removeItem(key)
    }

    for (
      const [key, value]
      of Object.entries(
        profile.storage,
      )
    ) {
      localStorage.setItem(
        key,
        value,
      )
    }
  }
  catch (error) {
    try {
      for (const key of allKeys) {
        localStorage.removeItem(key)
      }

      for (
        const [key, value]
        of previousStorage
      ) {
        if (value !== null) {
          localStorage.setItem(
            key,
            value,
          )
        }
      }
    }
    catch {
      // Rien à faire ici.
    }

    console.error(
      'CLU profile import failed:',
      error,
    )

    window.alert(
      'Impossible d’importer ce profil CLU. '
      + 'Les données actuelles ont été conservées.',
    )

    return
  }

  window.alert(
    'Profil CLU importé avec succès.\n\n'
    + 'CLU va maintenant se recharger pour appliquer toutes les données.',
  )

  window.location.reload()
}

async function onProfileSelected(
  event: Event,
) {
  const input =
    event.target as HTMLInputElement

  const file =
    input.files?.[0]

  /*
   * Permet de sélectionner deux fois
   * le même fichier successivement.
   */
  input.value = ''

  if (!file) {
    return
  }

  let content: string

  try {
    content =
      await file.text()
  }
  catch {
    window.alert(
      'Impossible de lire ce fichier.',
    )

    return
  }

  const profile =
    parseProfile(content)

  if (!profile) {
    window.alert(
      'Ce fichier n’est pas un profil CLU valide '
      + 'ou sa version n’est pas prise en charge.',
    )

    return
  }

  confirm.require({
    header:
      'Importer le profil CLU',

    message:
      'Les données CLU actuellement enregistrées dans ce navigateur '
      + 'seront remplacées par celles du profil importé. '
      + 'Le projet courant, les indices, pictogrammes, arrêts personnels '
      + 'et préférences seront remplacés.',

    acceptProps: {
      label: 'Importer',
      severity: 'warn',
    },

    rejectProps: {
      label: 'Annuler',
      severity: 'secondary',
      text: true,
    },

    accept: () =>
      applyProfile(profile),
  })
}

/*
 * =========================================================
 * PROJET
 * =========================================================
 */
function newProject() {
  confirm.require({
    header:
      t(
        'ui.dialogs.new_project.header',
      ),

    message:
      t(
        'ui.dialogs.new_project.message',
      ),

    acceptProps: {
      label:
        t(
          'ui.dialogs.new_project.accept',
        ),

      severity: 'warn',
    },

    rejectProps: {
      label:
        t(
          'ui.dialogs.new_project.reject',
        ),

      severity: 'secondary',
      text: true,
    },

    accept: reset,
  })
}
</script>

<template>
  <div class="flex flex-col items-stretch flex-grow">
    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.custom_indices')"
      severity="secondary"
      icon="i-tabler-route"
      text
      @click="emit('openCustomIndices')"
    />

    <Button
      pt:root:class="important-justify-start"
      label="Changer les pictogrammes des modes de transport"
      severity="secondary"
      icon="i-tabler-photo-edit"
      text
      @click="emit('openModePictograms')"
    />

    <Divider />

    <input
      ref="profileImportInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onProfileSelected"
    >

    <Button
      pt:root:class="important-justify-start"
      label="Importer Profil"
      severity="secondary"
      icon="i-tabler-user-down"
      text
      @click="openProfileImport()"
    />

    <Button
      pt:root:class="important-justify-start"
      label="Exporter Profil"
      severity="secondary"
      icon="i-tabler-user-up"
      text
      @click="exportProfile()"
    />

    <Divider />

    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.new_project')"
      severity="secondary"
      icon="i-tabler-file-spark"
      text
      @click="newProject()"
    />

    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.open')"
      severity="secondary"
      icon="i-tabler-folder-open"
      text
      @click="importProject()"
    />

    <OpenPresetButton />

    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.save')"
      severity="secondary"
      icon="i-tabler-device-floppy"
      text
      @click="emit('openSave')"
    />

    <ExportPngButton />
    <ExportPdfButton />
  </div>
</template>