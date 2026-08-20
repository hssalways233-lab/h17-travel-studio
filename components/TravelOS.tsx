'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Home, Plane, PenSquare, BarChart3, Globe2, Cloud, CheckCircle2, LogOut,
  UploadCloud, Sparkles, Copy, ChevronRight, Trash2, Star, RefreshCw,
  Image as ImageIcon, Search, ExternalLink, Camera, MapPin, Clock3, Send
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Topic, TopicStatus } from '@/lib/types'

type Page = 'today'|'travel'|'content'|'analytics'|'website'
type ContentStep = 'media'|'copy'|'publish'|'metrics'

type Destination = {
  id:string; name:string; region:string|null; trip_count:number; material_count:number;
  published_count:number; idea_count:number; cover_url:string|null
}
type Post = {
  id:string; topic_id:string|null; title:string; destination:string; xhs_url:string|null; published_at:string|null;
  views:number; likes:number; saves:number; comments:number; follows:number
}
type Material = {
  id:string; destination_id:string|null; storage_path:string; tags:string[]; caption:string|null; created_at:string; url?:string
}
type DraftForm = {
  title:string; cover_title:string; cover_subtitle:string; route:string; body:string; xhs_url:string
}
type WebsiteArticle = {
  id:string; source_post_id:string|null; title:string; status:string; body:string|null; created_at:string
}
type MetricForm = {views:string;likes:string;saves:string;comments:string;shares:string;follows:string}

type NavItem = {id:Page;label:string;icon:typeof Home}

const nav:NavItem[] = [
  {id:'today',label:'今天',icon:Home},
  {id:'travel',label:'旅行',icon:Plane},
  {id:'content',label:'内容',icon:PenSquare},
  {id:'analytics',label:'数据',icon:BarChart3},
  {id:'website',label:'独立站',icon:Globe2},
]

const statusName:Record<TopicStatus,string>={idea:'候选',doing:'制作中',ready:'待发布',done:'已发布'}
const stepLabel:Record<ContentStep,string>={media:'① 素材',copy:'② 图文',publish:'③ 发布',metrics:'④ 数据'}

const topicBank:Record<string,Array<[string,string]>>={
  '香港':[
    ['深圳出发香港一天怎么走最顺','路线型'],['香港一天真实花费要多少','实用型'],['香港Citywalk不赶景点路线','路线型'],
    ['第一次去香港最容易踩的坑','经验型'],['福田口岸去香港最省事的走法','实用型'],['香港这些地方我会二刷','经验型']
  ],
  '马来西亚':[
    ['第一次去马来西亚最容易踩的坑','实用型'],['吉隆坡3天2夜怎么排最顺','路线型'],['马来西亚旅行真实花费怎么准备','决策型'],
    ['去马来西亚前一定要知道的6件事','经验型'],['吉隆坡住哪里出行最方便','决策型'],['马来西亚哪些东西值得买','实用型']
  ],
  '新疆':[
    ['第一次去新疆路线怎么选','路线型'],['新疆旅行真实花费','决策型'],['去新疆才知道的6件事','经验型'],
    ['新疆旅行出发前准备清单','实用型'],['新疆到底适合几月份去','决策型'],['新疆长线旅行怎么少踩坑','经验型']
  ],
  '云南':[
    ['云南第一次自由行路线怎么排','路线型'],['云南旅行回来后的真实建议','经验型'],['云南旅行真实花费','决策型'],
    ['云南哪些地方值得二刷','经验型'],['云南旅行最容易浪费时间的地方','决策型'],['去云南前一定要准备的东西','实用型']
  ],
  '深圳周边':[
    ['周末只有一天我会去哪里','路线型'],['深圳打工人周末放空地','路线型'],['深圳周边不赶路的一日游','路线型'],
    ['深圳周末低预算怎么玩','实用型'],['深圳出发2小时能到的地方','决策型'],['深圳周边我会反复去的小城','经验型']
  ],
  '东山岛 / 漳州':[
    ['深圳出发2.5小时周末看海','路线型'],['东山岛到底值不值得去','决策型'],['漳州和东山岛怎么一起玩','路线型'],
    ['东山岛周末真实花费','实用型'],['第一次去东山岛怎么少踩坑','经验型'],['漳州古城一天怎么逛','路线型']
  ],
  '泰国':[
    ['泰国出发前准备清单','实用型'],['泰国自由行真实花费','决策型'],['曼谷第一次去怎么排最顺','路线型'],
    ['第一次去泰国最容易踩的坑','经验型'],['泰国值得买的伴手礼','实用型'],['泰国榴莲怎么吃不踩雷','经验型']
  ]
}

function mondayISO(){
  const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d.toISOString()
}
function safeName(name:string){
  const ext=name.includes('.')?'.'+name.split('.').pop():''
  const base=name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48)||'image'
  return `${base}${ext.toLowerCase()}`
}
function n(v:string){return Number(v||0)||0}
function parseXhsNoteId(url:string){
  const m=url.match(/\/explore\/([a-zA-Z0-9]+)/)||url.match(/\/discovery\/item\/([a-zA-Z0-9]+)/)
  return m?.[1]??null
}
function shortCoverTitle(title:string,destination:string){
  const cleaned=title.replace(destination,'').replace(/[｜|·]/g,' ').trim()
  return (cleaned||`${destination}旅行攻略`).slice(0,14)
}
function saveRate(p:Post){return p.views?p.saves/p.views:0}
function followRate(p:Post){return p.views?p.follows/p.views:0}
function websiteScore(p:Post){
  const searchIntent=/攻略|路线|花费|准备|避坑|怎么|第一次|交通|住宿|值得/.test(p.title)?14:5
  const depth=Math.min(34,Math.log10(Math.max(p.views,10))*10)
  return Math.min(100,Math.round(depth+saveRate(p)*900+followRate(p)*1700+searchIntent))
}

export default function TravelOS(){
  const supabase=useMemo(()=>createClient(),[])
  const [page,setPage]=useState<Page>('today')
  const [step,setStep]=useState<ContentStep>('media')
  const [authReady,setAuthReady]=useState(false)
  const [userEmail,setUserEmail]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [topics,setTopics]=useState<Topic[]>([])
  const [destinations,setDestinations]=useState<Destination[]>([])
  const [posts,setPosts]=useState<Post[]>([])
  const [materials,setMaterials]=useState<Material[]>([])
  const [websiteArticles,setWebsiteArticles]=useState<WebsiteArticle[]>([])
  const [selectedTopicId,setSelectedTopicId]=useState('')
  const [selectedDestination,setSelectedDestination]=useState('')
  const [destSearch,setDestSearch]=useState('')
  const [selectedMaterials,setSelectedMaterials]=useState<Material[]>([])
  const [destinationPreview,setDestinationPreview]=useState<Material[]>([])
  const [draft,setDraft]=useState<DraftForm>({title:'',cover_title:'',cover_subtitle:'',route:'',body:'',xhs_url:''})
  const [metric,setMetric]=useState<MetricForm>({views:'',likes:'',saves:'',comments:'',shares:'',follows:''})
  const [saving,setSaving]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [smartMessage,setSmartMessage]=useState('')
  const [copyStatus,setCopyStatus]=useState('')
  const [mobileUploadOpen,setMobileUploadOpen]=useState(false)
  const fileInputRef=useRef<HTMLInputElement|null>(null)
  const mobileFileRef=useRef<HTMLInputElement|null>(null)

  const selectedTopic=topics.find(t=>t.id===selectedTopicId)||null
  const selectedPost=posts.find(p=>p.topic_id===selectedTopicId)||null
  const currentTopic=topics.find(t=>t.status==='doing')||topics.find(t=>t.status==='ready')||topics.find(t=>t.status==='idea')||null
  const bestPost=[...posts].sort((a,b)=>b.views-a.views)[0]

  async function loadAll(){
    setLoading(true)
    const [{data:t},{data:d},{data:rawPosts},{data:summary},{data:m},{data:w}]=await Promise.all([
      supabase.from('topics').select('*').order('created_at',{ascending:false}),
      supabase.from('destination_summary').select('*').order('idea_count',{ascending:false}),
      supabase.from('posts').select('id,topic_id,title,destination,xhs_url,published_at').order('published_at',{ascending:false}),
      supabase.from('post_summary').select('*'),
      supabase.from('materials').select('id,destination_id,storage_path,tags,caption,created_at').order('created_at',{ascending:false}),
      supabase.from('website_articles').select('*').order('created_at',{ascending:false})
    ])
    const sm=new Map((summary||[]).map((x:any)=>[x.id,x]))
    const merged=(rawPosts||[]).map((p:any)=>({...p,views:sm.get(p.id)?.views||0,likes:sm.get(p.id)?.likes||0,saves:sm.get(p.id)?.saves||0,comments:sm.get(p.id)?.comments||0,follows:sm.get(p.id)?.follows||0}))
    setTopics((t||[]) as Topic[])
    setDestinations((d||[]) as Destination[])
    setPosts(merged as Post[])
    setMaterials((m||[]) as Material[])
    setWebsiteArticles((w||[]) as WebsiteArticle[])
    setLoading(false)
  }

  async function ensureWeeklyTopics(){
    const {data:{user}}=await supabase.auth.getUser();if(!user)return
    const {data:t}=await supabase.from('topics').select('title,planned_at')
    const rows=(t||[]) as Array<{title:string;planned_at:string|null}>
    const week=mondayISO();const existing=rows.filter(x=>x.planned_at&&new Date(x.planned_at)>=new Date(week)).length
    const need=Math.max(0,6-existing);if(!need)return
    const {data:d}=await supabase.from('destinations').select('name').order('created_at',{ascending:true})
    const pool=(d||[]).map((x:any)=>x.name).filter(Boolean)
    const dests=pool.length?pool:Object.keys(topicBank)
    const used=new Set(rows.map(x=>x.title));const inserts:any[]=[]
    const weekNo=Math.floor(new Date(week).getTime()/604800000)
    for(let round=0;round<12&&inserts.length<need;round++){
      for(let i=0;i<dests.length&&inserts.length<need;i++){
        const destination=dests[(weekNo+i+round)%dests.length]
        const bank=topicBank[destination]||[[`${destination}第一次去怎么安排更顺`,'路线型'],[`${destination}真实旅行花费`,'决策型'],[`${destination}出发前准备清单`,'实用型']]
        const [title,content_type]=bank[(weekNo+i+round)%bank.length]
        if(used.has(title)||inserts.some(x=>x.title===title))continue
        inserts.push({user_id:user.id,title,destination,content_type,status:'idea',planned_at:week})
      }
    }
    if(inserts.length)await supabase.from('topics').insert(inserts)
  }

  useEffect(()=>{
    let mounted=true
    async function init(){
      const current=new URL(window.location.href);const code=current.searchParams.get('code')
      if(code){await supabase.auth.exchangeCodeForSession(code);current.searchParams.delete('code');window.history.replaceState({},'',current.pathname+current.search+current.hash)}
      const {data:{session}}=await supabase.auth.getSession()
      if(mounted){setUserEmail(session?.user.email||null);setAuthReady(true)}
      if(session?.user){await ensureWeeklyTopics()}
      await loadAll()
    }
    void init()
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUserEmail(session?.user.email||null);setAuthReady(true);setTimeout(()=>{void loadAll()},0)
    })
    return()=>{mounted=false;subscription.unsubscribe()}
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    const channel=supabase.channel('h17-os-v2')
      .on('postgres_changes',{event:'*',schema:'public',table:'topics'},()=>void loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'materials'},()=>void loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>void loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'post_metrics'},()=>void loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'drafts'},()=>void loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'website_articles'},()=>void loadAll())
      .subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!selectedTopicId&&topics.length){
      const first=topics.find(t=>t.status==='doing')||topics.find(t=>t.status==='ready')||topics.find(t=>t.status==='idea')||topics[0]
      setSelectedTopicId(first.id)
    }
  },[topics,selectedTopicId])

  useEffect(()=>{
    if(!selectedTopicId)return
    async function loadSelected(){
      const topic=topics.find(t=>t.id===selectedTopicId)
      const [{data:d},{data:m}]=await Promise.all([
        supabase.from('drafts').select('*').eq('topic_id',selectedTopicId).order('version',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('materials').select('id,destination_id,storage_path,tags,caption,created_at').contains('tags',[`topic:${selectedTopicId}`]).order('created_at',{ascending:true})
      ])
      if(d){setDraft({title:d.title||topic?.title||'',cover_title:d.cover_title||'',cover_subtitle:d.cover_subtitle||'',route:d.route||'',body:d.body||'',xhs_url:d.xhs_url||topic?.xhs_url||''})}
      else setDraft({title:topic?.title||'',cover_title:topic?shortCoverTitle(topic.title,topic.destination):'',cover_subtitle:topic?`${topic.destination} · 真实路线与体验`:'',route:'',body:'',xhs_url:topic?.xhs_url||''})
      const withUrls:Material[]=[]
      for(const row of (m||[]) as Material[]){
        const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(row.storage_path,60*60*24*7)
        withUrls.push({...row,url:s?.signedUrl})
      }
      setSelectedMaterials(withUrls)
      const post=posts.find(p=>p.topic_id===selectedTopicId)
      if(post)setMetric({views:String(post.views||0),likes:String(post.likes||0),saves:String(post.saves||0),comments:String(post.comments||0),shares:'0',follows:String(post.follows||0)})
      else setMetric({views:'',likes:'',saves:'',comments:'',shares:'',follows:''})
    }
    void loadSelected()
  },[selectedTopicId,topics,supabase,posts])

  useEffect(()=>{
    if(!selectedDestination){setDestinationPreview([]);return}
    const dest=destinations.find(d=>d.name===selectedDestination);if(!dest)return
    const rows=materials.filter(m=>m.destination_id===dest.id).slice(0,8)
    async function sign(){
      const out:Material[]=[]
      for(const r of rows){const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(r.storage_path,3600);out.push({...r,url:s?.signedUrl})}
      setDestinationPreview(out)
    }
    void sign()
  },[selectedDestination,destinations,materials,supabase])

  async function signIn(){
    const email=prompt('输入登录邮箱');if(!email)return
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}})
    if(error)alert(error.message);else alert('登录链接已发送到邮箱')
  }
  async function signOut(){await supabase.auth.signOut();setUserEmail(null)}

  function openTopic(id:string,preferred?:ContentStep){
    setSelectedTopicId(id);setPage('content');if(preferred)setStep(preferred)
  }

  function materialCount(topicId:string){return materials.filter(m=>m.tags?.includes(`topic:${topicId}`)).length}

  function nextAction(topic:Topic|null){
    if(!topic)return {label:'选择本周主内容',step:'media' as ContentStep,desc:'从候选池里确定一篇最值得做的内容。'}
    const count=materialCount(topic.id)
    if(!count)return {label:'先把素材放进来',step:'media' as ContentStep,desc:'上传照片后，系统才能给出封面与图文建议。'}
    if(!draft.body.trim())return {label:'生成图文发布稿',step:'copy' as ContentStep,desc:`已有 ${count} 张素材，下一步生成封面文字、正文和标签。`}
    if(topic.status==='done')return {label:'记录发布数据',step:'metrics' as ContentStep,desc:'录入24h / 7d数据，系统会反向指导下一篇。'}
    return {label:'检查并发布',step:'publish' as ContentStep,desc:'图文已准备好，检查链接与最终文案后发布。'}
  }

  async function setTopicStatus(id:string,status:TopicStatus){
    const {error}=await supabase.from('topics').update({status}).eq('id',id);if(error)alert(error.message);else await loadAll()
  }

  async function uploadFiles(files:FileList|File[],topicId=selectedTopicId){
    if(!topicId)return alert('请先选择一篇内容')
    const list=Array.from(files).filter(f=>f.type.startsWith('image/'));if(!list.length)return
    const topic=topics.find(t=>t.id===topicId);if(!topic)return
    const {data:{user}}=await supabase.auth.getUser();if(!user)return alert('请先登录')
    const {data:dest}=await supabase.from('destinations').select('id').eq('name',topic.destination).limit(1).maybeSingle()
    setUploading(true);setSmartMessage(`正在上传 0 / ${list.length}`)
    let ok=0
    for(let i=0;i<list.length;i++){
      const file=list[i];if(file.size>25*1024*1024)continue
      const path=`${user.id}/${topicId}/${Date.now()}-${i}-${safeName(file.name)}`
      const up=await supabase.storage.from('travel-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
      if(up.error){setUploading(false);setSmartMessage(`上传失败：${up.error.message}`);return}
      const db=await supabase.from('materials').insert({user_id:user.id,destination_id:dest?.id||null,storage_path:path,media_type:'image',tags:[`topic:${topicId}`,topic.destination],caption:file.name})
      if(db.error){await supabase.storage.from('travel-media').remove([path]);setUploading(false);setSmartMessage(`保存失败：${db.error.message}`);return}
      ok++;setSmartMessage(`正在上传 ${ok} / ${list.length}`)
    }
    setUploading(false);setSmartMessage(`已上传 ${ok} 张，手机和电脑已同步`);await loadAll()
  }

  async function setCover(material:Material){
    if(!selectedTopicId)return
    const coverTag=`cover:${selectedTopicId}`
    for(const m of selectedMaterials){
      const tags=(m.tags||[]).filter(t=>t!==coverTag)
      if(m.id===material.id)tags.push(coverTag)
      await supabase.from('materials').update({tags}).eq('id',m.id)
    }
    setSmartMessage('已设为图1 / 封面候选。系统已更新封面建议。')
    await loadAll()
  }

  async function deleteMaterial(material:Material){
    if(!confirm('删除这张素材？'))return
    await supabase.storage.from('travel-media').remove([material.storage_path])
    await supabase.from('materials').delete().eq('id',material.id)
    await loadAll()
  }

  function generateSmartDraft(){
    if(!selectedTopic)return
    const destination=selectedTopic.destination
    const title=selectedTopic.title
    const route=draft.route.trim()
    const cover=shortCoverTitle(title,destination)
    const subtitle=selectedTopic.content_type==='路线型'?`${destination} · 不赶景点的真实路线`:`${destination} · 真实体验不踩雷`
    const routeText=route?`\n📍路线：${route}\n`:''
    const body=`${title}\n\n这篇不做景点堆砌，直接把我真实走过、觉得有用的部分整理出来。${routeText}\n如果你也准备去${destination}，我更建议先看清楚路线、时间和实际体验，再决定要不要照搬。\n\n我会重点写：\n① 怎么走更顺\n② 哪些地方值得停\n③ 哪些环节容易浪费时间\n④ 实际体验里最想提前知道的事\n\n等我把这次的照片、路线和花费继续补齐，这篇会成为可以直接照着走的版本。\n\n#${destination}旅行 #旅行攻略 #自由行 #真实旅行 #${selectedTopic.content_type}`
    setDraft(v=>({...v,title,cover_title:cover,cover_subtitle:subtitle,body}))
    setSmartMessage('已生成可复制发布稿。建议先检查真实路线、价格和时间，再直接发布。')
    setStep('copy')
  }

  async function saveDraft(){
    if(!selectedTopicId)return
    const {data:{user}}=await supabase.auth.getUser();if(!user)return alert('请先登录')
    setSaving(true)
    const {data:last}=await supabase.from('drafts').select('version').eq('topic_id',selectedTopicId).order('version',{ascending:false}).limit(1).maybeSingle()
    const {error}=await supabase.from('drafts').insert({...draft,user_id:user.id,topic_id:selectedTopicId,xhs_note_id:draft.xhs_url?parseXhsNoteId(draft.xhs_url):null,version:(last?.version||0)+1})
    setSaving(false);if(error)alert(error.message);else setSmartMessage('已保存为新的云端版本')
  }

  async function copyPublishText(){
    const text=`${draft.title}\n\n${draft.body}`.trim();if(!text)return
    await navigator.clipboard.writeText(text);setCopyStatus('已复制，可直接去小红书发布');setTimeout(()=>setCopyStatus(''),2500)
  }

  async function markReady(){
    if(!selectedTopic)return
    await saveDraft();await setTopicStatus(selectedTopic.id,'ready');setSmartMessage('已进入待发布。下一步只需要检查最终文案与链接。')
  }

  async function markPublished(){
    if(!selectedTopic)return
    if(!draft.xhs_url.trim())return alert('发布后请粘贴小红书链接')
    const {data:{user}}=await supabase.auth.getUser();if(!user)return
    const noteId=parseXhsNoteId(draft.xhs_url)
    const existing=posts.find(p=>p.topic_id===selectedTopic.id)
    if(existing)await supabase.from('posts').update({title:draft.title||selectedTopic.title,destination:selectedTopic.destination,xhs_url:draft.xhs_url,xhs_note_id:noteId,published_at:new Date().toISOString()}).eq('id',existing.id)
    else await supabase.from('posts').insert({user_id:user.id,topic_id:selectedTopic.id,title:draft.title||selectedTopic.title,destination:selectedTopic.destination,xhs_url:draft.xhs_url,xhs_note_id:noteId,published_at:new Date().toISOString()})
    await supabase.from('topics').update({status:'done',xhs_url:draft.xhs_url}).eq('id',selectedTopic.id)
    await loadAll();setStep('metrics');setSmartMessage('已发布。系统已把下一步切到数据复盘。')
  }

  async function saveMetrics(){
    if(!selectedPost)return alert('还没有找到这篇内容的发布记录')
    const {data:{user}}=await supabase.auth.getUser();if(!user)return
    const {error}=await supabase.from('post_metrics').insert({user_id:user.id,post_id:selectedPost.id,views:n(metric.views),likes:n(metric.likes),saves:n(metric.saves),comments:n(metric.comments),shares:n(metric.shares),follows:n(metric.follows)})
    if(error)alert(error.message);else{setSmartMessage('数据快照已保存，系统会用这些数据筛下一批选题。');await loadAll()}
  }

  async function addWebsiteCandidate(post:Post){
    const {data:{user}}=await supabase.auth.getUser();if(!user)return
    if(websiteArticles.some(a=>a.source_post_id===post.id)){setSmartMessage('这篇已经在独立站候选池里');return}
    const outline=`建议扩写方向：\n- 为什么值得去 / 适合谁\n- 完整路线与时间\n- 真实花费\n- 交通与注意事项\n- 个人体验与避坑\n- FAQ\n\n来源：${post.title}`
    const {error}=await supabase.from('website_articles').insert({user_id:user.id,source_post_id:post.id,title:post.title,status:'candidate',body:outline})
    if(error)alert(error.message);else{setSmartMessage('已加入独立站候选池');await loadAll()}
  }

  function groupedTopics(){
    const map=new Map<string,Topic[]>();topics.forEach(t=>{if(!map.has(t.destination))map.set(t.destination,[]);map.get(t.destination)!.push(t)});return [...map.entries()]
  }

  const action=nextAction(currentTopic)
  const weekStart=new Date(mondayISO())
  const weeklyCandidates=topics.filter(t=>t.status==='idea'&&t.planned_at&&new Date(t.planned_at)>=weekStart).slice(0,4)
  const execution=topics.filter(t=>['doing','ready'].includes(t.status)).slice(0,2)
  const filteredDest=destinations.filter(d=>d.name.toLowerCase().includes(destSearch.toLowerCase()))
  const destinationTopics=topics.filter(t=>t.destination===selectedDestination)
  const coverMaterial=selectedMaterials.find(m=>m.tags?.includes(`cover:${selectedTopicId}`))||selectedMaterials[0]

  return <div className="travelOS">
    <aside className="osSidebar">
      <div className="osBrand"><strong>禾十七</strong><span>TRAVEL OS</span></div>
      <nav>{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={page===item.id?'active':''} onClick={()=>setPage(item.id)}><Icon size={19}/><span>{item.label}</span></button>})}</nav>
      <div className="osSideFoot">
        {authReady&&userEmail?<><div className="osSync"><CheckCircle2 size={15}/>云端同步开启</div><button className="osGhost" onClick={signOut}><LogOut size={15}/>退出登录</button></>:<button className="osGhost" onClick={signIn}>邮箱登录</button>}
      </div>
    </aside>

    <main className="osMain">
      <header className="osTopbar">
        <div><span className="osEyebrow">{nav.find(x=>x.id===page)?.label.toUpperCase()}</span><h1>{nav.find(x=>x.id===page)?.label}</h1><p>{page==='today'?'系统只把现在最该做的事摆在你面前。':page==='travel'?'所有旅行资产在这里沉淀，不需要每天进来整理。':page==='content'?'一篇内容从素材到数据，在同一个工作区完成。':page==='analytics'?'用数据决定下一篇，而不是凭感觉。':'先沉淀候选文章，为后期独立站准备。'}</p></div>
        <button className="osIconBtn" onClick={()=>void loadAll()} aria-label="刷新"><RefreshCw size={18}/></button>
      </header>

      {!userEmail&&authReady&&<div className="osNotice"><Cloud size={18}/><span>登录后才能启用手机 / 电脑实时同步。</span><button onClick={signIn}>邮箱登录</button></div>}
      {userEmail&&<div className="osSyncBar"><Cloud size={17}/><b>云端已连接</b><span>手机采集 · 电脑制作 · 同一套数据</span></div>}
      {loading&&<div className="osLoading">正在整理你的旅行内容资产…</div>}
      {smartMessage&&<div className="osSmartToast"><Sparkles size={16}/>{smartMessage}<button onClick={()=>setSmartMessage('')}>×</button></div>}

      {!loading&&page==='today'&&<>
        <section className="osHeroNext">
          <div className="osHeroCopy"><span className="osEyebrow">NEXT ACTION</span><h2>{currentTopic?currentTopic.title:'本周还没有主内容'}</h2><p>{action.desc}</p><div className="osHeroMeta">{currentTopic&&<><span>{currentTopic.destination}</span><span>{currentTopic.content_type}</span><span>{materialCount(currentTopic.id)} 张素材</span></>}</div></div>
          <div className="osHeroAction"><small>系统建议下一步</small><strong>{action.label}</strong><button onClick={()=>currentTopic?openTopic(currentTopic.id,action.step):setPage('travel')}>继续 <ChevronRight size={18}/></button></div>
        </section>

        <section className="osTodayGrid">
          <div className="osPanel"><div className="osPanelHead"><div><span className="osEyebrow">THIS WEEK</span><h3>本周执行</h3></div><span>最多2篇</span></div>{execution.length?execution.map(t=><button className="osTopicRow" key={t.id} onClick={()=>openTopic(t.id)}><div><b>{t.title}</b><span>{t.destination} · {statusName[t.status]}</span></div><ChevronRight size={18}/></button>):<div className="osEmpty">还没有进入制作的内容，从候选池挑一篇即可。</div>}</div>
          <div className="osPanel"><div className="osPanelHead"><div><span className="osEyebrow">CANDIDATES</span><h3>候选池</h3></div><span>每周自动补6条</span></div>{weeklyCandidates.map(t=><div className="osCandidate" key={t.id}><button onClick={()=>openTopic(t.id)}><b>{t.title}</b><span>{t.destination} · {t.content_type}</span></button><button className="osMiniBtn" onClick={()=>void setTopicStatus(t.id,'doing')}>选为本周</button></div>)}</div>
          <div className="osPanel"><div className="osPanelHead"><div><span className="osEyebrow">SYSTEM INSIGHT</span><h3>系统判断</h3></div></div><div className="osInsight"><Sparkles size={22}/><p>{bestPost?`当前表现最好的内容是《${bestPost.title}》，${bestPost.destination}方向已经有真实数据支撑。下一批优先延展“路线 / 花费 / 避坑”而不是再开完全新的方向。`:'先连续发布并记录数据，系统会开始判断哪些目的地和内容模型值得继续。'}</p></div></div>
        </section>

        <section className="osMobileCaptureCard"><div><span className="osEyebrow">MOBILE CAPTURE</span><h3>手机只负责采集</h3><p>旅行途中直接从相册上传，回到电脑素材已经在对应内容里。</p></div><button onClick={()=>setMobileUploadOpen(true)}><Camera size={18}/>上传照片</button></section>
      </>}

      {!loading&&page==='travel'&&<>
        <div className="osSearch"><Search size={18}/><input value={destSearch} onChange={e=>setDestSearch(e.target.value)} placeholder="搜索目的地…"/></div>
        <section className="osTravelGrid">{filteredDest.map(d=><button key={d.id} className={`osDestCard ${selectedDestination===d.name?'selected':''}`} onClick={()=>setSelectedDestination(d.name)}><div className="osDestCover"><MapPin size={24}/></div><div><h3>{d.name}</h3><p>{d.region||'旅行资产'}</p><span>{d.material_count} 素材 · {d.published_count} 已发布 · {d.idea_count} 待开发</span></div></button>)}</section>
        {selectedDestination&&<section className="osDestinationDetail"><div className="osPanelHead"><div><span className="osEyebrow">DESTINATION</span><h2>{selectedDestination}</h2></div><button className="osGhost" onClick={()=>setSelectedDestination('')}>收起</button></div><div className="osDestinationBody"><div><h3>内容树</h3>{destinationTopics.length?destinationTopics.map(t=><button className="osTopicRow" key={t.id} onClick={()=>openTopic(t.id)}><div><b>{t.title}</b><span>{t.content_type} · {statusName[t.status]}</span></div><ChevronRight size={18}/></button>):<div className="osEmpty">暂无选题</div>}</div><div><h3>最近素材</h3><div className="osMiniGallery">{destinationPreview.map(m=><img key={m.id} src={m.url} alt="旅行素材"/>)}{!destinationPreview.length&&<div className="osEmpty">还没有上传素材</div>}</div></div></div></section>}
      </>}

      {!loading&&page==='content'&&<section className="osContentShell">
        <div className="osContentHead"><div><span className="osEyebrow">CONTENT WORKSPACE</span><h2>{selectedTopic?.title||'选择一篇内容'}</h2><p>{selectedTopic?`${selectedTopic.destination} · ${selectedTopic.content_type} · ${statusName[selectedTopic.status]}`:'从下面选择一篇内容开始'}</p></div><select value={selectedTopicId} onChange={e=>setSelectedTopicId(e.target.value)}>{groupedTopics().map(([dest,arr])=><optgroup key={dest} label={dest}>{arr.map(t=><option key={t.id} value={t.id}>{t.title}（{statusName[t.status]}）</option>)}</optgroup>)}</select></div>
        <div className="osStepTabs">{(Object.keys(stepLabel) as ContentStep[]).map(s=><button key={s} className={step===s?'active':''} onClick={()=>setStep(s)}>{stepLabel[s]}<span>{s==='media'?`${selectedMaterials.length}张`:s==='copy'?(draft.body?'已生成':'待生成'):s==='publish'?(selectedTopic?.status==='done'?'已发布':selectedTopic?.status==='ready'?'待发布':'未完成'):selectedPost?'可复盘':'待发布'}</span></button>)}</div>

        {step==='media'&&<div className="osMediaWorkspace"><div className="osMediaMain"><label className={`osUpload ${uploading?'busy':''}`}><UploadCloud size={34}/><b>{uploading?'正在上传…':'点击或拖入旅行照片'}</b><span>手机和电脑都会保存到同一云端</span><input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e=>{if(e.target.files?.length)void uploadFiles(e.target.files);e.currentTarget.value=''}}/></label><div className="osGallery">{selectedMaterials.map((m,i)=><div className={`osMediaCard ${m.id===coverMaterial?.id?'cover':''}`} key={m.id}><img src={m.url} alt={`素材 ${i+1}`}/><span className="osIndex">{m.id===coverMaterial?.id?'图1':String(i+1).padStart(2,'0')}</span><div className="osMediaActions"><button onClick={()=>void setCover(m)}><Star size={15}/>设图1</button><button onClick={()=>void deleteMaterial(m)}><Trash2 size={15}/></button></div></div>)}</div></div><aside className="osAdvisor"><span className="osEyebrow">COVER ADVISOR</span><h3>图1 / 封面建议</h3>{coverMaterial?.url?<img className="osAdvisorPreview" src={coverMaterial.url} alt="封面候选"/>:<div className="osAdvisorBlank"><ImageIcon size={28}/><span>上传照片后开始建议</span></div>}<div className="osAdviceBlock"><small>封面主标题</small><b>{draft.cover_title||selectedTopic?.title||'—'}</b></div><div className="osAdviceBlock"><small>辅助标题</small><b>{draft.cover_subtitle||`${selectedTopic?.destination||''} · 真实路线`}</b></div><div className="osAdviceText"><b>建议排版</b><p>优先选“人物 + 地标 / 路牌 / 明确场景”的照片做图1。人物尽量放在右侧或下半区，主标题放左上或上半区，避免压脸；字不要超过两层，保留照片呼吸感。</p></div><button className="osPrimaryWide" onClick={()=>setStep('copy')}>下一步：做图文 <ChevronRight size={17}/></button></aside></div>}

        {step==='copy'&&<div className="osCopyWorkspace"><div className="osForm"><div className="osAiBox"><div><Sparkles size={22}/><div><b>AI创作区</b><span>根据目的地、选题、路线和素材生成可直接复制的版本</span></div></div><button onClick={generateSmartDraft}>生成发布稿</button></div><label>内容标题<input value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></label><div className="osTwo"><label>封面主标题<input value={draft.cover_title} onChange={e=>setDraft(v=>({...v,cover_title:e.target.value}))}/></label><label>封面辅助标题<input value={draft.cover_subtitle} onChange={e=>setDraft(v=>({...v,cover_subtitle:e.target.value}))}/></label></div><label>路线<textarea rows={3} value={draft.route} onChange={e=>setDraft(v=>({...v,route:e.target.value}))} placeholder="例如：福田口岸 → 中环 → 奥卑利街 → 尖沙咀"/></label><label>可发布正文<textarea rows={14} value={draft.body} onChange={e=>setDraft(v=>({...v,body:e.target.value}))} placeholder="点击上方生成发布稿，或直接在这里修改最终文案。"/></label><div className="osFormActions"><button className="osGhost" onClick={()=>void saveDraft()}>{saving?'保存中…':'保存云端版本'}</button><button onClick={()=>void copyPublishText()}><Copy size={17}/>复制全部发布稿</button><button onClick={()=>void markReady()}>完成图文，进入发布 <ChevronRight size={17}/></button></div>{copyStatus&&<div className="osCopyStatus">{copyStatus}</div>}</div><aside className="osAdvisor"><span className="osEyebrow">SMART CHECK</span><h3>发布前检查</h3><ul><li className={selectedMaterials.length?'ok':''}>至少有一组真实照片</li><li className={draft.cover_title?'ok':''}>封面标题已确认</li><li className={draft.body.length>80?'ok':''}>正文已形成完整信息</li><li className={draft.route?'ok':''}>路线 / 核心信息已补充</li></ul><div className="osAdviceText"><b>系统下一步</b><p>{draft.body?'先完整通读一次，删除任何不符合真实经历的句子，然后复制去发布。':'先生成初稿，再用你的真实经历做校正。'}</p></div></aside></div>}

        {step==='publish'&&<div className="osPublishWorkspace"><div className="osPublishCard"><span className="osEyebrow">READY TO PUBLISH</span><h2>{draft.title||selectedTopic?.title}</h2><div className="osPublishPreview"><b>{draft.cover_title}</b><span>{draft.cover_subtitle}</span><p>{draft.body.slice(0,240)}{draft.body.length>240?'…':''}</p></div><label>发布后粘贴小红书链接<input value={draft.xhs_url} onChange={e=>setDraft(v=>({...v,xhs_url:e.target.value}))} placeholder="https://www.xiaohongshu.com/explore/..."/></label><div className="osFormActions"><button className="osGhost" onClick={()=>void copyPublishText()}><Copy size={17}/>复制发布稿</button><button onClick={()=>void markPublished()}><Send size={17}/>绑定链接并标记已发布</button></div></div><aside className="osAdvisor"><span className="osEyebrow">NEXT</span><h3>发布以后不用想下一步</h3><p>绑定链接后，系统会自动把这篇切到「数据」，提醒你记录 24h / 7d 表现。</p></aside></div>}

        {step==='metrics'&&<div className="osMetricsWorkspace">{selectedPost?<><div className="osMetricHead"><div><span className="osEyebrow">POST PERFORMANCE</span><h2>{selectedPost.title}</h2></div>{selectedPost.xhs_url&&<a href={selectedPost.xhs_url} target="_blank" rel="noreferrer">打开小红书 <ExternalLink size={15}/></a>}</div><div className="osMetricForm">{(['views','likes','saves','comments','shares','follows'] as const).map(k=><label key={k}><span>{{views:'浏览',likes:'点赞',saves:'收藏',comments:'评论',shares:'分享',follows:'涨粉'}[k]}</span><input inputMode="numeric" value={metric[k]} onChange={e=>setMetric(v=>({...v,[k]:e.target.value.replace(/[^0-9]/g,'')}))}/></label>)}</div><div className="osMetricInsights"><div><span>收藏率</span><b>{n(metric.views)?((n(metric.saves)/n(metric.views))*100).toFixed(1)+'%':'—'}</b></div><div><span>互动率</span><b>{n(metric.views)?(((n(metric.likes)+n(metric.saves)+n(metric.comments))/n(metric.views))*100).toFixed(1)+'%':'—'}</b></div><div><span>判断</span><b>{n(metric.views)>3000||n(metric.saves)>50?'值得继续扩写':'继续观察'}</b></div></div><button onClick={()=>void saveMetrics()}>保存本次数据快照</button></>:<div className="osEmptyLarge"><BarChart3 size={34}/><h3>这篇还没有发布记录</h3><p>发布完成并绑定链接后，这里会自动开始复盘。</p><button onClick={()=>setStep('publish')}>回到发布</button></div>}</div>}
      </section>}

      {!loading&&page==='analytics'&&<section className="osAnalytics"><div className="osMetricSummary"><div><span>已发布</span><b>{posts.length}</b></div><div><span>最佳浏览</span><b>{bestPost?bestPost.views.toLocaleString():'—'}</b></div><div><span>最佳收藏率</span><b>{posts.length?Math.max(...posts.map(p=>saveRate(p)*100)).toFixed(1)+'%':'—'}</b></div><div><span>下一步</span><b>找可复制模型</b></div></div><div className="osPanel"><div className="osPanelHead"><div><span className="osEyebrow">RANKING</span><h3>内容表现</h3></div></div>{[...posts].sort((a,b)=>websiteScore(b)-websiteScore(a)).map(p=><div className="osRankRow" key={p.id}><div><b>{p.title}</b><span>{p.destination}</span></div><div><span>{p.views.toLocaleString()} 浏览</span><span>{(saveRate(p)*100).toFixed(1)}% 收藏率</span></div><button onClick={()=>p.topic_id&&openTopic(p.topic_id,'metrics')}>复盘</button></div>)}</div></section>}

      {!loading&&page==='website'&&<section className="osWebsite"><div className="osWebsiteIntro"><div><span className="osEyebrow">FUTURE WEBSITE</span><h2>先让系统替你筛文章</h2><p>现在不急着建公开独立站。这里先从已发布内容里筛出“值得长期搜索、值得扩成长文”的文章，等时机成熟直接使用。</p></div><Globe2 size={42}/></div><div className="osWebsiteGrid"><div className="osPanel"><div className="osPanelHead"><div><span className="osEyebrow">SMART CANDIDATES</span><h3>系统推荐扩写</h3></div><span>综合浏览 / 收藏 / 搜索意图</span></div>{[...posts].sort((a,b)=>websiteScore(b)-websiteScore(a)).slice(0,8).map(p=>{const score=websiteScore(p);const added=websiteArticles.some(a=>a.source_post_id===p.id);return <div className="osSiteCandidate" key={p.id}><div><b>{p.title}</b><span>{p.destination} · 网站潜力 {score}/100</span><div className="osScoreBar"><i style={{width:`${score}%`}}/></div></div><button className={added?'osGhost':''} disabled={added} onClick={()=>void addWebsiteCandidate(p)}>{added?'已入候选':'加入候选'}</button></div>})}</div><div className="osPanel"><div className="osPanelHead"><div><span className="osEyebrow">ARTICLE POOL</span><h3>独立站候选池</h3></div><span>{websiteArticles.length} 篇</span></div>{websiteArticles.length?websiteArticles.map(a=><article className="osArticleRow" key={a.id}><div><b>{a.title}</b><span>{a.status==='candidate'?'待扩写':'已准备'} · {new Date(a.created_at).toLocaleDateString('zh-CN')}</span></div><span>后期独立站</span></article>):<div className="osEmpty">先发布和复盘内容，系统会逐渐筛出适合独立站的文章。</div>}</div></div></section>}
    </main>

    <nav className="osMobileNav">{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={page===item.id?'active':''} onClick={()=>setPage(item.id)}><Icon size={20}/><span>{item.label}</span></button>})}</nav>
    <button className="osMobileUploadFab" onClick={()=>setMobileUploadOpen(true)}><Camera size={19}/>照片</button>

    {mobileUploadOpen&&<div className="osMobileSheet" onClick={()=>setMobileUploadOpen(false)}><div className="osMobilePanel" onClick={e=>e.stopPropagation()}><div className="osMobileSheetHead"><div><span className="osEyebrow">MOBILE CAPTURE</span><h3>从手机相册上传</h3><p>上传后电脑端自动出现。</p></div><button onClick={()=>setMobileUploadOpen(false)}>×</button></div><label>关联到内容<select value={selectedTopicId} onChange={e=>setSelectedTopicId(e.target.value)}>{groupedTopics().map(([dest,arr])=><optgroup key={dest} label={dest}>{arr.filter(t=>t.status!=='done').map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</optgroup>)}</select></label><button className="osPrimaryWide" onClick={()=>mobileFileRef.current?.click()}><Camera size={18}/>从相册选择照片</button><input ref={mobileFileRef} hidden type="file" accept="image/*" multiple onChange={e=>{if(e.target.files?.length)void uploadFiles(e.target.files);e.currentTarget.value=''}}/><div className="osMobileHint"><Clock3 size={16}/><span>手机只负责采集；回到电脑再做排序、封面、正文和发布。</span></div></div></div>}
  </div>
}
