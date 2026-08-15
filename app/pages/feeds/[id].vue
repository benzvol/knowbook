<script setup lang="ts">
import type { FeedMemberInput } from '#shared/schemas/feed'
import type { FeedMemberDetail } from '#shared/types'
import { feedMemberLabel } from '#shared/utils/labels'

const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Feed · Knowbook' })

const store = useFeedsStore()
const toast = useToast()

const { data: feed } = await useAsyncData(`feed-${id}`, () =>
  store.fetchOne(id),
)

const itemView = useItemView(
  { kind: 'feed', id },
  { refresh: () => store.refresh(id) },
)
const {
  query,
  mode,
  view,
  searchMeta,
  loading,
  error: itemsError,
  patch,
  setPage,
  setMode,
  searchDeep,
  refresh,
  refreshing,
  canRefresh,
  reload: reloadItems,
} = itemView

await useAsyncData(`feed-items-${id}`, () => reloadItems())

const members = computed(() => store.membersByFeed[id] ?? [])
const noMembersYet = computed(() => members.value.length === 0)

const sourceTitles = computed(
  () => new Map(view.value?.facets.sources.map((s) => [s.id, s.title]) ?? []),
)

// A composed feed has no pagination config of its own — search-until-found
// walks each member's own target, so the button is always offered here; a
// member with no pagination degenerates to a single (harmless) extra page.
const paginated = true

function memberLabel(member: FeedMemberDetail): string {
  return feedMemberLabel(member.source.title, member.subfeed?.name)
}

// A member's manage page: the subfeeds list for a narrowed member, the source
// edit form for a whole-source one.
function memberManageLink(member: FeedMemberDetail): string {
  return member.subfeed
    ? `/sources/${member.source.id}/subfeeds`
    : `/sources/${member.source.id}/edit`
}

// `null` means "add".
const addModalOpen = ref(false)
const submitting = ref(false)
const memberError = ref<string>()

function openAdd() {
  memberError.value = undefined
  addModalOpen.value = true
}

async function onAddMember(payload: FeedMemberInput) {
  submitting.value = true
  memberError.value = undefined

  const result = await store.addMember(id, payload)

  submitting.value = false

  if (result) {
    addModalOpen.value = false
    toast.add({ title: 'Member added', color: 'success' })
    await reloadItems()
  } else if (store.errorStatus === 409) {
    memberError.value = store.error ?? undefined
  } else {
    toast.add({
      title: 'Failed to add member',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}

const pendingRemoveId = ref<number | null>(null)
const removeModalOpen = computed({
  get: () => pendingRemoveId.value !== null,
  set: (value: boolean) => {
    if (!value) pendingRemoveId.value = null
  },
})

async function confirmRemove() {
  if (pendingRemoveId.value == null) return
  const ok = await store.removeMember(id, pendingRemoveId.value)
  pendingRemoveId.value = null
  if (ok) {
    toast.add({ title: 'Member removed', color: 'success' })
    await reloadItems()
  } else {
    toast.add({
      title: 'Remove failed',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}

async function onRefresh() {
  const summary = await refresh()
  toast.add(
    summary
      ? {
          title: 'Feed refreshed',
          description: `${summary.seen} items seen, ${summary.inserted} new, ${summary.updated} updated.`,
          color: 'success',
        }
      : {
          title: 'Refresh failed',
          description: store.error ?? undefined,
          color: 'error',
        },
  )
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="feed">
      <AppBackLink to="/feeds" label="feeds" />

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">{{ feed.name }}</h1>
          <p class="text-sm text-muted">
            {{ members.length }}
            {{ members.length === 1 ? 'member' : 'members' }}
          </p>
        </div>
      </div>

      <UAlert
        v-if="store.error && store.errorStatus !== 409"
        color="error"
        variant="subtle"
        :title="store.error"
      />

      <!--
        Chips rather than a card per member: a member is a title, and its URL is
        not something read here — it is one click away on the manage page the
        chip links to.
      -->
      <div class="flex flex-wrap items-center gap-2">
        <UFieldGroup v-for="member in members" :key="member.id" size="sm">
          <UButton
            :label="memberLabel(member)"
            :to="memberManageLink(member)"
            :icon="member.subfeed ? 'i-ph-stack' : 'i-ph-rss'"
            color="neutral"
            variant="subtle"
          />
          <UButton
            icon="i-ph-x"
            color="neutral"
            variant="subtle"
            :aria-label="`Remove ${memberLabel(member)}`"
            @click="pendingRemoveId = member.id"
          />
        </UFieldGroup>
        <UButton
          label="Add member"
          icon="i-ph-plus"
          size="sm"
          variant="outline"
          @click="openAdd"
        />
      </div>

      <UCard v-if="noMembersYet">
        <p class="text-muted">
          No members yet. Add a source (optionally narrowed to a subfeed) to
          start reading it here.
        </p>
      </UCard>

      <ItemsItemView
        :view="view"
        :query="query"
        :mode="mode"
        :paginated="paginated"
        :source-titles="sourceTitles"
        :loading="loading"
        :error="itemsError"
        :search-meta="searchMeta"
        :can-refresh="canRefresh"
        :refreshing="refreshing"
        @patch="patch"
        @update:mode="setMode"
        @update:page="setPage"
        @search-deep="searchDeep"
        @refresh="onRefresh"
      />

      <UModal v-model:open="addModalOpen" title="Add member">
        <template #content>
          <div class="p-4">
            <FeedsFeedMemberForm
              :member-error="memberError"
              :submitting="submitting"
              @submit="onAddMember"
            >
              <template #cancel>
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="addModalOpen = false"
                />
              </template>
            </FeedsFeedMemberForm>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="removeModalOpen" title="Remove member">
        <template #content>
          <div class="flex flex-col gap-4 p-4">
            <p>
              Remove this member from the feed? Cached items stay — they belong
              to the source.
            </p>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="pendingRemoveId = null"
              />
              <UButton label="Remove" color="error" @click="confirmRemove" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
    <UAlert v-else color="error" variant="subtle" title="Feed not found">
      <template #description>
        <NuxtLink to="/feeds" class="underline">Back to feeds</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
