import { defineStore } from 'pinia'
import type {
  Feed,
  FeedListItem,
  FeedMemberDetail,
  FeedRefreshSummary,
} from '#shared/types'
import type {
  FeedCreateInput,
  FeedMemberInput,
  FeedUpdateInput,
} from '#shared/schemas/feed'
import { feedMemberLabel } from '#shared/utils/labels'

export const useFeedsStore = defineStore('feeds', {
  state: () => ({
    feeds: [] as FeedListItem[],
    membersByFeed: {} as Record<number, FeedMemberDetail[]>,
    loading: false,
    error: null as string | null,
    errorStatus: null as number | null,
  }),
  actions: {
    async fetchAll(): Promise<FeedListItem[]> {
      this.loading = true
      this.error = null
      this.errorStatus = null
      try {
        this.feeds = await $fetch<FeedListItem[]>('/api/feeds')
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
      } finally {
        this.loading = false
      }
      return this.feeds
    },

    async fetchOne(id: number): Promise<Feed | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const { members, ...feed } = await $fetch<
          Feed & { members: FeedMemberDetail[] }
        >(`/api/feeds/${id}`)
        this.membersByFeed[id] = members
        return feed
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async create(input: FeedCreateInput): Promise<Feed | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const created = await $fetch<Feed>('/api/feeds', {
          method: 'POST',
          body: input,
        })
        // The POST response has no `memberCount` (only the list route
        // hydrates it), so refetch rather than fabricating a count of 0.
        await this.fetchAll()
        return created
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async update(
      id: number,
      patch: FeedUpdateInput,
    ): Promise<Feed | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const updated = await $fetch<Feed>(`/api/feeds/${id}`, {
          method: 'PATCH',
          body: patch,
        })
        const index = this.feeds.findIndex((f) => f.id === id)
        // The PATCH response carries neither `memberCount` nor `memberLabels`
        // (only the list route hydrates them), so carry the existing values
        // forward rather than emptying the row's members on every rename.
        if (index !== -1) {
          this.feeds[index] = {
            ...updated,
            memberCount: this.feeds[index]!.memberCount,
            memberLabels: this.feeds[index]!.memberLabels,
          }
        }
        return updated
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async remove(id: number): Promise<boolean> {
      this.error = null
      this.errorStatus = null
      try {
        await $fetch(`/api/feeds/${id}`, { method: 'DELETE' })
        this.feeds = this.feeds.filter((f) => f.id !== id)
        Reflect.deleteProperty(this.membersByFeed, id)
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return false
      }
    },

    async addMember(
      feedId: number,
      input: FeedMemberInput,
    ): Promise<FeedMemberDetail | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const member = await $fetch<FeedMemberDetail>(
          `/api/feeds/${feedId}/members`,
          { method: 'POST', body: input },
        )
        this.membersByFeed[feedId] = [
          ...(this.membersByFeed[feedId] ?? []),
          member,
        ]
        const index = this.feeds.findIndex((f) => f.id === feedId)
        if (index !== -1) {
          this.feeds[index]!.memberCount++
          // Kept in step with the count so the feeds list stays accurate
          // without a refetch when navigating back to it.
          this.feeds[index]!.memberLabels.push(
            feedMemberLabel(member.source.title, member.subfeed?.name),
          )
        }
        return member
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async removeMember(feedId: number, memberId: number): Promise<boolean> {
      this.error = null
      this.errorStatus = null
      try {
        const removed = (this.membersByFeed[feedId] ?? []).find(
          (m) => m.id === memberId,
        )
        await $fetch(`/api/feed-members/${memberId}`, { method: 'DELETE' })
        this.membersByFeed[feedId] = (this.membersByFeed[feedId] ?? []).filter(
          (m) => m.id !== memberId,
        )
        const index = this.feeds.findIndex((f) => f.id === feedId)
        if (index !== -1) {
          this.feeds[index]!.memberCount--
          if (removed) {
            const label = feedMemberLabel(
              removed.source.title,
              removed.subfeed?.name,
            )
            const labels = this.feeds[index]!.memberLabels
            const at = labels.indexOf(label)
            if (at !== -1) labels.splice(at, 1)
          }
        }
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return false
      }
    },

    async refresh(
      id: number,
      maxPages?: number,
    ): Promise<FeedRefreshSummary | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        return await $fetch<FeedRefreshSummary>(`/api/feeds/${id}/refresh`, {
          method: 'POST',
          body: { maxPages },
        })
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },
  },
})
