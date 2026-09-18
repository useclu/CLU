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
          {{ $t('ui.pages.faq.available') }}
        </p>
        <Button
          severity="success"
          size="small"
          :label="$t('ui.pages.faq.open_editor')"
          @click="navigateTo('/editor')"
        />
      </div>
    </Message>

    <Panel>
      <template #header>
        <h1 class="text-2xl font-bold">
          {{ $t('ui.pages.faq.title') }}
        </h1>
      </template>

      <Accordion multiple>
        <AccordionPanel value="0">
          <AccordionHeader>{{ $t('ui.pages.faq.items.purpose_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.purpose_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="1">
          <AccordionHeader>{{ $t('ui.pages.faq.items.modes_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.modes_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="2">
          <AccordionHeader>{{ $t('ui.pages.faq.items.multi_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.multi_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="3">
          <AccordionHeader>{{ $t('ui.pages.faq.items.branches_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.branches_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="4">
          <AccordionHeader>{{ $t('ui.pages.faq.items.custom_index_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.custom_index_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="5">
          <AccordionHeader>{{ $t('ui.pages.faq.items.pictograms_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.pictograms_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="6">
          <AccordionHeader>{{ $t('ui.pages.faq.items.presets_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.presets_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="7">
          <AccordionHeader>{{ $t('ui.pages.faq.items.save_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.save_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="8">
          <AccordionHeader>{{ $t('ui.pages.faq.items.undo_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.undo_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="9">
          <AccordionHeader>{{ $t('ui.pages.faq.items.opensource_q') }}</AccordionHeader>
          <AccordionContent>
            <p>
              {{ $t('ui.pages.faq.items.opensource_a_before') }}
              <Button
                link
                as="a"
                href="https://github.com/useclu/CLU"
                target="_blank"
                rel="noopener noreferrer"
                :label="$t('ui.pages.faq.github_repo')"
                pt:root:class="important-p-0"
              />{{ $t('ui.pages.faq.items.opensource_a_after') }}
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="10">
          <AccordionHeader>{{ $t('ui.pages.faq.items.contribute_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.contribute_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="11">
          <AccordionHeader>{{ $t('ui.pages.faq.items.free_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.free_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="12">
          <AccordionHeader>{{ $t('ui.pages.faq.items.bug_q') }}</AccordionHeader>
          <AccordionContent>
            <p>
              {{ $t('ui.pages.faq.items.bug_a_before') }}
              <Button
                link
                as="a"
                href="https://github.com/useclu/CLU/issues"
                target="_blank"
                rel="noopener noreferrer"
                :label="$t('ui.pages.faq.github_repo')"
                pt:root:class="important-p-0"
              />
              {{ $t('ui.pages.faq.items.bug_a_after') }}
            </p>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="13">
          <AccordionHeader>{{ $t('ui.pages.faq.items.tech_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.tech_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="14">
          <AccordionHeader>{{ $t('ui.pages.faq.items.browser_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.browser_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="15">
          <AccordionHeader>{{ $t('ui.pages.faq.items.render_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.render_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="16">
          <AccordionHeader>{{ $t('ui.pages.faq.items.mobile_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.mobile_a') }}</p></AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="17">
          <AccordionHeader>{{ $t('ui.pages.faq.items.origin_q') }}</AccordionHeader>
          <AccordionContent><p>{{ $t('ui.pages.faq.items.origin_a') }}</p></AccordionContent>
        </AccordionPanel>
      </Accordion>
    </Panel>
  </div>
</template>
