<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, ref, watch } from 'vue'
import { GAME_HELP_CATEGORY_LABELS, GAME_WIKI_ARTICLES, getGameWikiArticle } from '../../data/help/wiki'
import type { GameHelpCategory, GameWikiArticle } from '../../types/help'

const props = defineProps<{ articleId?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const query = ref('')
const selectedId = ref(props.articleId ?? 'prise-en-main')

watch(() => props.articleId, value => {
  if (value && getGameWikiArticle(value)) selectedId.value = value
})

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(currentGameLocaleTag())
}

const categories = computed(() => {
  const search = normalize(query.value.trim())
  const filtered = search
    ? GAME_WIKI_ARTICLES.filter(article => normalize([article.title, article.summary, ...article.keywords].join(' ')).includes(search))
    : GAME_WIKI_ARTICLES
  const grouped = new Map<GameHelpCategory, typeof GAME_WIKI_ARTICLES>()
  for (const article of filtered) {
    if (!grouped.has(article.category)) grouped.set(article.category, [])
    grouped.get(article.category)!.push(article)
  }
  return [...grouped.entries()].map(([id, articles]) => ({ id, label: GAME_HELP_CATEGORY_LABELS[id], articles }))
})

const selected = computed(() => getGameWikiArticle(selectedId.value) ?? GAME_WIKI_ARTICLES[0])
const related = computed(() => (selected.value.related ?? []).map(getGameWikiArticle).filter((article): article is GameWikiArticle => Boolean(article)))

function selectArticle(id: string) {
  selectedId.value = id
}
</script>

<template>
  <section class="help-center" role="dialog" aria-modal="true" aria-labelledby="wiki-title">
    <header class="help-header">
      <div><span>CLU Métropole</span><h2 id="wiki-title">Wiki</h2></div>
      <button type="button" aria-label="Fermer le Wiki" @click="emit('close')">×</button>
    </header>

    <div class="help-layout">
      <aside class="help-nav">
        <label class="help-search">
          <span>⌕</span>
          <input v-model="query" type="search" placeholder="Rechercher dans le Wiki" aria-label="Rechercher dans le Wiki">
        </label>
        <div v-if="categories.length" class="help-categories">
          <section v-for="category in categories" :key="category.id">
            <h3>{{ category.label }}</h3>
            <button
              v-for="article in category.articles"
              :key="article.id"
              type="button"
              :class="{ active: article.id === selected.id }"
              :aria-current="article.id === selected.id ? 'page' : undefined"
              @click="selectArticle(article.id)"
            >
              <strong>{{ article.title }}</strong>
              <small>{{ article.summary }}</small>
            </button>
          </section>
        </div>
        <p v-else class="empty">Aucun article ne correspond à cette recherche.</p>
      </aside>

      <article class="help-article">
        <span class="article-category">{{ GAME_HELP_CATEGORY_LABELS[selected.category] }}</span>
        <h1>{{ selected.title }}</h1>
        <p class="article-summary">{{ selected.summary }}</p>
        <p v-for="paragraph in selected.paragraphs" :key="paragraph">{{ paragraph }}</p>
        <ul v-if="selected.bullets?.length">
          <li v-for="bullet in selected.bullets" :key="bullet">{{ bullet }}</li>
        </ul>
        <section v-if="related.length" class="related">
          <span>À lire aussi</span>
          <div>
            <button v-for="article in related" :key="article.id" type="button" @click="selectArticle(article.id)">{{ article.title }}</button>
          </div>
        </section>
      </article>
    </div>
  </section>
</template>

<style scoped>
.help-center{width:min(1040px,calc(100vw - 36px));height:min(760px,calc(100vh - 36px));border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#0d161c;color:#eef6f7;box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr)}.help-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.018)}.help-header span,.article-category{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;color:#76dbe2;font-weight:800}.help-header h2{margin:2px 0 0;font-size:calc(20px * var(--clu-text-scale,1))}.help-header>button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.045);color:inherit;font-size:calc(20px * var(--clu-text-scale,1));cursor:pointer}.help-layout{min-height:0;display:grid;grid-template-columns:320px minmax(0,1fr)}.help-nav{min-height:0;overflow:auto;padding:14px;border-right:1px solid rgba(255,255,255,.07);scrollbar-width:thin}.help-search{height:38px;padding:0 10px;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.035)}.help-search span{opacity:.55}.help-search input{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:calc(11px * var(--clu-text-scale,1))}.help-categories{display:grid;gap:16px;margin-top:14px}.help-categories section{display:grid;gap:5px}.help-categories h3{margin:0 3px 3px;font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.45}.help-categories button{display:grid;gap:3px;padding:9px 10px;border:1px solid transparent;border-radius:10px;background:transparent;color:inherit;text-align:left;cursor:pointer}.help-categories button:hover{background:rgba(255,255,255,.045)}.help-categories button.active{border-color:rgba(80,211,220,.28);background:rgba(80,211,220,.09)}.help-categories strong{font-size:calc(11px * var(--clu-text-scale,1))}.help-categories small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.35;opacity:.48}.empty{font-size:calc(11px * var(--clu-text-scale,1));opacity:.55}.help-article{min-height:0;overflow:auto;padding:34px 40px 44px;scrollbar-width:thin}.help-article h1{margin:5px 0 8px;font-size:calc(30px * var(--clu-text-scale,1));letter-spacing:-.025em}.article-summary{margin:0 0 24px!important;font-size:calc(14px * var(--clu-text-scale,1))!important;line-height:1.55!important;color:#a8c9cd!important}.help-article>p{max-width:760px;margin:0 0 14px;font-size:calc(12px * var(--clu-text-scale,1));line-height:1.75;color:rgba(238,246,247,.74)}.help-article ul{max-width:730px;margin:18px 0 0;padding:15px 18px 15px 34px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03)}.help-article li{padding:3px 0;font-size:calc(11px * var(--clu-text-scale,1));line-height:1.55;color:rgba(238,246,247,.7)}.related{margin-top:30px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);display:grid;gap:9px}.related>span{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.5}.related>div{display:flex;gap:7px;flex-wrap:wrap}.related button{padding:8px 10px;border:1px solid rgba(80,211,220,.2);border-radius:9px;background:rgba(80,211,220,.07);color:#a9eef2;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1))}@media(max-width:760px){.help-layout{grid-template-columns:1fr}.help-nav{max-height:250px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.help-article{padding:24px 20px 32px}.help-article h1{font-size:calc(24px * var(--clu-text-scale,1))}}
</style>
