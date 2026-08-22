'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, Heart, Bookmark, MessageCircle, Sparkles, Plus, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Post = {
  id:string
  user_id:string
  topic_id:string|null
  title:string
  destination:string
  published_at:string|null
  views:number
  likes:number
  saves:number
  comments:number
  follows:number
}

type Topic = {
  id:string
  user_id:string
  title:string
  destination:string
  content_type:string
  status:'idea'|'doing'|'ready'|'done'
  planned_at:string|null
}

type Delta = {likes:number;saves:number;comments:number;follows:number}

type Recommendation = {
  title:string
  destination:string
  contentType:string
  reason:string[]
  score:number
  topicId?:string
  generated?:boolean
}

function ageDays(v:string|null){
  if(!v)return 99
  return Math.max(0,(Date.now()-new Date(v).getTime())/86400000)
}

function saveRate(p:Post){return p.views?p.saves/p.views:0}
function engagementRate(p:Post){return p.views?(p.likes+p.saves+p.comments)/p.views:0}

function postStrength(p:Post){
  const freshness=Math.max(0,22-ageDays(p.published_at)*4)
  const depth=Math.min(20,Math.log10(Math.max(p.views,10))*5)
  const saveIntent=p.views?Math.min(30,saveRate(p)*900):Math.min(20,p.saves*3)
  const engagement=p.views?Math.min(18,engagementRate(p)*400):Math.min(12,(p.likes+p.comments)*1.5)
  return freshness+depth+saveIntent+engagement
}

function overlap(a:string,b:string){
  const clean=(s:string)=>s.toLowerCase().replace(/[｜|·，。！？、\s]/g,'')
  const x=clean(a),y=clean(b)
  if(!x||!y)return 0
  const grams=(s:string)=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)))
  const A=grams(x),B=grams(y)
  if(!A.size||!B.size)return 0
  let hit=0;A.forEach(g=>{if(B.has(g))hit++})
  return hit/Math.max(A.size,B.size)
}

function followupFor(p:Post):Recommendation{
  const t=p.title
  const dest=p.destination||'这次旅行'
  if(/Port\s*Dickson|波德申/i.test(t)){
    return {
      title:'Port Dickson到底值不值得专程去｜吉隆坡出发路线＋真实花费',
      destination:dest,
      contentType:'决策型',
      score:94,
      generated:true,
      reason:['最近一篇仍在获得收藏，先承接同主题余温','上一条偏“周末出国/体验”，下一条补“值不值得＋路线＋花费”，信息更完整','收藏型信号说明用户有出行决策需求，适合继续做可保存内容']
    }
  }
  if(/Arts|艺术|art\b/i.test(t)){
    return {
      title:`${dest}这条艺术路线怎么走最顺｜半天不绕路版本`,destination:dest,contentType:'路线型',score:90,generated:true,
      reason:['同主题持续出现收藏，说明具备长尾保存价值','下一篇从“地点展示”升级成“可照着走的路线”','用路线型承接收藏用户，比立刻切新目的地更顺']
    }
  }
  return {
    title:`${dest}第一次去怎么安排最顺｜路线＋花费＋避坑`,destination:dest,contentType:'路线型',score:84,generated:true,
    reason:['优先延续最近发布目的地，减少账号主题跳跃','路线＋花费＋避坑属于高保存意图结构','先把一个目的地做成内容簇，再切换新目的地']
  }
}

export default function XhsStrategyPanel(){
  const supabase=useMemo(()=>createClient(),[])
  const [posts,setPosts]=useState<Post[]>([])
  const [topics,setTopics]=useState<Topic[]>([])
  const [open,setOpen]=useState(true)
  const [loading,setLoading]=useState(true)
  const [selectedPostId,setSelectedPostId]=useState('')
  const [delta,setDelta]=useState<Delta>({likes:0,saves:0,comments:0,follows:0})
  const [message,setMessage]=useState('')
  const [showPulse,setShowPulse]=useState(false)

  async function load(){
    setLoading(true)
    const [{data:rawPosts},{data:summary},{data:topicRows}]=await Promise.all([
      supabase.from('posts').select('id,user_id,topic_id,title,destination,published_at').order('published_at',{ascending:false}),
      supabase.from('post_summary').select('*'),
      supabase.from('topics').select('id,user_id,title,destination,content_type,status,planned_at').order('created_at',{ascending:false})
    ])
    const sm=new Map((summary||[]).map((x:any)=>[x.id,x]))
    const merged=((rawPosts||[]) as any[]).map(p=>({
      ...p,
      views:sm.get(p.id)?.views||0,
      likes:sm.get(p.id)?.likes||0,
      saves:sm.get(p.id)?.saves||0,
      comments:sm.get(p.id)?.comments||0,
      follows:sm.get(p.id)?.follows||0,
    })) as Post[]
    setPosts(merged)
    setTopics((topicRows||[]) as Topic[])
    if(!selectedPostId&&merged[0])setSelectedPostId(merged[0].id)
    setLoading(false)
  }

  useEffect(()=>{
    void load()
    const channel=supabase.channel('h17-xhs-strategy')
      .on('postgres_changes',{event:'*',schema:'public',table:'post_metrics'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'topics'},()=>void load())
      .subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const recommendation=useMemo<Recommendation|null>(()=>{
    const candidates=topics.filter(t=>t.status==='idea')
    const recent=[...posts].sort((a,b)=>new Date(b.published_at||0).getTime()-new Date(a.published_at||0).getTime())[0]
    const strongest=[...posts].sort((a,b)=>postStrength(b)-postStrength(a))[0]
    if(!recent && !candidates.length)return null

    const destScore=new Map<string,number>()
    posts.forEach(p=>destScore.set(p.destination,(destScore.get(p.destination)||0)+postStrength(p)))

    const recentTopic=recent?.topic_id?topics.find(t=>t.id===recent.topic_id):null
    const preferred:Record<string,string[]>={
      '路线型':['实用型','决策型'],
      '实用型':['路线型','经验型'],
      '决策型':['路线型','实用型'],
      '经验型':['实用型','路线型'],
    }

    const scored=candidates.map(t=>{
      let score=28
      const reason:string[]=[]
      if(recent&&t.destination===recent.destination){score+=28;reason.push('承接最近发布目的地的流量余温')}
      if(strongest&&t.destination===strongest.destination){score+=14;reason.push('这个目的地已有真实数据支撑')}
      score+=Math.min(18,(destScore.get(t.destination)||0)/6)
      if(recentTopic&&preferred[recentTopic.content_type]?.includes(t.content_type)){score+=12;reason.push(`从${recentTopic.content_type}顺接到${t.content_type}，内容不重复`) }
      if(/路线|花费|预算|避坑|住宿|交通|怎么|第一次|值得|准备/.test(t.title)){score+=9;reason.push('题型具备搜索与收藏价值')}
      if(recent){const sim=overlap(t.title,recent.title);if(sim>.42){score-=14;reason.push('与上一条较像，已做重复惩罚')}}
      return {title:t.title,destination:t.destination,contentType:t.content_type,reason,score,topicId:t.id}
    }).sort((a,b)=>b.score-a.score)

    const normal=scored[0]||null
    if(recent&&ageDays(recent.published_at)<=3){
      const follow=followupFor(recent)
      const signal=postStrength(recent)
      follow.score+=Math.min(8,signal/10)
      if(!normal||follow.score>normal.score+5)return follow
    }
    return normal
  },[posts,topics])

  const recent=posts[0]
  const selectedPost=posts.find(p=>p.id===selectedPostId)||recent

  async function savePulse(){
    if(!selectedPost)return
    const total=delta.likes+delta.saves+delta.comments+delta.follows
    if(!total){setMessage('先记录至少一个新动态');return}
    setMessage('正在写入最新动态…')
    const {error}=await supabase.from('post_metrics').insert({
      user_id:selectedPost.user_id,
      post_id:selectedPost.id,
      views:selectedPost.views,
      likes:selectedPost.likes+delta.likes,
      saves:selectedPost.saves+delta.saves,
      comments:selectedPost.comments+delta.comments,
      shares:0,
      follows:selectedPost.follows+delta.follows,
    })
    if(error){setMessage(`保存失败：${error.message}`);return}
    setDelta({likes:0,saves:0,comments:0,follows:0})
    setMessage('已更新；“下一篇建议”已按新数据重算')
    await load()
  }

  async function adoptRecommendation(){
    if(!recommendation)return
    if(recommendation.topicId){
      const {error}=await supabase.from('topics').update({status:'doing'}).eq('id',recommendation.topicId)
      setMessage(error?`设置失败：${error.message}`:'已设为本周主内容')
      if(!error)await load()
      return
    }
    const owner=recent?.user_id||topics[0]?.user_id
    if(!owner){setMessage('还没有可用的工作区 owner');return}
    const {error}=await supabase.from('topics').insert({
      user_id:owner,
      title:recommendation.title,
      destination:recommendation.destination,
      content_type:recommendation.contentType,
      status:'doing',
      planned_at:new Date().toISOString(),
    })
    setMessage(error?`加入失败：${error.message}`:'已把这篇加入本周主内容')
    if(!error)await load()
  }

  const inc=(k:keyof Delta)=>setDelta(v=>({...v,[k]:v[k]+1}))

  return <aside className={`h17StrategyDock ${open?'open':'closed'}`}>
    <button className="h17StrategyToggle" onClick={()=>setOpen(v=>!v)}>
      <span><Sparkles size={15}/> 下一篇建议</span>{open?<ChevronDown size={16}/>:<ChevronUp size={16}/>} 
    </button>
    {open&&<div className="h17StrategyBody">
      {loading?<div className="h17StrategyMuted">正在按真实数据重算…</div>:recommendation?<>
        <div className="h17StrategyScore"><span>策略分</span><b>{Math.round(recommendation.score)}</b></div>
        <div className="h17StrategyTitle">{recommendation.title}</div>
        <div className="h17StrategyMeta">{recommendation.destination} · {recommendation.contentType}</div>
        <div className="h17StrategyReasons">{recommendation.reason.slice(0,3).map((r,i)=><div key={i}>✓ {r}</div>)}</div>
        <button className="h17StrategyPrimary" onClick={()=>void adoptRecommendation()}>{recommendation.generated?'加入并设为本周':'就发这篇'}</button>
      </>:<div className="h17StrategyMuted">先发布并记录一篇内容，系统才有依据。</div>}

      <div className="h17PulseHead"><button onClick={()=>setShowPulse(v=>!v)}><BarChart3 size={14}/> 最近动态快记 {showPulse?'收起':'展开'}</button><button title="刷新" onClick={()=>void load()}><RefreshCw size={14}/></button></div>
      {showPulse&&<div className="h17PulseBox">
        <select value={selectedPostId} onChange={e=>setSelectedPostId(e.target.value)}>{posts.slice(0,8).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <div className="h17PulseBtns">
          <button onClick={()=>inc('likes')}><Heart size={14}/> 赞 +{delta.likes}</button>
          <button onClick={()=>inc('saves')}><Bookmark size={14}/> 收藏 +{delta.saves}</button>
          <button onClick={()=>inc('comments')}><MessageCircle size={14}/> 评论 +{delta.comments}</button>
          <button onClick={()=>inc('follows')}><Plus size={14}/> 涨粉 +{delta.follows}</button>
        </div>
        <button className="h17PulseSave" onClick={()=>void savePulse()}>保存这批新动态</button>
        <small>只记录“这次新增加的”互动，系统会在原有累计数据上追加并立即重算下一篇。</small>
      </div>}
      {message&&<div className="h17StrategyMessage">{message}</div>}
    </div>}
  </aside>
}
