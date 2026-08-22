'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Camera, ChevronRight, Copy, Image as ImageIcon, Sparkles, WandSparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Topic } from '@/lib/types'

type Material = {id:string;storage_path:string;tags:string[];caption:string|null;created_at:string}
type DraftRow = {id?:string;topic_id:string;title:string|null;cover_title:string|null;cover_subtitle:string|null;route:string|null;body:string|null;version:number|null}
type DraftResult = {title:string;coverTitle:string;coverSubtitle:string;route:string;body:string;hashtags:string[];source?:string}
type MediaPlan = {coverId:string|null;orderIds:string[];reason:string;overlayTitle:string;overlaySubtitle:string;notes?:Array<{id:string;note:string}>;source?:string}

type View = 'home'|'capture'|'media'|'copy'

function safeName(name:string){
  const ext=name.includes('.')?'.'+name.split('.').pop():''
  const base=name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48)||'image'
  return `${base}${ext.toLowerCase()}`
}
function shortCoverTitle(title:string,destination:string){
  const cleaned=title.replace(destination,'').replace(/[｜|·]/g,' ').trim()
  return (cleaned||`${destination}旅行攻略`).slice(0,14)
}
function localDraft(topic:Topic,route=''):DraftResult{
  const title=topic.title
  const destination=topic.destination
  const coverTitle=shortCoverTitle(title,destination)
  const coverSubtitle=topic.content_type==='路线型'?`${destination} · 不赶景点的真实路线`:`${destination} · 真实体验整理`
  const routeLine=route?`\n📍路线：${route}\n`:''
  const body=`${title}\n\n如果你也准备去${destination}，这篇可以先存下来。${routeLine}\n我会按真实出行逻辑整理，不堆景点，重点看：\n① 怎么走更顺\n② 哪些地方值得停\n③ 哪些环节容易浪费时间\n④ 哪些细节出发前知道会更省事\n\n具体价格、营业时间和交通班次以出发前最新信息为准。\n\n#${destination}旅行 #旅行攻略 #自由行 #真实旅行分享`
  return {title,coverTitle,coverSubtitle,route,body,hashtags:[`#${destination}旅行`,'#旅行攻略','#自由行','#真实旅行分享'],source:'local'}
}

export default function TravelOSAssistant(){
  const supabase=useMemo(()=>createClient(),[])
  const [topics,setTopics]=useState<Topic[]>([])
  const [materials,setMaterials]=useState<Material[]>([])
  const [drafts,setDrafts]=useState<DraftRow[]>([])
  const [topicId,setTopicId]=useState('')
  const [open,setOpen]=useState(false)
  const [view,setView]=useState<View>('home')
  const [files,setFiles]=useState<File[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [plan,setPlan]=useState<MediaPlan|null>(null)
  const [draftResult,setDraftResult]=useState<DraftResult|null>(null)

  const focusTopic=topics.find(t=>t.id===topicId)||topics.find(t=>t.status==='doing')||topics.find(t=>t.status==='ready')||topics.find(t=>t.status==='idea')||topics[0]||null
  const topicMaterials=focusTopic?materials.filter(m=>m.tags?.includes(`topic:${focusTopic.id}`)):[]
  const latestDraft=focusTopic?[...drafts].filter(d=>d.topic_id===focusTopic.id).sort((a,b)=>(b.version||0)-(a.version||0))[0]:undefined

  function nextAction(){
    if(!focusTopic)return {title:'先确定一篇主内容',desc:'系统会从候选池开始组织本周内容。',view:'home' as View}
    if(focusTopic.status==='idea')return {title:'把它选为本周主内容',desc:`《${focusTopic.title}》还在候选池，先进入制作。`,view:'home' as View}
    if(!topicMaterials.length)return {title:'手机先放照片',desc:'照片进来后，系统会自动给出图1、顺序和封面文字。',view:'capture' as View}
    if(!latestDraft?.body)return {title:'生成可发布图文',desc:`已有 ${topicMaterials.length} 张素材，下一步直接生成标题、封面字和正文。`,view:'copy' as View}
    if(focusTopic.status!=='done')return {title:'复制文案去发布',desc:'图文已经准备好，复制后去小红书发布即可。',view:'copy' as View}
    return {title:'记录发布数据',desc:'这篇已经发布，回到“数据”录入表现，系统会反向指导下一篇。',view:'home' as View}
  }
  const action=nextAction()

  async function load(){
    const [{data:t},{data:m},{data:d}]=await Promise.all([
      supabase.from('topics').select('*').order('created_at',{ascending:false}),
      supabase.from('materials').select('id,storage_path,tags,caption,created_at').order('created_at',{ascending:true}),
      supabase.from('drafts').select('id,topic_id,title,cover_title,cover_subtitle,route,body,version').order('version',{ascending:false}),
    ])
    setTopics((t||[]) as Topic[]);setMaterials((m||[]) as Material[]);setDrafts((d||[]) as DraftRow[])
    if(!topicId){const first=(t||[]).find((x:any)=>x.status==='doing')||(t||[]).find((x:any)=>x.status==='ready')||(t||[]).find((x:any)=>x.status==='idea')||(t||[])[0];if(first)setTopicId(first.id)}
  }

  useEffect(()=>{
    void load()
    const c=supabase.channel('h17-smart-assistant')
      .on('postgres_changes',{event:'*',schema:'public',table:'topics'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'materials'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'drafts'},()=>void load())
      .subscribe()
    return()=>{void supabase.removeChannel(c)}
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function makeDoing(){
    if(!focusTopic)return
    setBusy(true)
    const {error}=await supabase.from('topics').update({status:'doing'}).eq('id',focusTopic.id)
    setBusy(false);if(error)setMessage(error.message);else{setMessage('已设为本周主内容。现在把照片放进来即可。');await load();setView('capture')}
  }

  function chooseFiles(e:ChangeEvent<HTMLInputElement>){
    setFiles(Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/')).slice(0,20))
  }

  async function uploadAndPlan(){
    if(!focusTopic||!files.length)return
    const {data:{user}}=await supabase.auth.getUser();if(!user){setMessage('设备会话失效，请刷新页面。');return}
    const {data:dest}=await supabase.from('destinations').select('id').eq('name',focusTopic.destination).limit(1).maybeSingle()
    setBusy(true);setMessage(`正在上传 0 / ${files.length}`)
    let ok=0
    for(let i=0;i<files.length;i++){
      const file=files[i];if(file.size>25*1024*1024)continue
      const path=`${user.id}/${focusTopic.id}/${Date.now()}-${i}-${safeName(file.name)}`
      const up=await supabase.storage.from('travel-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
      if(up.error){setBusy(false);setMessage(`上传失败：${up.error.message}`);return}
      const db=await supabase.from('materials').insert({destination_id:dest?.id||null,storage_path:path,media_type:'image',tags:[`topic:${focusTopic.id}`,focusTopic.destination],caption:file.name})
      if(db.error){await supabase.storage.from('travel-media').remove([path]);setBusy(false);setMessage(`保存失败：${db.error.message}`);return}
      ok++;setMessage(`正在上传 ${ok} / ${files.length}`)
    }
    setFiles([]);await load();setMessage('照片已同步，正在自动判断图1和顺序…')
    await planMedia(focusTopic.id)
    setBusy(false);setView('media')
  }

  async function planMedia(targetTopicId=focusTopic?.id){
    const topic=topics.find(t=>t.id===targetTopicId)||focusTopic;if(!topic||!targetTopicId)return
    const {data:rows}=await supabase.from('materials').select('id,storage_path,tags,caption,created_at').contains('tags',[`topic:${targetTopicId}`]).order('created_at',{ascending:true})
    const list=(rows||[]) as Material[];if(!list.length)return
    setBusy(true)
    const images=[] as Array<{id:string;url:string;caption:string}>
    for(const m of list.slice(0,10)){
      const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(m.storage_path,1800)
      if(s?.signedUrl)images.push({id:m.id,url:s.signedUrl,caption:m.caption||''})
    }
    let result:MediaPlan={coverId:list[0].id,orderIds:list.map(x=>x.id),reason:'先按上传顺序整理；图1优先保留最早选中的主视觉。',overlayTitle:shortCoverTitle(topic.title,topic.destination),overlaySubtitle:`${topic.destination} · 真实旅行整理`,source:'fallback'}
    try{
      const r=await fetch('/api/media-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:topic.title,destination:topic.destination,contentType:topic.content_type,images})})
      if(r.ok)result={...result,...await r.json()}
    }catch{}
    const coverTag=`cover:${targetTopicId}`
    for(let i=0;i<list.length;i++){
      const m=list[i]
      const order=(result.orderIds.indexOf(m.id)+1)||i+1
      const tags=(m.tags||[]).filter(t=>t!==coverTag&&!t.startsWith(`order:${targetTopicId}:`))
      if(m.id===result.coverId)tags.push(coverTag,'auto-cover')
      tags.push(`order:${targetTopicId}:${String(order).padStart(2,'0')}`)
      await supabase.from('materials').update({tags}).eq('id',m.id)
    }
    setPlan(result);setMessage('已完成素材初排：图1、图片顺序和封面字都准备好了。');await load();setBusy(false)
  }

  async function generateDraft(){
    if(!focusTopic)return
    setBusy(true);setMessage('正在生成可直接发布的图文…')
    const route=latestDraft?.route||''
    let result=localDraft(focusTopic,route)
    try{
      const r=await fetch('/api/ai-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:focusTopic.destination,title:focusTopic.title,contentType:focusTopic.content_type,route,coverTitle:plan?.overlayTitle||latestDraft?.cover_title||'',coverSubtitle:plan?.overlaySubtitle||latestDraft?.cover_subtitle||'',body:latestDraft?.body||''})})
      if(r.ok)result={...result,...await r.json()}
    }catch{}
    setDraftResult(result);setMessage(result.source==='openai'?'AI 已生成发布稿。':'已生成智能发布稿；未提供的信息没有虚构。');setBusy(false)
  }

  async function saveGeneratedDraft(){
    if(!focusTopic||!draftResult)return
    setBusy(true)
    const {data:last}=await supabase.from('drafts').select('version').eq('topic_id',focusTopic.id).order('version',{ascending:false}).limit(1).maybeSingle()
    const {error}=await supabase.from('drafts').insert({topic_id:focusTopic.id,title:draftResult.title,cover_title:draftResult.coverTitle,cover_subtitle:draftResult.coverSubtitle,route:draftResult.route||'',body:`${draftResult.body}\n\n${draftResult.hashtags.join(' ')}`,version:(last?.version||0)+1})
    setBusy(false);if(error)setMessage(error.message);else{setMessage('已保存到“内容 → 图文”，电脑端和手机端同步。');await load()}
  }

  async function copyDraft(){
    const d=draftResult|| (latestDraft?{title:latestDraft.title||focusTopic?.title||'',body:latestDraft.body||'',hashtags:[],coverTitle:latestDraft.cover_title||'',coverSubtitle:latestDraft.cover_subtitle||'',route:latestDraft.route||''}:null)
    if(!d)return
    await navigator.clipboard.writeText(`${d.title}\n\n${d.body}`.trim());setMessage('已复制，可以直接去小红书发布。')
  }

  return <>
    <button className="h17SmartFab" onClick={()=>{setOpen(true);setView(action.view)}}><Sparkles size={17}/><span>{action.title}</span><ChevronRight size={16}/></button>
    {open&&<div className="h17SmartBackdrop" onClick={()=>setOpen(false)}>
      <section className="h17SmartPanel" onClick={e=>e.stopPropagation()}>
        <header><div><span>SMART FLOW</span><h2>系统下一步</h2></div><button onClick={()=>setOpen(false)}><X size={20}/></button></header>
        <div className="h17SmartTopic">
          <label>当前内容</label>
          <select value={focusTopic?.id||''} onChange={e=>{setTopicId(e.target.value);setPlan(null);setDraftResult(null)}}>{topics.map(t=><option key={t.id} value={t.id}>{t.destination}｜{t.title}</option>)}</select>
        </div>
        <nav className="h17SmartTabs">
          <button className={view==='home'?'active':''} onClick={()=>setView('home')}><Sparkles size={15}/>下一步</button>
          <button className={view==='capture'?'active':''} onClick={()=>setView('capture')}><Camera size={15}/>照片</button>
          <button className={view==='media'?'active':''} onClick={()=>setView('media')}><ImageIcon size={15}/>图1/顺序</button>
          <button className={view==='copy'?'active':''} onClick={()=>setView('copy')}><WandSparkles size={15}/>发布稿</button>
        </nav>

        {view==='home'&&<div className="h17SmartBody"><div className="h17SmartAction"><small>系统现在只建议做这一件事</small><h3>{action.title}</h3><p>{action.desc}</p>{focusTopic?.status==='idea'?<button onClick={()=>void makeDoing()} disabled={busy}>选为本周主内容</button>:<button onClick={()=>setView(action.view)}>继续</button>}</div><div className="h17SmartFacts"><span>{focusTopic?.destination||'未选择目的地'}</span><span>{topicMaterials.length} 张照片</span><span>{latestDraft?.body?'已有文案':'未生成文案'}</span></div></div>}

        {view==='capture'&&<div className="h17SmartBody"><div className="h17CaptureBox"><Camera size={26}/><h3>从手机相册一次选完</h3><p>最多20张。上传后自动同步到电脑，并立即判断图1、顺序和封面文字。</p><label className="h17FilePick"><input type="file" accept="image/*" multiple onChange={chooseFiles}/>{files.length?`已选 ${files.length} 张`:'选择照片'}</label>{files.length>0&&<button className="h17Primary" onClick={()=>void uploadAndPlan()} disabled={busy}>{busy?'处理中…':'上传并智能整理'}</button>}</div></div>}

        {view==='media'&&<div className="h17SmartBody"><div className="h17MediaSummary"><div><small>当前素材</small><b>{topicMaterials.length} 张</b></div><button onClick={()=>void planMedia()} disabled={busy||!topicMaterials.length}>{busy?'分析中…':'重新智能排序'}</button></div>{plan?<div className="h17Plan"><span>图1建议</span><h3>{plan.overlayTitle}</h3><p>{plan.overlaySubtitle}</p><div className="h17Reason">{plan.reason}</div><small>{plan.source==='openai'?'AI视觉判断':'智能初排，可在内容页手动调整'}</small></div>:<div className="h17SmartEmpty">有照片后点“重新智能排序”，系统会写入图1和顺序建议。</div>}</div>}

        {view==='copy'&&<div className="h17SmartBody">{!draftResult?<div className="h17Generate"><WandSparkles size={25}/><h3>生成可直接复制的发布稿</h3><p>会结合目的地、选题、路线和封面建议；没有提供的价格/班次/经历不会乱编。</p><button className="h17Primary" onClick={()=>void generateDraft()} disabled={busy}>{busy?'生成中…':'生成发布稿'}</button></div>:<div className="h17DraftPreview"><small>封面</small><h3>{draftResult.coverTitle}</h3><p className="h17CoverSub">{draftResult.coverSubtitle}</p><small>标题</small><b>{draftResult.title}</b><textarea value={`${draftResult.body}\n\n${draftResult.hashtags.join(' ')}`} onChange={e=>setDraftResult({...draftResult,body:e.target.value,hashtags:[]})}/><div className="h17DraftActions"><button onClick={()=>void saveGeneratedDraft()} disabled={busy}>保存到内容</button><button className="h17Primary" onClick={()=>void copyDraft()}><Copy size={15}/>复制发布稿</button></div></div>}</div>}

        {message&&<div className="h17SmartMessage">{message}</div>}
      </section>
    </div>}
  </>
}
