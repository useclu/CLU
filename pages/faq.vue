<script setup lang="ts">
import { navigateTo } from '#app'
import { definePageMeta } from '#imports'

definePageMeta({
  layout: 'default',
})
</script>

<template>
  <div class="pt-10 container max-w-60em mx-auto flex flex-col gap-10">
    <Message severity="success" pt:text:class="flex-grow">
      <div class="flex flex-row items-center justify-between w-full">
        <p class="text-xl font-bold">
          CLU est disponible !
        </p>
        <Button severity="success" size="small" label="Accéder à l’éditeur" @click="navigateTo('/editor')" />
      </div>
    </Message>

    <Panel>
      <template #header>
        <h1 class="text-2xl font-bold">
          Foire aux questions
        </h1>
      </template>

      <Accordion multiple>
        <AccordionPanel value="0">
          <AccordionHeader>À quoi sert CLU ?</AccordionHeader>
          <AccordionContent>
            <p>
              CLU — Créateur de Lignes Urbaines — permet de concevoir et personnaliser des plans de lignes
              de transports en commun directement depuis un navigateur.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="1">
          <AccordionHeader>Quels modes de transport sont disponibles ?</AccordionHeader>
          <AccordionContent>
            <p>
              CLU permet de représenter différents modes de transport, notamment les métros, RER,
              Transiliens, tramways, bus, téléphériques, navettes fluviales et vélos.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="2">
          <AccordionHeader>Peut-on créer plusieurs lignes sur un même plan ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. CLU permet de construire des plans comprenant plusieurs lignes et de représenter
              leurs arrêts et correspondances communs.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="3">
          <AccordionHeader>Peut-on créer des branches et des fourches ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. Les lignes peuvent comporter des branches, des fourches, des branches parallèles,
              des boucles et différents niveaux afin de construire des schémas complexes.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="4">
          <AccordionHeader>Peut-on créer un indice de ligne personnalisé ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. CLU permet de créer des indices personnalisés et de les utiliser sur les lignes
              ainsi que dans les correspondances.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="5">
          <AccordionHeader>Peut-on utiliser ses propres pictogrammes ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. Des pictogrammes personnalisés peuvent être utilisés pour adapter les modes
              de transport et l’identité visuelle du plan.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="6">
          <AccordionHeader>Existe-t-il des préréglages ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. CLU propose différents préréglages permettant de partir rapidement d’une ligne
              existante, notamment pour des lignes de métro, RER, Transilien et tramway franciliens.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="7">
          <AccordionHeader>Peut-on sauvegarder ses projets ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. CLU permet de sauvegarder un projet afin de pouvoir le charger et continuer
              à le modifier ultérieurement.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="8">
          <AccordionHeader>Peut-on annuler une modification ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. CLU dispose d’un système d’annulation et de rétablissement permettant de revenir
              sur les dernières modifications effectuées dans l’éditeur.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="9">
          <AccordionHeader>Le projet est-il open source ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. Le code source de CLU est disponible sur le
              <Button
                link
                as="a"
                href="https://github.com/useclu/CLU"
                target="_blank"
                rel="noopener noreferrer"
                label="dépôt GitHub"
                pt:root:class="important-p-0"
              />.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="10">
          <AccordionHeader>Puis-je contribuer au projet ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. Vous pouvez contribuer au projet, proposer des améliorations ou signaler
              des problèmes depuis le dépôt GitHub de CLU.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="11">
          <AccordionHeader>CLU est-il gratuit ?</AccordionHeader>
          <AccordionContent>
            <p>
              Oui. CLU est un projet gratuit et open source distribué sous licence MIT.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="12">
          <AccordionHeader>J’ai trouvé un bug ou une faute, comment la signaler ?</AccordionHeader>
          <AccordionContent>
            <p>
              Vous pouvez ouvrir un ticket sur le
              <Button
                link
                as="a"
                href="https://github.com/useclu/CLU/issues"
                target="_blank"
                rel="noopener noreferrer"
                label="dépôt GitHub"
                pt:root:class="important-p-0"
              />
              en décrivant le problème rencontré.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="13">
          <AccordionHeader>Sur quelles technologies repose CLU ?</AccordionHeader>
          <AccordionContent>
            <p>
              CLU repose notamment sur Nuxt, Vue, TypeScript et PrimeVue.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="14">
          <AccordionHeader>Quel navigateur utiliser ?</AccordionHeader>
          <AccordionContent>
            <p>
              Pour une expérience optimale, il est recommandé d’utiliser une version récente
              d’un navigateur basé sur Chromium, comme Google Chrome, Microsoft Edge, Brave,
              Vivaldi ou Opera.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="15">
          <AccordionHeader>Le rendu final est anormal, que faire ?</AccordionHeader>
          <AccordionContent>
            <p>
              Si le rendu exporté présente un problème, essayez d’abord avec une version récente
              d’un navigateur Chromium. Si le problème persiste, vous pouvez le signaler sur
              le dépôt GitHub de CLU en précisant les étapes permettant de le reproduire.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="16">
          <AccordionHeader>Le site fonctionne-t-il sur mobile ?</AccordionHeader>
          <AccordionContent>
            <p>
              CLU est principalement conçu pour être utilisé sur ordinateur. Un écran suffisamment
              grand est recommandé pour profiter confortablement de l’éditeur.
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="17">
          <AccordionHeader>D’où vient CLU ?</AccordionHeader>
          <AccordionContent>
            <p>
              CLU est basé sur le projet open source BULB de SlamaFR, lui-même issu de Nightrunner
              de notKamui. CLU poursuit cette base avec de nombreuses modifications et fonctionnalités
              supplémentaires.
            </p>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </Panel>
  </div>
</template>