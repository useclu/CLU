import { useFileDialog } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useProjectVersionCheck } from '~/composables/useProjectVersionCheck'
import useVersion from '~/composables/useVersion'
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'
import { useProject } from '~/stores/useProject'
import { normalizeMapFontFamily } from '~/utils/mapFonts'
import { normalizeProjectForLoad } from '~/utils/projectCompatibility'

export default function useLoadProject() {
  const toast = useToast()
  const { t } = useI18n()
  const confirm = useConfirm()
  const { projectMinimumVersion } = useVersion()
  const checkVersion = useProjectVersionCheck()
  const { open, onChange } = useFileDialog({
    accept: 'application/json',
    multiple: false,
    directory: false,
    reset: true,
  })

  const lineStore = useProject()
  const { version, line, presetBased } = storeToRefs(lineStore)
  const customIndicesStore = useCustomLineIndices()
  const indicesStore = storeToRefs(customIndicesStore)

  function replaceCurrentLine(projectLine: Line) {
    const source = {
      ...projectLine,
      fontFamily:
        normalizeMapFontFamily(
          projectLine.fontFamily,
        ),
    } as unknown as Record<string, unknown>

    const target =
      line.value as unknown as
      Record<string, unknown>

    /*
     * Remplacement complet : un ancien projet ne doit jamais hériter de champs
     * laissés par le plan qui était ouvert juste avant son chargement.
     */
    for (const key of Object.keys(target)) {
      if (!(key in source)) {
        delete target[key]
      }
    }

    for (const [key, value] of Object.entries(source)) {
      target[key] = value
    }
  }

  function load(
    project: Project,
    loadCustomIndices: boolean,
    migratedLegacyProject: boolean,
  ) {
    /*
     * L'ouverture d'un fichier ne doit JAMAIS détruire silencieusement le plan
     * actuellement ouvert. On crée un snapshot avant le remplacement.
     */
    lineStore.createSafetySnapshot('manual')

    checkVersion(
      project.version,
      projectMinimumVersion,
    )

    /*
     * Les identités du fichier vivent d'abord dans le projet lui-même.
     * Elles restent donc disponibles même si l'utilisateur refuse de les
     * enregistrer dans sa bibliothèque personnelle ou les supprime plus tard.
     */
    customIndicesStore.setProjectIndices(
      project.customIndices ?? [],
    )

    replaceCurrentLine(project.line)
    presetBased.value = project.presetBased
    version.value = project.version

    if (loadCustomIndices) {
      const existingIndicesIds =
        indicesStore.indices.value
          .map(it => it.id)

      const newIndices =
        (project.customIndices ?? [])
          .filter(
            it =>
              !existingIndicesIds
                .includes(it.id),
          )

      indicesStore.indices.value.push(
        ...newIndices,
      )
    }

    /* Un fichier chargé devient le nouvel état de référence Avant/Après. */
    lineStore.clearHistory()

    toast.add({
      summary:
        t('ui.toasts.load.success.title'),
      detail:
        migratedLegacyProject
          ? 'Ancien projet CLU chargé et rendu compatible avec cette version.'
          : t('ui.toasts.load.success.detail'),
      severity: 'success',
      life: 5000,
    })
  }

  function preload(
    project: Project,
    migratedLegacyProject: boolean,
  ) {
    if ((project.customIndices ?? []).length > 0) {
      confirm.require({
        header:
          t('ui.dialogs.loading_custom_indices_prompt.header'),
        message:
          t('ui.dialogs.loading_custom_indices_prompt.message'),
        acceptLabel:
          t('ui.dialogs.loading_custom_indices_prompt.accept'),
        rejectLabel:
          t('ui.dialogs.loading_custom_indices_prompt.reject'),
        rejectProps: {
          text: true,
          severity: 'secondary',
        },
        accept: () =>
          load(
            project,
            true,
            migratedLegacyProject,
          ),
        reject: () =>
          load(
            project,
            false,
            migratedLegacyProject,
          ),
      })
    }
    else {
      load(
        project,
        false,
        migratedLegacyProject,
      )
    }
  }

  const reader = new FileReader()

  reader.onload = (ev) => {
    try {
      const parsed =
        JSON.parse(
          ev.target?.result as string,
        ) as unknown

      const normalized =
        normalizeProjectForLoad(parsed)

      preload(
        normalized.project,
        normalized.migratedLegacyProject,
      )
    }
    catch (error) {
      console.warn(error)

      /*
       * IMPORTANT : contrairement à l'ancien chargeur, une erreur d'import ne
       * remet PLUS le projet courant à zéro. L'utilisateur garde son travail.
       */
      toast.add({
        summary:
          t('ui.toasts.load.failure.title'),
        detail:
          error instanceof Error
            ? error.message
            : t('ui.toasts.load.failure.detail.corrupted'),
        severity: 'error',
        life: 7000,
      })
    }
  }

  reader.onerror = () => {
    toast.add({
      summary:
        t('ui.toasts.load.failure.title'),
      detail:
        t('ui.toasts.load.failure.detail.unreadable'),
      severity: 'error',
      life: 5000,
    })
  }

  onChange((files) => {
    if (
      files !== null
      && files.length > 0
    ) {
      reader.readAsText(files[0])
    }
  })

  return open
}
