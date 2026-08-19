export type TopicStatus = 'idea' | 'doing' | 'ready' | 'done'
export type Topic = {
  id: string
  title: string
  destination: string
  content_type: string
  status: TopicStatus
  planned_at: string | null
  xhs_url: string | null
  created_at: string
}
export type Metric = {
  id: string
  post_id: string
  snapshot_at: string
  views: number
  likes: number
  saves: number
  comments: number
  follows: number
}
