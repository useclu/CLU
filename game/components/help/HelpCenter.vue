<script setup lang="ts">
import { useGameI18n } from '../../composables/useGameI18n'
import { computed, ref, watch } from 'vue'
import { GAME_HELP_CATEGORY_LABELS, GAME_WIKI_ARTICLES, getGameWikiArticle } from '../../data/help/wiki'
import type { GameHelpCategory, GameWikiArticle } from '../../types/help'

const props = defineProps<{ articleId?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const query = ref('')
const selectedId = ref(props.articleId ?? 'prise-en-main')
const { localeTag, t } = useGameI18n()

watch(() => props.articleId, value => {
  if (value && getGameWikiArticle(value)) selectedId.value = value
})

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(localeTag.value)
}

const categories = computed(() => {
  const search = normalize(query.value.trim())
  const filtered = search
    ? GAME_WIKI_ARTICLES.filter(article => normalize([
        t(article.title),
        t(article.summary),
        ...article.paragraphs.map(t),
        ...(article.steps ?? []).map(t),
        ...(article.bullets ?? []).map(t),
        ...(article.tips ?? []).map(t),
        article.warning ? t(article.warning) : '',
        ...article.keywords,
      ].join(' ')).includes(search))
    : GAME_WIKI_ARTICLES
  const grouped = new Map<GameHelpCategory, typeof GAME_WIKI_ARTICLES>()
  for (const article of filtered) {
    if (!grouped.has(article.category)) grouped.set(article.category, [])
    grouped.get(article.category)!.push(article)
  }
  return [...grouped.entries()].map(([id, articles]) => ({ id, label: t(GAME_HELP_CATEGORY_LABELS[id]), articles }))
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
              <strong>{{ t(article.title) }}</strong>
              <small>{{ t(article.summary) }}</small>
            </button>
          </section>
        </div>
        <p v-else class="empty">Aucun article ne correspond à cette recherche.</p>
      </aside>

      <article class="help-article">
        <div class="article-head">
          <span class="article-category">{{ t(GAME_HELP_CATEGORY_LABELS[selected.category]) }}</span>
          <h1>{{ t(selected.title) }}</h1>
          <p class="article-summary">{{ t(selected.summary) }}</p>
        </div>
        <div class="article-body">
          <p v-for="paragraph in selected.paragraphs" :key="paragraph">{{ t(paragraph) }}</p>
          <section v-if="selected.steps?.length" class="article-block steps-block">
            <h2>Comment faire</h2>
            <ol><li v-for="stepItem in selected.steps" :key="stepItem">{{ t(stepItem) }}</li></ol>
          </section>
          <section v-if="selected.bullets?.length" class="article-block">
            <h2>À retenir</h2>
            <ul><li v-for="bullet in selected.bullets" :key="bullet">{{ t(bullet) }}</li></ul>
          </section>
          <section v-if="selected.tips?.length" class="article-block tips-block">
            <h2>Conseils</h2>
            <ul><li v-for="tip in selected.tips" :key="tip">{{ t(tip) }}</li></ul>
          </section>
          <p v-if="selected.warning" class="article-warning"><strong>{{ t('Attention') }}</strong>{{ t(selected.warning) }}</p>
        </div>
        <section v-if="related.length" class="related">
          <span>À lire aussi</span>
          <div><button v-for="article in related" :key="article.id" type="button" @click="selectArticle(article.id)">{{ t(article.title) }}</button></div>
        </section>
      </article>
    </div>
  </section>
</template>

<style scoped>
.help-center{width:min(980px,calc(100vw - 28px));height:min(720px,calc(100vh - 28px));border:1px solid rgba(255,255,255,.1);border-radius:15px;background:#0d161c;color:#eef6f7;box-shadow:0 24px 70px rgba(0,0,0,.48);overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr)}.help-header{display:flex;align-items:center;justify-content:space-between;padding:11px 13px 10px 15px;border-bottom:1px solid rgba(255,255,255,.07)}.help-header>div{display:flex;align-items:baseline;gap:9px}.help-header span,.article-category{font-size:calc(7.5px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;color:#76dbe2;font-weight:800}.help-header h2{margin:0;font-size:calc(15px * var(--clu-text-scale,1))}.help-header>button{width:29px;height:29px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.025);color:inherit;font-size:18px;cursor:pointer}.help-layout{min-height:0;display:grid;grid-template-columns:270px minmax(0,1fr)}.help-nav{min-height:0;overflow:auto;padding:10px;border-right:1px solid rgba(255,255,255,.06);scrollbar-width:thin}.help-search{height:34px;padding:0 8px;display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.025)}.help-search span{opacity:.48}.help-search input{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:calc(9px * var(--clu-text-scale,1))}.help-categories{display:grid;gap:12px;margin-top:10px}.help-categories section{display:grid;gap:2px}.help-categories h3{margin:0 4px 3px;font-size:calc(7px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.11em;opacity:.38}.help-categories button{display:grid;gap:1px;padding:6px 7px;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;text-align:left;cursor:pointer}.help-categories button:hover{background:rgba(255,255,255,.035)}.help-categories button.active{border-color:rgba(80,211,220,.18);background:rgba(80,211,220,.07)}.help-categories strong{font-size:calc(9px * var(--clu-text-scale,1))}.help-categories small{font-size:calc(7px * var(--clu-text-scale,1));line-height:1.25;opacity:.38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.empty{font-size:calc(9px * var(--clu-text-scale,1));opacity:.48}.help-article{min-height:0;overflow:auto;padding:24px 30px 30px;scrollbar-width:thin}.article-head{max-width:720px;padding-bottom:15px;border-bottom:1px solid rgba(255,255,255,.06)}.help-article h1{margin:4px 0 6px;font-size:calc(24px * var(--clu-text-scale,1));letter-spacing:-.025em}.article-summary{margin:0!important;font-size:calc(11px * var(--clu-text-scale,1))!important;line-height:1.45!important;color:#9fc6ca!important}.article-body{max-width:720px;display:grid;gap:11px;padding-top:15px}.article-body>p{margin:0;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.62;color:rgba(238,246,247,.72)}.article-block{padding:10px 11px;border:1px solid rgba(255,255,255,.065);border-radius:9px;background:rgba(255,255,255,.02)}.article-block h2{margin:0 0 6px;font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.09em;opacity:.58}.article-block ul,.article-block ol{margin:0;padding-left:19px}.article-block li{padding:2px 0;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;color:rgba(238,246,247,.7)}.steps-block{border-color:rgba(80,211,220,.12);background:rgba(80,211,220,.035)}.tips-block{border-color:rgba(120,208,143,.12);background:rgba(80,170,100,.025)}.article-warning{display:grid;gap:3px;padding:9px 10px;border-left:3px solid #e2ad5c;border-radius:7px;background:rgba(226,173,92,.07)!important;font-size:calc(9px * var(--clu-text-scale,1))!important;line-height:1.45!important;color:rgba(255,232,194,.78)!important}.article-warning strong{color:#f0c77d}.related{max-width:720px;margin-top:19px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);display:grid;gap:7px}.related>span{font-size:calc(7px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.11em;opacity:.4}.related>div{display:flex;gap:5px;flex-wrap:wrap}.related button{padding:6px 8px;border:1px solid rgba(80,211,220,.15);border-radius:7px;background:rgba(80,211,220,.045);color:#a9eef2;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1))}@media(max-width:760px){.help-layout{grid-template-columns:1fr}.help-nav{max-height:210px;border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.help-article{padding:18px 16px 24px}.help-article h1{font-size:calc(20px * var(--clu-text-scale,1))}}
</style>
