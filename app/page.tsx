'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Home, Map, Lightbulb, PenSquare, BarChart3, Globe2, Plus, Search,
  ExternalLink, Save, RefreshCw, Image as ImageIcon, UploadCloud, Menu, X,
  LogOut, CheckCircle2, Cloud, Send, Link2, TrendingUp
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
type DraftForm = {
  title:string; cover_title:string; cover_subtitle:string; route:string; body:string; xhs_url:string
}
type MetricForm = {
  views:string; likes:string; saves:string; comments:string; shares:string; follows:string
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

function n(value:string){ return Number(value || 0) || 0 }

export default function HomePage() {
  const [page,setPage] = useState<Page>('dashboard')
  const [menu,setMenu] = useState(false)
  const [loading,setLoading] = useState(true)
  const [authReady,setAuthReady] = useState(false)
  const [userEmail,setUserEmail] = useState<string|null>(null)
  const [topics,setTopics] = useState<Topic[]>([])
  const [destinations,setDestinations] = useState<Destination[]>([])
  const [posts,setPosts] = useState<Post[]>([])
  const [topicSearch,setTopicSearch] = useState('')
  const [destSearch,setDestSearch] = useState('')
  const [selectedTopicId,setSelectedTopicId] = useState('')
  const [selectedPostId,setSelectedPostId] = useState('')
  const [savingDraft,setSavingDraft] = useState(false)
  const [publishing,setPublishing] = useState(false)
  const [savingMetric,setSavingMetric] = useState(false)
  const [draft,setDraft] = useState<DraftForm>({
    title:'', cover_title:'', cover_subtitle:'', route:'', body:'', xhs_url:''
  })
  const [metric,setMetric] = useState<MetricForm>({
    views:'',likes:'',saves:'',comments:'',shares:'',follows:''
  })

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

  useEffect(()=>{
    if(!supabase){ setLoading(false); setAuthReady(true); return }
    let mounted = true
    async function initAuth(){
      const current = new URL(window.location.href)
      const code = current.searchParams.get('code')
      if(code){
        await supabase!.auth.exchangeCodeForSession(code)
        current.searchParams.delete('code')
        window.history.replaceState({},'',current.pathname + current.search + current.hash)
      }
      const {data:{session}} = await supabase!.auth.getSession()
      if(mounted){ setUserEmail(session?.user.email || null); setAuthReady(true) }
      await loadAll()
    }
    initAuth()
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session)=>{
      setUserEmail(session?.user.email || null)
      setAuthReady(true)
      setTimeout(()=>loadAll(),0)
    })
    return ()=>{ mounted=false; subscription.unsubscribe() }
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!supabase) return
    const channel = supabase.channel('h17-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'topics'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'post_metrics'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'drafts'},()=>loadAll())
      .subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!selectedTopicId && topics.length){
      const first = topics.find(t=>t.status==='doing') || topics.find(t=>t.status==='ready') || topics[0]
      setSelectedTopicId(first.id)
    }
  },[topics,selectedTopicId])

  useEffect(()=>{
    if(!selectedPostId && posts.length) setSelectedPostId(posts[0].id)
  },[posts,selectedPostId])

  useEffect(()=>{
    if(!supabase || !selectedTopicId) return
    async function loadDraft(){
      const topic = topics.find(t=>t.id===selectedTopicId)
      const {data} = await supabase!.from('drafts').select('*').eq('topic_id',selectedTopicId)
        .order('version',{ascending:false}).limit(1).maybeSingle()
      if(data){
        setDraft({
          title:data.title||topic?.title||'', cover_title:data.cover_title||'', cover_subtitle:data.cover_subtitle||'',
          route:data.route||'', body:data.body||'', xhs_url:data.xhs_url||topic?.xhs_url||''
        })
      } else {
        const isHK = topic?.destination==='香港'
        setDraft({
          title:topic?.title||'',
          cover_title:isHK?'香港暴走一天':'',
          cover_subtitle:isHK?'深圳出发 · 不赶景点的 Citywalk':'',
          route:isHK?'福田口岸 → 中环 → 奥卑利街 → 尖沙咀 → 庙街 → 维港':'',
          body:'', xhs_url:topic?.xhs_url||''
        })
      }
    }
    loadDraft()
  },[selectedTopicId,supabase,topics])

  useEffect(()=>{
    const post = posts.find(p=>p.id===selectedPostId)
    if(post) setMetric({
      views:String(post.views||0),likes:String(post.likes||0),saves:String(post.saves||0),
      comments:String(post.comments||0),shares:'0',follows:String(post.follows||0)
    })
  },[selectedPostId,posts])

  async function addTopic() {
    if(!supabase) return alert('云端连接尚未就绪')
    const {data:{user}} = await supabase.auth.getUser()
    if(!user) return alert('请先登录')
    const title = prompt('输入选题标题')
    if(!title) return
    const destination = prompt('目的地','香港') || '未分类'
    const content_type = prompt('类型：路线型 / 决策型 / 实用型 / 经验型','路线型') || '路线型'
    const {error} = await supabase.from('topics').insert({title,destination,content_type,status:'idea'})
    if(error) alert(error.message); else loadAll()
  }

  async function addDestination(){
    if(!supabase) return alert('云端连接尚未就绪')
    const {data:{user}} = await supabase.auth.getUser()
    if(!user) return alert('请先登录')
    const name = prompt('目的地名称')
    if(!name) return
    const region = prompt('地区 / 分类，例如：广东、国内长线、出境','') || null
    const {error} = await supabase.from('destinations').insert({user_id:user.id,name,region})
    if(error) alert(error.message); else loadAll()
  }

  async function advanceTopic(t:Topic) {
    if(!supabase) return
    const order:TopicStatus[]=['idea','doing','ready','done']
    const next=order[(order.indexOf(t.status)+1)%order.length]
    const {error} = await supabase.from('topics').update({status:next}).eq('id',t.id)
    if(error) alert(error.message)
  }

  async function saveDraft() {
    if(!supabase || !selectedTopicId) return alert('请先选择一个选题')
    const user = (await supabase.auth.getUser()).data.user
    if(!user) return alert('请先登录')
    setSavingDraft(true)
    const {data:last} = await supabase.from('drafts').select('version').eq('topic_id',selectedTopicId)
      .order('version',{ascending:false}).limit(1).maybeSingle()
    const xhsNoteId = draft.xhs_url ? parseXhsNoteId(draft.xhs_url) : null
    const {error} = await supabase.from('drafts').insert({
      ...draft, user_id:user.id, topic_id:selectedTopicId, xhs_note_id:xhsNoteId, version:(last?.version||0)+1
    })
    setSavingDraft(false)
    if(error) alert(error.message); else alert('已保存为新的云端版本')
  }

  async function publishTopic(){
    if(!supabase || !selectedTopicId) return alert('请先选择一个选题')
    const {data:{user}} = await supabase.auth.getUser()
    if(!user) return alert('请先登录')
    const topic = topics.find(t=>t.id===selectedTopicId)
    if(!topic) return
    if(!draft.xhs_url) return alert('发布后先粘贴小红书笔记链接，再标记已发布。')
    setPublishing(true)
    const noteId = parseXhsNoteId(draft.xhs_url)
    const {data:existing} = await supabase.from('posts').select('id').eq('topic_id',selectedTopicId).limit(1).maybeSingle()
    let error:any = null
    if(existing){
      const r = await supabase.from('posts').update({
        title:draft.title||topic.title,destination:topic.destination,xhs_url:draft.xhs_url,
        xhs_note_id:noteId,published_at:new Date().toISOString()
      }).eq('id',existing.id)
      error = r.error
    } else {
      const r = await supabase.from('posts').insert({
        user_id:user.id,topic_id:selectedTopicId,title:draft.title||topic.title,destination:topic.destination,
        xhs_url:draft.xhs_url,xhs_note_id:noteId,published_at:new Date().toISOString()
      })
      error = r.error
    }
    if(!error){
      await supabase.from('topics').update({status:'done',xhs_url:draft.xhs_url}).eq('id',selectedTopicId)
      await loadAll()
      alert('已标记为已发布，并绑定小红书链接。')
    } else alert(error.message)
    setPublishing(false)
  }

  async function saveMetricSnapshot(){
    if(!supabase || !selectedPostId) return alert('请先选择一篇已发布笔记')
    const {data:{user}} = await supabase.auth.getUser()
    if(!user) return alert('请先登录')
    setSavingMetric(true)
    const {error} = await supabase.from('post_metrics').insert({
      user_id:user.id,post_id:selectedPostId,views:n(metric.views),likes:n(metric.likes),saves:n(metric.saves),
      comments:n(metric.comments),shares:n(metric.shares),follows:n(metric.follows)
    })
    setSavingMetric(false)
    if(error) alert(error.message); else { await loadAll(); alert('数据快照已保存。以后可以继续录入 24h / 7d / 30d 数据。') }
  }

  async function signIn() {
    if(!supabase) return alert('云端连接尚未就绪')
    const email = prompt('输入登录邮箱')
    if(!email) return
    const {error} = await supabase.auth.signInWithOtp({email, options:{emailRedirectTo:location.origin}})
    if(error) alert(error.message); else alert('登录链接已发送到邮箱')
  }

  async function signOut() {
    if(!supabase) return
    await supabase.auth.signOut()
    setUserEmail(null); setTopics([]); setDestinations([]); setPosts([])
  }

  const filteredTopics = topics.filter(t =>
    (t.title+t.destination+t.content_type).toLowerCase().includes(topicSearch.toLowerCase())
  )
  const filteredDest = destinations.filter(d => d.name.toLowerCase().includes(destSearch.toLowerCase()))
  const published = posts.length
  const pending = topics.filter(t=>t.status!=='done').length
  const bestPost = [...posts].sort((a,b)=>b.views-a.views)[0]
  const currentTopic = topics.find(t=>t.status==='doing') || topics.find(t=>t.status==='ready') || topics.find(t=>t.status==='idea')
  const selectedPost = posts.find(p=>p.id===selectedPostId)
  const saveRate = selectedPost?.views ? ((selectedPost.saves/selectedPost.views)*100).toFixed(1)+'%' : '—'
  const engagement = selectedPost?.views ? (((selectedPost.likes+selectedPost.saves+selectedPost.comments)/selectedPost.views)*100).toFixed(1)+'%' : '—'

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><strong>禾十七</strong><span>TRAVEL CONTENT STUDIO</span></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''}
        onClick={()=>setPage(id as Page)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sideFoot">
        {authReady && userEmail ? <>
          <div className="accountState"><CheckCircle2 size={15}/><span>已登录 · 云端同步开启</span></div>
          <button className="ghost" onClick={signOut}><LogOut size={15}/>退出登录</button>
        </> : <button className="ghost" onClick={signIn}>邮箱登录</button>}
        <span>手机 / 电脑共享同一套数据</span>
      </div>
    </aside>

    <header className="mobileHeader">
      <div className="brand"><strong>禾十七</strong></div>
      <button className="icon" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
    </header>
    {menu && <div className="mobileMenu">
      {nav.map(([id,label,Icon])=><button key={id} onClick={()=>{setPage(id as Page);setMenu(false)}}><Icon size={18}/>{label}</button>)}
      {userEmail ? <button onClick={signOut}><LogOut size={18}/>退出登录</button> : <button onClick={signIn}>邮箱登录</button>}
    </div>}

    <main>
      <div className="topbar">
        <div><span className="eyebrow">{page.toUpperCase()}</span>
          <h1>{nav.find(x=>x[0]===page)?.[1]}</h1>
          <p>{page==='dashboard'?'今天只看最重要的事：正在做什么、下一步做什么。':'禾十七的旅行内容资产管理中心。'}</p>
        </div>
        <div className="topActions">
          <button className="secondary" onClick={loadAll}><RefreshCw size={16}/>刷新</button>
          {page==='materials'?<button onClick={addDestination}><Plus size={16}/>新增目的地</button>:<button onClick={addTopic}><Plus size={16}/>新增选题</button>}
        </div>
      </div>

      {authReady && <div className={`syncBar ${userEmail?'connected':'pending'}`}>
        <div>{userEmail?<><Cloud size={17}/><b>云端已连接</b><span>登录成功，跨设备实时同步已开启。</span></>:<><Cloud size={17}/><b>云端已连接</b><span>还未登录，登录后才能保存你的私人数据。</span></>}</div>
        {!userEmail && <button onClick={signIn}>邮箱登录</button>}
      </div>}

      {loading && <div className="loading">正在加载云端数据…</div>}

      {!loading && page==='dashboard' && <>
        <section className="stats">
          <Metric label="已发布" value={published}/><Metric label="待制作" value={pending}/>
          <Metric label="素材目的地" value={destinations.length}/><Metric label="当前最佳单篇" value={bestPost?bestPost.views.toLocaleString():'—'}/>
        </section>
        <section className="feature">
          <div>
            <span className="eyebrow">CURRENT FOCUS</span>
            <h2>{currentTopic?`${currentTopic.destination} · ${currentTopic.title}`:'暂无当前重点'}</h2>
            <span className="pill">{currentTopic?statusName[currentTopic.status]:'待建立'} · 内容工作流</span>
            <div className="progress"><i/></div>
            <div className="miniGrid">
              <Info k="下一步" v={currentTopic?.status==='ready'?'发布并绑定小红书':'完成封面、图文与正文'}/>
              <Info k="内容模型" v={currentTopic?`${currentTopic.destination} × ${currentTopic.content_type}`:'—'}/>
              <Info k="发布后" v="记录 24h / 7d 数据"/><Info k="判断" v="收藏率 + 互动率 + 涨粉"/>
            </div>
          </div>
          <div className="featureNote"><b>本周策略</b><p>先把当前制作中的内容完整跑通：制作 → 发布 → 数据复盘。</p><p>暂时不追求大量发文，优先建立可重复的工作流。</p></div>
        </section>
        <Kanban topics={topics} advance={advanceTopic}/>
      </>}

      {!loading && page==='materials' && <>
        <Toolbar value={destSearch} onChange={setDestSearch} placeholder="搜索目的地…"/>
        <section className="destGrid">
          {filteredDest.map(d=><article className="destCard" key={d.id}>
            <div className="destCover">{d.cover_url?<img src={d.cover_url} alt=""/>:<ImageIcon/>}</div>
            <div className="cardBody"><h3>{d.name}</h3><p>{d.region||'旅行素材'}</p>
              <div className="cardMeta"><span>旅行 {d.trip_count}</span><span>素材 {d.material_count}</span></div>
              <div className="cardMeta"><span>已发 {d.published_count}</span><span>待开发 {d.idea_count}</span></div>
            </div>
          </article>)}
        </section>
      </>}

      {!loading && page==='topics' && <>
        <Toolbar value={topicSearch} onChange={setTopicSearch} placeholder="搜索选题 / 目的地 / 类型…"/>
        <div className="tableWrap"><table><thead><tr><th>目的地</th><th>选题</th><th>类型</th><th>状态</th><th>小红书</th><th></th></tr></thead><tbody>
          {filteredTopics.map(t=><tr key={t.id}><td>{t.destination}</td><td><b>{t.title}</b></td><td>{t.content_type}</td>
            <td><span className={`status ${t.status}`}>{statusName[t.status]}</span></td>
            <td>{t.xhs_url?<a href={t.xhs_url} target="_blank" rel="noreferrer">打开 <ExternalLink size={13}/></a>:'—'}</td>
            <td><button className="smallBtn" onClick={()=>advanceTopic(t)}>推进</button></td></tr>)}
        </tbody></table></div>
      </>}

      {!loading && page==='production' && <section className="productionStack">
        <div className="workflowBar">
          <div><span className="eyebrow">CONTENT WORKFLOW</span><h3>选择一篇内容继续制作</h3></div>
          <select value={selectedTopicId} onChange={e=>setSelectedTopicId(e.target.value)}>
            {topics.filter(t=>t.status!=='done').map(t=><option key={t.id} value={t.id}>{t.destination}｜{t.title}（{statusName[t.status]}）</option>)}
          </select>
        </div>
        <div className="editorGrid">
          <div className="mediaPanel">
            <div className="uploadBox"><UploadCloud/><b>旅行素材</b><span>下一阶段接入图片云端上传与排序</span></div>
            <div className="note">当前阶段先把一篇内容从“制作中”完整跑到“发布 + 数据复盘”。</div>
          </div>
          <div className="formPanel">
            <Field label="内容标题"><input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
            <div className="twoFields"><Field label="封面主标题"><input value={draft.cover_title} onChange={e=>setDraft({...draft,cover_title:e.target.value})}/></Field>
              <Field label="封面辅助标题"><input value={draft.cover_subtitle} onChange={e=>setDraft({...draft,cover_subtitle:e.target.value})}/></Field></div>
            <Field label="路线"><textarea value={draft.route} onChange={e=>setDraft({...draft,route:e.target.value})}/></Field>
            <Field label="正文"><textarea rows={9} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></Field>
            <Field label="小红书笔记链接（发布后粘贴）"><input placeholder="https://www.xiaohongshu.com/explore/..." value={draft.xhs_url} onChange={e=>setDraft({...draft,xhs_url:e.target.value})}/></Field>
            <div className="formActions"><button className="secondary" onClick={saveDraft} disabled={savingDraft}><Save size={16}/>{savingDraft?'保存中…':'保存版本'}</button>
              <button onClick={publishTopic} disabled={publishing}><Send size={16}/>{publishing?'处理中…':'绑定链接并标记已发布'}</button></div>
          </div>
        </div>
      </section>}

      {!loading && page==='analytics' && <section className="analyticsStack">
        <div className="stats"><Metric label="笔记数" value={posts.length}/><Metric label="最高浏览" value={bestPost?bestPost.views.toLocaleString():'—'}/>
          <Metric label="累计收藏" value={posts.reduce((s,p)=>s+p.saves,0).toLocaleString()}/><Metric label="累计涨粉" value={posts.reduce((s,p)=>s+p.follows,0).toLocaleString()}/></div>
        <div className="snapshotPanel">
          <div className="snapshotHead"><div><span className="eyebrow">DATA SNAPSHOT</span><h3>录入最新小红书数据</h3></div>
            <select value={selectedPostId} onChange={e=>setSelectedPostId(e.target.value)}>{posts.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          {selectedPost && <>
            <div className="insightRow"><Info k="当前浏览" v={selectedPost.views.toLocaleString()}/><Info k="收藏率" v={saveRate}/><Info k="互动率" v={engagement}/>
              <div className="linkInfo"><Link2 size={15}/>{selectedPost.xhs_url?<a href={selectedPost.xhs_url} target="_blank" rel="noreferrer">打开原笔记</a>:<span>历史数据未绑定链接</span>}</div></div>
            <div className="metricForm">
              <NumberField label="浏览" value={metric.views} set={v=>setMetric({...metric,views:v})}/><NumberField label="点赞" value={metric.likes} set={v=>setMetric({...metric,likes:v})}/>
              <NumberField label="收藏" value={metric.saves} set={v=>setMetric({...metric,saves:v})}/><NumberField label="评论" value={metric.comments} set={v=>setMetric({...metric,comments:v})}/>
              <NumberField label="分享" value={metric.shares} set={v=>setMetric({...metric,shares:v})}/><NumberField label="涨粉" value={metric.follows} set={v=>setMetric({...metric,follows:v})}/>
            </div>
            <button onClick={saveMetricSnapshot} disabled={savingMetric}><TrendingUp size={16}/>{savingMetric?'保存中…':'保存数据快照'}</button>
          </>}
        </div>
        <div className="tableWrap"><table><thead><tr><th>笔记</th><th>浏览</th><th>点赞</th><th>收藏</th><th>评论</th><th>涨粉</th><th>收藏率</th></tr></thead><tbody>
          {posts.map(p=><tr key={p.id}><td><b>{p.title}</b></td><td>{p.views}</td><td>{p.likes}</td><td>{p.saves}</td><td>{p.comments}</td><td>{p.follows}</td>
            <td>{p.views?((p.saves/p.views)*100).toFixed(1)+'%':'—'}</td></tr>)}
        </tbody></table></div>
      </section>}

      {!loading && page==='website' && <section className="websiteList">
        {posts.filter(p=>p.views>=1000).map(p=><article key={p.id}><div><span className="eyebrow">CANDIDATE</span><h3>{p.title}</h3>
          <p>小红书已获得 {p.views.toLocaleString()} 浏览，建议评估扩写为独立站长文章。</p></div><span className="pill">推荐扩写</span></article>)}
      </section>}
    </main>
  </div>
}

function Metric({label,value}:{label:string,value:string|number}) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }
function Info({k,v}:{k:string,v:string}) { return <div><b>{k}</b><span>{v}</span></div> }
function Field({label,children}:{label:string,children:React.ReactNode}) { return <label className="field"><span>{label}</span>{children}</label> }
function NumberField({label,value,set}:{label:string,value:string,set:(v:string)=>void}) { return <label className="numberField"><span>{label}</span><input inputMode="numeric" value={value} onChange={e=>set(e.target.value.replace(/[^0-9]/g,''))}/></label> }
function Toolbar({value,onChange,placeholder}:{value:string,onChange:(v:string)=>void,placeholder:string}) { return <div className="toolbar"><Search size={18}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div> }
function Kanban({topics,advance}:{topics:Topic[],advance:(t:Topic)=>void}) {
  const cols: [TopicStatus,string][]=[['idea','💡 选题'],['doing','📝 制作中'],['ready','⏰ 待发布'],['done','✅ 已发布']]
  return <section className="kanban">{cols.map(([s,label])=><div className="kanCol" key={s}><b>{label}</b>
    {topics.filter(t=>t.status===s).slice(0,5).map(t=><button className="task" key={t.id} onClick={()=>advance(t)}><strong>{t.title}</strong><span>{t.destination} · {t.content_type}</span></button>)}
  </div>)}</section>
}
