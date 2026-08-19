'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Home, Map, Lightbulb, PenSquare, BarChart3, Globe2, Plus, Search,
  ExternalLink, Save, RefreshCw, Image as ImageIcon, UploadCloud, Menu, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Topic, TopicStatus } from '@/lib/types'

type Page = 'dashboard'|'materials'|'topics'|'production'|'analytics'|'website'
type Destination = {
  id:string; name:string; region:string|null; trip_count:number; material_count:number;
  published_count:number; idea_count:number; cover_url:string|null
}
type Post = {
  id:string; title:string; destination:string; xhs_url:string|null; published_at:string|null;
  views:number; likes:number; saves:number; comments:number; follows:number
}

const nav = [
  ['dashboard','工作台',Home],
  ['materials','旅行素材库',Map],
  ['topics','选题库',Lightbulb],
  ['production','内容制作',PenSquare],
  ['analytics','数据复盘',BarChart3],
  ['website','独立站内容',Globe2],
] as const

const statusName: Record<TopicStatus,string> = {
  idea:'选题', doing:'制作中', ready:'待发布', done:'已发布'
}

function parseXhsNoteId(url:string) {
  const m = url.match(/\/explore\/([a-zA-Z0-9]+)/) || url.match(/\/discovery\/item\/([a-zA-Z0-9]+)/)
  return m?.[1] ?? null
}

export default function HomePage() {
  const [page,setPage] = useState<Page>('dashboard')
  const [menu,setMenu] = useState(false)
  const [loading,setLoading] = useState(true)
  const [topics,setTopics] = useState<Topic[]>([])
  const [destinations,setDestinations] = useState<Destination[]>([])
  const [posts,setPosts] = useState<Post[]>([])
  const [draft,setDraft] = useState({
    title:'🇭🇰深圳出发｜周末去香港暴走一天',
    cover_title:'香港暴走一天',
    cover_subtitle:'深圳出发 · 不赶景点的 Citywalk',
    route:'福田口岸 → 中环 → 奥卑利街 → 尖沙咀 → 庙街 → 维港',
    body:'周末不想在深圳宅着，就去香港走了一天。主打一个慢慢走，不赶景点……',
    xhs_url:''
  })
  const [topicSearch,setTopicSearch] = useState('')
  const [destSearch,setDestSearch] = useState('')
  const supabase = useMemo(()=> {
    try { return createClient() } catch { return null }
  },[])

  async function loadAll() {
    if(!supabase){ setLoading(false); return }
    setLoading(true)
    const [{data:t},{data:d},{data:p}] = await Promise.all([
      supabase.from('topics').select('*').order('created_at',{ascending:false}),
      supabase.from('destination_summary').select('*').order('idea_count',{ascending:false}),
      supabase.from('post_summary').select('*').order('published_at',{ascending:false})
    ])
    setTopics((t||[]) as Topic[])
    setDestinations((d||[]) as Destination[])
    setPosts((p||[]) as Post[])
    setLoading(false)
  }

  useEffect(()=>{ loadAll() },[]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!supabase) return
    const channel = supabase.channel('h17-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'topics'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'post_metrics'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadAll())
      .subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTopic() {
    if(!supabase) return alert('请先配置 Supabase')
    const title = prompt('输入选题标题')
    if(!title) return
    const destination = prompt('目的地','香港') || '未分类'
    await supabase.from('topics').insert({
      title, destination, content_type:'路线型', status:'idea'
    })
    loadAll()
  }

  async function advanceTopic(t:Topic) {
    if(!supabase) return
    const order:TopicStatus[]=['idea','doing','ready','done']
    const next=order[(order.indexOf(t.status)+1)%order.length]
    await supabase.from('topics').update({status:next}).eq('id',t.id)
  }

  async function saveDraft() {
    if(!supabase) return alert('请先配置 Supabase')
    const user = (await supabase.auth.getUser()).data.user
    if(!user) return alert('请先登录')
    const xhsNoteId = draft.xhs_url ? parseXhsNoteId(draft.xhs_url) : null
    const {error} = await supabase.from('drafts').insert({
      ...draft, user_id:user.id, xhs_note_id:xhsNoteId
    })
    if(error) alert(error.message); else alert('已保存到云端')
  }

  async function signIn() {
    if(!supabase) return alert('请先配置 Supabase')
    const email = prompt('输入登录邮箱')
    if(!email) return
    const {error} = await supabase.auth.signInWithOtp({email, options:{emailRedirectTo:location.origin}})
    if(error) alert(error.message); else alert('登录链接已发送到邮箱')
  }

  const filteredTopics = topics.filter(t =>
    (t.title+t.destination+t.content_type).toLowerCase().includes(topicSearch.toLowerCase())
  )
  const filteredDest = destinations.filter(d => d.name.toLowerCase().includes(destSearch.toLowerCase()))
  const published = topics.filter(t=>t.status==='done').length
  const pending = topics.filter(t=>t.status!=='done').length
  const bestPost = [...posts].sort((a,b)=>b.views-a.views)[0]

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">
        <strong>禾十七</strong><span>TRAVEL CONTENT STUDIO</span>
      </div>
      <nav>
        {nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''}
          onClick={()=>setPage(id as Page)}><Icon size={18}/>{label}</button>)}
      </nav>
      <div className="sideFoot">
        <button className="ghost" onClick={signIn}>邮箱登录</button>
        <span>云端实时同步 · PWA</span>
      </div>
    </aside>

    <header className="mobileHeader">
      <div className="brand"><strong>禾十七</strong></div>
      <button className="icon" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
    </header>
    {menu && <div className="mobileMenu">
      {nav.map(([id,label,Icon])=><button key={id} onClick={()=>{setPage(id as Page);setMenu(false)}}>
        <Icon size={18}/>{label}</button>)}
    </div>}

    <main>
      <div className="topbar">
        <div><span className="eyebrow">{page.toUpperCase()}</span>
          <h1>{nav.find(x=>x[0]===page)?.[1]}</h1>
          <p>{page==='dashboard'?'今天只看最重要的事：正在做什么、下一步做什么。':'禾十七的旅行内容资产管理中心。'}</p>
        </div>
        <div className="topActions">
          <button className="secondary" onClick={loadAll}><RefreshCw size={16}/>刷新</button>
          <button onClick={addTopic}><Plus size={16}/>新增选题</button>
        </div>
      </div>

      {!supabase && <div className="warning">
        当前是“待连接云端”状态。部署时填入 Supabase URL 和 Anon Key 后即可开启登录、云端保存与实时同步。
      </div>}

      {loading && <div className="loading">正在加载云端数据…</div>}

      {!loading && page==='dashboard' && <>
        <section className="stats">
          <Metric label="已发布" value={published}/>
          <Metric label="待制作" value={pending}/>
          <Metric label="素材目的地" value={destinations.length}/>
          <Metric label="当前最佳单篇" value={bestPost?bestPost.views.toLocaleString():'—'}/>
        </section>
        <section className="feature">
          <div>
            <span className="eyebrow">CURRENT FOCUS</span>
            <h2>香港 · Citywalk</h2>
            <span className="pill">制作中 · 封面与图文阶段</span>
            <div className="progress"><i/></div>
            <div className="miniGrid">
              <Info k="下一步" v="完成图文排版"/>
              <Info k="内容模型" v="深圳出发 × 周末 Citywalk"/>
              <Info k="发布后" v="记录24h / 7d数据"/>
              <Info k="判断" v="收藏率 + 关注转化"/>
            </div>
          </div>
          <div className="featureNote">
            <b>本周策略</b>
            <p>香港第一篇发布前，不继续扩新选题。</p>
            <p>若香港继续高于账号基线，下一篇继续打香港。</p>
          </div>
        </section>
        <Kanban topics={topics} advance={advanceTopic}/>
      </>}

      {!loading && page==='materials' && <>
        <Toolbar value={destSearch} onChange={setDestSearch} placeholder="搜索目的地…"/>
        <section className="destGrid">
          {filteredDest.map(d=><article className="destCard" key={d.id}>
            <div className="destCover">{d.cover_url?<img src={d.cover_url}/>:<ImageIcon/>}</div>
            <div className="cardBody"><h3>{d.name}</h3><p>{d.region||'旅行素材'}</p>
              <div className="cardMeta"><span>旅行 {d.trip_count}</span><span>素材 {d.material_count}</span></div>
              <div className="cardMeta"><span>已发 {d.published_count}</span><span>待开发 {d.idea_count}</span></div>
            </div>
          </article>)}
          {!filteredDest.length && <Empty text="还没有目的地数据。先在数据库里添加第一条旅行。"/>}
        </section>
      </>}

      {!loading && page==='topics' && <>
        <Toolbar value={topicSearch} onChange={setTopicSearch} placeholder="搜索选题 / 目的地 / 类型…"/>
        <div className="tableWrap"><table><thead><tr>
          <th>目的地</th><th>选题</th><th>类型</th><th>状态</th><th>小红书</th><th></th>
        </tr></thead><tbody>
          {filteredTopics.map(t=><tr key={t.id}>
            <td>{t.destination}</td><td><b>{t.title}</b></td><td>{t.content_type}</td>
            <td><span className={`status ${t.status}`}>{statusName[t.status]}</span></td>
            <td>{t.xhs_url?<a href={t.xhs_url} target="_blank">打开 <ExternalLink size={13}/></a>:'—'}</td>
            <td><button className="smallBtn" onClick={()=>advanceTopic(t)}>推进</button></td>
          </tr>)}
        </tbody></table></div>
      </>}

      {!loading && page==='production' && <section className="editorGrid">
        <div className="mediaPanel">
          <div className="uploadBox"><UploadCloud/><b>旅行素材</b><span>正式部署后可上传到 Supabase Storage</span></div>
          <div className="note">封面原则：原图保留人物，不修改样貌；只做文字排版与轻量视觉元素。</div>
        </div>
        <div className="formPanel">
          <Field label="内容标题"><input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
          <Field label="封面主标题"><input value={draft.cover_title} onChange={e=>setDraft({...draft,cover_title:e.target.value})}/></Field>
          <Field label="封面辅助标题"><input value={draft.cover_subtitle} onChange={e=>setDraft({...draft,cover_subtitle:e.target.value})}/></Field>
          <Field label="路线"><textarea value={draft.route} onChange={e=>setDraft({...draft,route:e.target.value})}/></Field>
          <Field label="正文"><textarea rows={7} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></Field>
          <Field label="小红书笔记链接"><input placeholder="发布后粘贴链接即可绑定" value={draft.xhs_url} onChange={e=>setDraft({...draft,xhs_url:e.target.value})}/></Field>
          <button onClick={saveDraft}><Save size={16}/>保存到云端</button>
        </div>
      </section>}

      {!loading && page==='analytics' && <>
        <section className="stats">
          <Metric label="笔记数" value={posts.length}/>
          <Metric label="最高浏览" value={bestPost?bestPost.views.toLocaleString():'—'}/>
          <Metric label="累计收藏" value={posts.reduce((s,p)=>s+p.saves,0).toLocaleString()}/>
          <Metric label="累计涨粉" value={posts.reduce((s,p)=>s+p.follows,0).toLocaleString()}/>
        </section>
        <div className="tableWrap"><table><thead><tr>
          <th>笔记</th><th>浏览</th><th>点赞</th><th>收藏</th><th>评论</th><th>涨粉</th><th>收藏率</th>
        </tr></thead><tbody>
          {posts.map(p=><tr key={p.id}><td><b>{p.title}</b></td><td>{p.views}</td><td>{p.likes}</td>
            <td>{p.saves}</td><td>{p.comments}</td><td>{p.follows}</td>
            <td>{p.views?((p.saves/p.views)*100).toFixed(1)+'%':'—'}</td></tr>)}
        </tbody></table></div>
      </>}

      {!loading && page==='website' && <section className="websiteList">
        {posts.filter(p=>p.views>=1000).map(p=><article key={p.id}>
          <div><span className="eyebrow">CANDIDATE</span><h3>{p.title}</h3>
            <p>小红书已获得 {p.views.toLocaleString()} 浏览，建议评估扩写为独立站长文章。</p></div>
          <span className="pill">推荐扩写</span>
        </article>)}
        {!posts.filter(p=>p.views>=1000).length && <Empty text="还没有达到候选阈值的内容。"/>}
      </section>}
    </main>
  </div>
}

function Metric({label,value}:{label:string,value:string|number}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}
function Info({k,v}:{k:string,v:string}) { return <div><b>{k}</b><span>{v}</span></div> }
function Field({label,children}:{label:string,children:React.ReactNode}) {
  return <label className="field"><span>{label}</span>{children}</label>
}
function Toolbar({value,onChange,placeholder}:{value:string,onChange:(v:string)=>void,placeholder:string}) {
  return <div className="toolbar"><Search size={18}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>
}
function Empty({text}:{text:string}) { return <div className="empty">{text}</div> }
function Kanban({topics,advance}:{topics:Topic[],advance:(t:Topic)=>void}) {
  const cols: [TopicStatus,string][]=[['idea','💡 选题'],['doing','📝 制作中'],['ready','⏰ 待发布'],['done','✅ 已发布']]
  return <section className="kanban">{cols.map(([s,label])=><div className="kanCol" key={s}><b>{label}</b>
    {topics.filter(t=>t.status===s).slice(0,4).map(t=><button className="task" key={t.id} onClick={()=>advance(t)}>
      <strong>{t.title}</strong><span>{t.destination} · {t.content_type}</span></button>)}
  </div>)}</section>
}
