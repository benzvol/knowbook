<script setup lang="ts">
import type { FeedMemberInput } from '#shared/schemas/feed'
import type { FeedMemberDetail } from '#shared/types'

const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Feed · Knowbook' })

const store = useFeedsStore()
const toast = useToast()

const { data: feed } = await useAsyncData(`feed-${id}`, () =>
  store.fetchOne(id),
)
const { data: items, refresh: reloadItems } = await useAsyncData(
  `feed-items-${id}`,
  () => store.fetchItems(id),
)

const members = computed(() => store.membersByFeed[id] ?? [])
const noMembersYet = computed(() => members.value.length === 0)
const noItemsYet = computed(() => (items.value ?? []).length === 0)

const sourceTitleById = computed(() => {
  const map = new Map<number, string>()
  for (const member of members.value)
    map.set(member.source.id, member.source.title)
  return map
})

function memberLabel(member: FeedMemberDetail): string {
  return member.subfeed
    ? `${member.source.title} → ${member.subfeed.name}`
    : member.source.title
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
  const summary = await store.refresh(id)

  if (summary) {
    toast.add({
      title: 'Feed refreshed',
      description: `${summary.members.length} members · ${summary.seen} items seen, ${summary.inserted} new, ${summary.updated} updated.`,
      color: 'success',
    })
    await reloadItems()
  } else {
    toast.add({
      title: 'Refresh failed',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="feed">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">{{ feed.name }}</h1>
          <p class="text-sm text-muted">
            {{ members.length }}
            {{ members.length === 1 ? 'member' : 'members' }}
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            label="Refresh feed"
            icon="i-ph-arrow-clockwise"
            color="neutral"
            variant="subtle"
            @click="onRefresh"
          />
          <UButton label="Add member" icon="i-ph-plus" @click="openAdd" />
        </div>
      </div>

      <UAlert
        v-if="store.error && store.errorStatus !== 409"
        color="error"
        variant="subtle"
        :title="store.error"
      />

      <div v-if="members.length" class="flex flex-col gap-3">
        <UCard v-for="member in members" :key="member.id">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1">
              <h2 class="font-medium text-highlighted">
                {{ memberLabel(member) }}
              </h2>
              <p class="text-sm text-muted break-all">
                {{ member.source.url }}
              </p>
              <UBadge v-if="member.subfeed" size="sm" variant="subtle">
                shows the whole source's items
              </UBadge>
            </div>
            <UButton
              icon="i-ph-trash"
              color="error"
              variant="ghost"
              aria-label="Remove member"
              @click="pendingRemoveId = member.id"
            />
          </div>
        </UCard>
      </div>
      <UCard v-else-if="noMembersYet">
        <p class="text-muted">
          No members yet. Add a source (optionally narrowed to a subfeed) to
          start reading it here.
        </p>
      </UCard>

      <UAlert
        v-if="members.some((m) => m.subfeed)"
        color="info"
        variant="subtle"
        icon="i-ph-info"
        title="Subfeed members show their parent source's items"
      >
        <template #description>
          Cached items are stored per source, so a member narrowed to a subfeed
          currently surfaces that source's full cached set. Narrowing the cached
          view to just that subfeed comes later.
        </template>
      </UAlert>

      <div class="flex flex-col gap-2">
        <h2 class="font-medium text-highlighted">Items</h2>
        <div v-if="items && items.length" class="flex flex-col gap-2">
          <UCard v-for="item in items" :key="item.id">
            <div class="flex items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <a
                  v-if="item.link"
                  :href="item.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-highlighted underline"
                >
                  {{ item.title }}
                </a>
                <span v-else class="font-medium text-highlighted">
                  {{ item.title }}
                </span>
                <p class="text-sm text-muted">
                  {{ sourceTitleById.get(item.sourceId) }}
                  <template v-if="item.publishedAt">
                    · {{ new Date(item.publishedAt).toLocaleString() }}
                  </template>
                </p>
              </div>
            </div>
          </UCard>
        </div>
        <UCard v-else-if="noItemsYet">
          <p class="text-muted">
            No cached items yet. Refresh the feed to fetch its members.
          </p>
        </UCard>
      </div>

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
