import { computed } from 'vue'
import { gameLocaleTag, translateGameText } from '../config/i18n'
import { useGameSettings } from './useGameSettings'
import type { GameLocale } from '../types/i18n'

const textSources = new WeakMap<Text, string>()
const textRendered = new WeakMap<Text, string>()
const attributeSources = new WeakMap<Element, Map<string, string>>()
const attributeRendered = new WeakMap<Element, Map<string, string>>()
const TRANSLATED_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'] as const
let observer: MutationObserver | null = null
let observedRoot: Node | null = null
let translating = false

function shouldSkip(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement
  if (!element) return false
  if (element.closest('[data-i18n-skip]')) return true
  return ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(element.tagName)
}

function translateTextNode(node: Text, locale: GameLocale) {
  if (shouldSkip(node)) return
  const current = node.data
  const lastRendered = textRendered.get(node)
  if (!textSources.has(node) || current !== lastRendered) textSources.set(node, current)
  const source = textSources.get(node) ?? current
  const rendered = translateGameText(source, locale)
  if (node.data !== rendered) node.data = rendered
  textRendered.set(node, rendered)
}

function translateElementAttributes(element: Element, locale: GameLocale) {
  if (shouldSkip(element)) return
  let sources = attributeSources.get(element)
  let renderedMap = attributeRendered.get(element)
  if (!sources) { sources = new Map(); attributeSources.set(element, sources) }
  if (!renderedMap) { renderedMap = new Map(); attributeRendered.set(element, renderedMap) }
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue
    const current = element.getAttribute(attribute) ?? ''
    const lastRendered = renderedMap.get(attribute)
    if (!sources.has(attribute) || current !== lastRendered) sources.set(attribute, current)
    const source = sources.get(attribute) ?? current
    const rendered = translateGameText(source, locale)
    if (current !== rendered) element.setAttribute(attribute, rendered)
    renderedMap.set(attribute, rendered)
  }
}

function translateSubtree(root: Node, locale: GameLocale) {
  if (typeof document === 'undefined') return
  if (root.nodeType === Node.TEXT_NODE) translateTextNode(root as Text, locale)
  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root as Element, locale)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale)
    else translateElementAttributes(node as Element, locale)
    node = walker.nextNode()
  }
}

export function useGameI18n() {
  const preferences = useGameSettings()
  const locale = computed(() => preferences.settings.value.locale)
  const localeTag = computed(() => gameLocaleTag(locale.value))

  function t(text: string) {
    return translateGameText(text, locale.value)
  }

  function number(value: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(localeTag.value, options).format(value)
  }

  function currency(value: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(localeTag.value, {
      style: 'currency', currency: 'EUR', ...options,
    }).format(value)
  }

  function date(value: string | Date, options?: Intl.DateTimeFormatOptions) {
    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) return t('date inconnue')
    return new Intl.DateTimeFormat(localeTag.value, options).format(parsed)
  }

  function applyDocumentLanguage() {
    if (typeof document === 'undefined') return
    document.documentElement.lang = locale.value
    document.documentElement.dataset.cluGameLocale = locale.value
  }

  function refreshDom(root: Node = document.body) {
    if (typeof document === 'undefined') return
    translating = true
    observer?.disconnect()
    try {
      translateSubtree(root, locale.value)
      applyDocumentLanguage()
    }
    finally {
      translating = false
      if (observer && observedRoot) observer.observe(observedRoot, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATED_ATTRIBUTES] })
    }
  }

  function startDomTranslation(root: Node = document.body) {
    if (typeof MutationObserver === 'undefined') return
    stopDomTranslation()
    observedRoot = root
    observer = new MutationObserver(mutations => {
      if (translating) return
      translating = true
      observer?.disconnect()
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') translateSubtree(mutation.target, locale.value)
          else if (mutation.type === 'attributes') translateElementAttributes(mutation.target as Element, locale.value)
          else for (const node of Array.from(mutation.addedNodes)) translateSubtree(node, locale.value)
        }
      }
      finally {
        translating = false
        if (observer && observedRoot) observer.observe(observedRoot, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATED_ATTRIBUTES] })
      }
    })
    refreshDom(root)
  }

  function stopDomTranslation() {
    observer?.disconnect()
    observer = null
    observedRoot = null
  }

  return { locale, localeTag, t, number, currency, date, applyDocumentLanguage, refreshDom, startDomTranslation, stopDomTranslation }
}
