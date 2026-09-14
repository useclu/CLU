import * as htmlToImage from 'html-to-image'
import { useToast } from 'primevue/usetoast'

export default function useExportMap() {
  const toast = useToast()

  let exporting = false

  function createExportLoader() {
    const overlay = document.createElement('div')

    overlay.setAttribute('role', 'status')
    overlay.setAttribute('aria-live', 'polite')

    Object.assign(
      overlay.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '999999',

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        background: 'rgba(0, 0, 0, 0.38)',

        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',

        cursor: 'wait',
      },
    )

    const card = document.createElement('div')

    Object.assign(
      card.style,
      {
        display: 'flex',
        flexDirection: 'column',

        alignItems: 'center',
        justifyContent: 'center',

        gap: '0.9rem',

        width: 'min(90vw, 390px)',

        padding: '1.6rem 1.8rem',

        borderRadius: '14px',

        background:
          'var(--p-content-background, white)',

        color:
          'var(--p-text-color, #222)',

        boxShadow:
          '0 15px 45px rgba(0, 0, 0, 0.30)',

        fontFamily: 'inherit',

        textAlign: 'center',
      },
    )

    /*
     * =======================================================
     * PETIT CAFÉ CLU
     * =======================================================
     */

    const coffeeArea =
      document.createElement('div')

    Object.assign(
      coffeeArea.style,
      {
        position: 'relative',

        width: '70px',
        height: '65px',

        display: 'flex',

        alignItems: 'flex-end',
        justifyContent: 'center',
      },
    )

    const coffee =
      document.createElement('div')

    coffee.textContent = '☕'

    Object.assign(
      coffee.style,
      {
        position: 'relative',

        zIndex: '2',

        fontSize: '2.8rem',

        lineHeight: '1',

        transformOrigin: 'center bottom',
      },
    )

    /*
     * Petit mouvement de tasse.
     */
    coffee.animate(
      [
        {
          transform:
            'translateY(0) rotate(-2deg)',
        },
        {
          transform:
            'translateY(-4px) rotate(2deg)',
        },
        {
          transform:
            'translateY(0) rotate(-2deg)',
        },
      ],
      {
        duration: 1600,
        iterations: Infinity,
        easing: 'ease-in-out',
      },
    )

    /*
     * =======================================================
     * VAPEUR
     * =======================================================
     */

    const steamContainer =
      document.createElement('div')

    Object.assign(
      steamContainer.style,
      {
        position: 'absolute',

        top: '0',
        left: '50%',

        width: '36px',
        height: '30px',

        transform: 'translateX(-50%)',

        pointerEvents: 'none',
      },
    )

    const createSteam = (
      offset: number,
      delay: number,
    ) => {
      const steam =
        document.createElement('div')

      steam.textContent = '~'

      Object.assign(
        steam.style,
        {
          position: 'absolute',

          left: `${offset}px`,
          bottom: '0',

          fontSize: '1.25rem',
          fontWeight: '700',

          opacity: '0',

          color:
            'var(--p-text-muted-color, #888)',
        },
      )

      steam.animate(
        [
          {
            transform:
              'translateY(8px) scale(0.8)',
            opacity: 0,
          },
          {
            opacity: 0.8,
            offset: 0.25,
          },
          {
            transform:
              'translateY(-18px) scale(1.15)',
            opacity: 0,
          },
        ],
        {
          duration: 1800,
          delay,
          iterations: Infinity,
          easing: 'ease-out',
        },
      )

      steamContainer.append(steam)
    }

    createSteam(2, 0)
    createSteam(14, 550)
    createSteam(25, 1000)

    coffeeArea.append(
      steamContainer,
      coffee,
    )

    /*
     * =======================================================
     * TITRE
     * =======================================================
     */

    const title =
      document.createElement('div')

    title.textContent =
      'Exportation de votre plan'

    Object.assign(
      title.style,
      {
        fontSize: '1.05rem',
        fontWeight: '700',
      },
    )

    /*
     * =======================================================
     * MESSAGE PRINCIPAL
     * =======================================================
     */

    const description =
      document.createElement('div')

    description.textContent =
      'Votre plan est actuellement en cours d’exportation au format PNG.'

    Object.assign(
      description.style,
      {
        fontSize: '0.9rem',

        lineHeight: '1.5',

        opacity: '0.9',
      },
    )

    /*
     * =======================================================
     * AVERTISSEMENT
     * =======================================================
     */

    const warning =
      document.createElement('div')

    Object.assign(
      warning.style,
      {
        display: 'flex',

        alignItems: 'flex-start',

        gap: '0.6rem',

        width: '100%',

        padding: '0.75rem 0.85rem',

        boxSizing: 'border-box',

        borderRadius: '8px',

        background:
          'rgba(245, 158, 11, 0.12)',

        fontSize: '0.8rem',

        lineHeight: '1.45',

        textAlign: 'left',
      },
    )

    const warningIcon =
      document.createElement('div')

    warningIcon.textContent = '⚠️'

    Object.assign(
      warningIcon.style,
      {
        flexShrink: '0',

        fontSize: '1rem',
      },
    )

    const warningText =
      document.createElement('div')

    warningText.textContent =
      'Selon la taille de votre plan, l’opération peut prendre jusqu’à quelques minutes. La page n’a pas planté : CLU est simplement en plein travail. Merci de patienter.'

    warning.append(
      warningIcon,
      warningText,
    )

    /*
     * =======================================================
     * PETITE TOUCHE CLU
     * =======================================================
     */

    const coffeeMessage =
      document.createElement('div')

    coffeeMessage.textContent =
      'En attendant, un petit café vous est offert par les services de CLU.'

    Object.assign(
      coffeeMessage.style,
      {
        fontSize: '0.78rem',

        fontStyle: 'italic',

        opacity: '0.65',
      },
    )

    card.append(
      coffeeArea,
      title,
      description,
      warning,
      coffeeMessage,
    )

    overlay.append(card)

    document.body.append(overlay)

    return () => {
      overlay.remove()
    }
  }

  /*
   * Attend que le navigateur ait réellement eu
   * le temps d'afficher le loader avant de lancer
   * le travail lourd de génération du PNG.
   */
  async function waitForLoaderPaint() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })
  }

  async function exportMap(
    mapContainer: HTMLElement,
  ) {
    /*
     * Empêche plusieurs exportations PNG
     * simultanées.
     */
    if (exporting) {
      return
    }

    exporting = true

    const removeLoader =
      createExportLoader()

    try {
      /*
       * Le loader est d'abord rendu à l'écran.
       */
      await waitForLoaderPaint()

      /*
       * Puis seulement commence l'export.
       */
      const blob =
        await htmlToImage.toBlob(
          mapContainer,
          {
            pixelRatio: 4,

            canvasWidth:
              mapContainer.clientWidth,

            canvasHeight:
              mapContainer.clientHeight,

            filter: element =>
              !element.className
                ?.toString()
                ?.includes(
                  'export-hide',
                ),
          },
        )

      if (blob === null) {
        throw new Error(
          'Failed to export map',
        )
      }

      const url =
        URL.createObjectURL(blob)

      const a =
        document.createElement('a')

      a.href = url
      a.download = 'map.png'

      document.body.append(a)

      a.click()

      a.remove()

      /*
       * Petit délai avant de libérer l'URL
       * pour une meilleure compatibilité
       * entre navigateurs.
       */
      window.setTimeout(
        () => {
          URL.revokeObjectURL(url)
        },
        1000,
      )

      toast.add({
        summary:
          'ui.toasts.export.success.title',

        detail:
          'ui.toasts.export.success.detail',

        severity: 'success',

        life: 5000,
      })
    }
    catch (err) {
      console.error(err)

      toast.add({
        summary:
          'ui.toasts.export.failure.title',

        detail:
          'ui.toasts.export.failure.detail',

        severity: 'error',

        life: 5000,
      })
    }
    finally {
      removeLoader()

      exporting = false
    }
  }

  return exportMap
}