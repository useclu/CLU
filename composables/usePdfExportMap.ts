import { navigateTo } from '#app'
import { useI18n } from 'vue-i18n'

export default function usePdfExportMap() {
  const { t } = useI18n()
  let exporting = false

  function createExportLoader() {
    const overlay =
      document.createElement('div')

    overlay.setAttribute(
      'role',
      'status',
    )

    overlay.setAttribute(
      'aria-live',
      'polite',
    )

    Object.assign(
      overlay.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '999999',

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        background:
          'rgba(0, 0, 0, 0.38)',

        backdropFilter:
          'blur(3px)',

        WebkitBackdropFilter:
          'blur(3px)',

        cursor: 'wait',
      },
    )

    const card =
      document.createElement('div')

    Object.assign(
      card.style,
      {
        display: 'flex',
        flexDirection: 'column',

        alignItems: 'center',
        justifyContent: 'center',

        gap: '0.9rem',

        width:
          'min(90vw, 390px)',

        padding:
          '1.6rem 1.8rem',

        boxSizing: 'border-box',

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
     * ANIMATION PDF
     * =======================================================
     */

    const animationArea =
      document.createElement('div')

    Object.assign(
      animationArea.style,
      {
        position: 'relative',

        width: '90px',
        height: '72px',
      },
    )

    const documentIcon =
      document.createElement('div')

    documentIcon.textContent = '📄'

    Object.assign(
      documentIcon.style,
      {
        position: 'absolute',

        left: '8px',
        top: '11px',

        fontSize: '2.7rem',

        lineHeight: '1',

        transformOrigin:
          'center center',
      },
    )

    /*
     * La feuille voyage doucement
     * vers la partie "PDF".
     */
    documentIcon.animate(
      [
        {
          transform:
            'translateX(0) rotate(-5deg)',
        },
        {
          transform:
            'translateX(28px) translateY(-5px) rotate(5deg)',
        },
        {
          transform:
            'translateX(0) rotate(-5deg)',
        },
      ],
      {
        duration: 1800,
        iterations: Infinity,
        easing: 'ease-in-out',
      },
    )

    const pdfBadge =
      document.createElement('div')

    pdfBadge.textContent = 'PDF'

    Object.assign(
      pdfBadge.style,
      {
        position: 'absolute',

        right: '0',
        bottom: '5px',

        padding:
          '0.25rem 0.4rem',

        borderRadius: '5px',

        background:
          '#d32f2f',

        color: 'white',

        fontSize: '0.68rem',
        fontWeight: '800',

        letterSpacing: '0.03em',

        boxShadow:
          '0 3px 8px rgba(0, 0, 0, 0.18)',
      },
    )

    pdfBadge.animate(
      [
        {
          transform: 'scale(1)',
        },
        {
          transform: 'scale(1.08)',
        },
        {
          transform: 'scale(1)',
        },
      ],
      {
        duration: 1200,
        iterations: Infinity,
        easing: 'ease-in-out',
      },
    )

    animationArea.append(
      documentIcon,
      pdfBadge,
    )

    /*
     * =======================================================
     * TITRE
     * =======================================================
     */

    const title =
      document.createElement('div')

    title.textContent =
      t('ui.export_overlay.pdf.title')

    Object.assign(
      title.style,
      {
        fontSize: '1.05rem',
        fontWeight: '700',
      },
    )

    /*
     * =======================================================
     * MESSAGE
     * =======================================================
     */

    const description =
      document.createElement('div')

    description.textContent =
      t('ui.export_overlay.pdf.description')

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
     * WARNING
     * =======================================================
     */

    const warning =
      document.createElement('div')

    Object.assign(
      warning.style,
      {
        display: 'flex',

        alignItems:
          'flex-start',

        gap: '0.6rem',

        width: '100%',

        padding:
          '0.75rem 0.85rem',

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
      t('ui.export_overlay.pdf.warning')

    warning.append(
      warningIcon,
      warningText,
    )

    /*
     * =======================================================
     * CAFÉ CLU
     * =======================================================
     */

    const coffeeMessage =
      document.createElement('div')

    coffeeMessage.textContent =
      t('ui.export_overlay.pdf.coffee')

    Object.assign(
      coffeeMessage.style,
      {
        fontSize: '0.78rem',

        fontStyle: 'italic',

        opacity: '0.65',
      },
    )

    card.append(
      animationArea,
      title,
      description,
      warning,
      coffeeMessage,
    )

    overlay.append(card)

    document.body.append(
      overlay,
    )

    return () => {
      overlay.remove()
    }
  }

  /*
   * Laisse réellement le navigateur afficher
   * le loader avant d'ouvrir la fenêtre PDF.
   */
  async function waitForLoaderPaint() {
    await new Promise<void>(
      (resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      },
    )

    await new Promise<void>(
      (resolve) => {
        setTimeout(
          resolve,
          100,
        )
      },
    )
  }

  /*
   * Petit délai pour éviter que le loader
   * disparaisse instantanément au moment
   * où la nouvelle fenêtre s'ouvre.
   */
  async function waitAfterOpening() {
    await new Promise<void>(
      (resolve) => {
        setTimeout(
          resolve,
          500,
        )
      },
    )
  }

  async function exportMap() {
    /*
     * Évite les doubles clics et plusieurs
     * fenêtres PDF ouvertes simultanément.
     */
    if (exporting) {
      return
    }

    exporting = true

    const removeLoader =
      createExportLoader()

    try {
      /*
       * On affiche d'abord réellement
       * l'animation à l'écran.
       */
      await waitForLoaderPaint()

      /*
       * Puis on ouvre la page dédiée
       * à l'export PDF.
       */
      await navigateTo(
        '/editor/export-pdf',
        {
          open: {
            target: '',

            windowFeatures: {
              popup: true,
            },
          },
        },
      )

      /*
       * On conserve brièvement l'overlay
       * pendant l'ouverture de la fenêtre.
       */
      await waitAfterOpening()
    }
    catch (err) {
      console.error(
        'Failed to open PDF export',
        err,
      )
    }
    finally {
      removeLoader()

      exporting = false
    }
  }

  return exportMap
}