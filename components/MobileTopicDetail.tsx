'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Camera, Check, Copy, Image as ImageIcon, Sparkles, UploadCloud, WandSparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Topic={id:string;title:string;destination:string;content_type:string;status:'idea'|'doing'|'ready'|'done'}
type Material={id:string;storage_path:string;tags:string[];caption:string|null;created_at:string}
type MediaPlan={coverId:string|null;orderIds:string[];reason:string;overlayTitle:string;overlaySubtitle:string;source?:string}
type DraftResult={title:string;coverTitle:string;coverSubtitle:string;route:string;body:string;hashtags:string[];source?:string}

function normalize(v:string){return v.replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'').replace(/\s+/g,'').toLowerCase()}
function displayTitle(v:string){return v.replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'').trim()}
function safeName(name:string){
  const ext=name.includes('.')?'.'+name.split('.').pop():''
  const base=name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48)||'image'
  return `${base}${ext.toLowerCase()}`
}
function shortTitle(t:Topic){
  const cleaned=displayTitle(t.title).replace(t.destination,'').replace(/[｜|·]/g,' ').trim()
  return (cleaned||`${t.destination}旅行攻略`).slice(0,16)
}
function photoChecklist(t:Topic){
  if(/Port\s*Dickson|波德申/i.test(t.title))return ['海边 / 沙滩全景','吉隆坡 → Port Dickson交通或路线截图','酒店 / 住宿环境','餐饮、门票或花费凭证','人物在现场的生活感照片']
  if(t.content_type==='路线型')return ['起点 / 交通','沿途关键节点','代表性场景','人物体验照','终点 / 夜景或收尾']
  if(t.content_type==='决策型')return ['目的地主视觉','交通证据','住宿环境','花费证据','最能代表真实体验的照片']
  return ['主视觉场景','交通 / 路线','环境细节','人物体验','花费 / 实用信息']
}

export default function MobileTopicDetail(){
  const supabase=useMemo(()=>createClient(),[])
  const [topics,setTopics]=useState<Topic[]>([])
  const [topic,setTopic]=useState<Topic|null>(null)
  const [materials,setMaterials]=useState<Material[]>([])
  const [files,setFiles]=useState<File[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [plan,setPlan]=useState<MediaPlan|null>(null)
  const [draft,setDraft]=useState<DraftResult|null>(null)

  async function loadTopics(){
    const {data}=await supabase.from('topics').select('id,title,destination,content_type,status').order('created_at',{ascending:false})
    setTopics((data||[]) as Topic[])
  }

  async function loadDetail(t:Topic){
    const [{data:m},{data:d}]=await Promise.all([
      supabase.from('materials').select('id,storage_path,tags,caption,created_at').contains('tags',[`topic:${t.id}`]).order('created_at',{ascending:true}),
      supabase.from('drafts').select('title,cover_title,cover_subtitle,route,body').eq('topic_id',t.id).order('version',{ascending:false}).limit(1).maybeSingle(),
    ])
    setMaterials((m||[]) as Material[])
    if(d?.body)setDraft({title:d.title||displayTitle(t.title),coverTitle:d.cover_title||shortTitle(t),coverSubtitle:d.cover_subtitle||`${t.destination} · 真实旅行整理`,route:d.route||'',body:d.body||'',hashtags:[],source:'saved'})
  }

  useEffect(()=>{
    void loadTopics()
    const channel=supabase.channel('h17-mobile-topic-detail')
      .on('postgres_changes',{event:'*',schema:'public',table:'topics'},()=>void loadTopics())
      .subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[supabase])

  useEffect(()=>{
    function onClick(e:MouseEvent){
      if(!window.matchMedia('(max-width:720px)').matches)return
      const target=e.target as HTMLElement
      if(target.closest('.h17MobileTopicSheet'))return
      const button=target.closest('.osCandidate > button:first-child, .osTopicRow') as HTMLElement|null
      if(!button)return
      const raw=button.querySelector('b')?.textContent?.trim()||''
      if(!raw)return
      const match=topics.find(t=>normalize(t.title)===normalize(raw))
      if(!match)return
      e.preventDefault();e.stopPropagation()
      setTopic(match);setPlan(null);setDraft(null);setFiles([]);setMessage('')
      void loadDetail(match)
    }
    document.addEventListener('click',onClick,true)
    return()=>document.removeEventListener('click',onClick,true)
  },[topics]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setDoing(){
    if(!topic)return
    setBusy(true)
    const {error}=await supabase.from('topics').update({status:'doing'}).eq('id',topic.id)
    setBusy(false)
    if(error){setMessage(`设置失败：${error.message}`);return}
    setTopic({...topic,status:'doing'});setMessage('已设为本周主内容。现在直接把照片放进来即可。')
  }

  function chooseFiles(e:ChangeEvent<HTMLInputElement>){
    setFiles(Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/')).slice(0,20))
  }

  async function analyzeMedia(t:Topic){
    const {data:rows}=await supabase.from('materials').select('id,storage_path,tags,caption,created_at').contains('tags',[`topic:${t.id}`]).order('created_at',{ascending:true})
    const list=(rows||[]) as Material[]
    if(!list.length)return
    const images:Array<{id:string;url:string;caption:string}>=[]
    for(const m of list.slice(0,10)){
      const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(m.storage_path,1800)
      if(s?.signedUrl)images.push({id:m.id,url:s.signedUrl,caption:m.caption||''})
    }
    let result:MediaPlan={coverId:list[0].id,orderIds:list.map(x=>x.id),reason:'先按上传顺序形成叙事；图1优先保留最能一眼看出目的地和体验的主视觉。',overlayTitle:shortTitle(t),overlaySubtitle:`${t.destination} · 真实路线与体验`,source:'smart-fallback'}
    try{
      const r=await fetch('/api/media-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:displayTitle(t.title),destination:t.destination,contentType:t.content_type,images})})
      if(r.ok)result={...result,...await r.json()}
    }catch{}
    const coverTag=`cover:${t.id}`
    for(let i=0;i<list.length;i++){
      const m=list[i];const order=(result.orderIds.indexOf(m.id)+1)||i+1
      const tags=(m.tags||[]).filter(x=>x!==coverTag&&!x.startsWith(`order:${t.id}:`))
      if(m.id===result.coverId)tags.push(coverTag,'auto-cover')
      tags.push(`order:${t.id}:${String(order).padStart(2,'0')}`)
      await supabase.from('materials').update({tags}).eq('id',m.id)
    }
    setPlan(result);setMaterials(list)
  }

  async function upload(){
    if(!topic||!files.length)return
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setMessage('设备会话失效，请刷新页面。');return}
    const {data:dest}=await supabase.from('destinations').select('id').eq('name',topic.destination).limit(1).maybeSingle()
    setBusy(true);setMessage(`正在上传 0 / ${files.length}`)
    let ok=0
    for(let i=0;i<files.length;i++){
      const file=files[i];if(file.size>25*1024*1024)continue
      const path=`${user.id}/${topic.id}/${Date.now()}-${i}-${safeName(file.name)}`
      const up=await supabase.storage.from('travel-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
      if(up.error){setBusy(false);setMessage(`上传失败：${up.error.message}`);return}
      const db=await supabase.from('materials').insert({destination_id:dest?.id||null,storage_path:path,media_type:'image',tags:[`topic:${topic.id}`,topic.destination],caption:file.name})
      if(db.error){await supabase.storage.from('travel-media').remove([path]);setBusy(false);setMessage(`保存失败：${db.error.message}`);return}
      ok++;setMessage(`正在上传 ${ok} / ${files.length}`)
    }
    setFiles([]);setMessage('照片已同步，正在判断图1、顺序和封面文字…')
    await analyzeMedia(topic);await loadDetail(topic)
    setBusy(false);setMessage(`已上传 ${ok} 张，并完成素材初排。`)
  }

  async function makeDraft(){
    if(!topic)return
    setBusy(true);setMessage('正在生成可直接发布的初稿…')
    let result:DraftResult={
      title:displayTitle(topic.title),coverTitle:plan?.overlayTitle||shortTitle(topic),coverSubtitle:plan?.overlaySubtitle||`${topic.destination} · 真实路线与体验`,route:'',
      body:`如果你也准备去${topic.destination}，这篇先把我会优先确认的路线、花费和真实体验整理出来。\n\n这篇重点会写：\n① 怎么去更顺\n② 哪些地方真正值得停\n③ 花费主要集中在哪里\n④ 哪些细节出发前知道会省很多时间\n\n我会只保留真实走过和能确认的信息，具体价格、营业时间和班次以出发前最新信息为准。`,
      hashtags:[`#${topic.destination}旅行`,'#旅行攻略','#自由行','#真实旅行分享'],source:'smart-fallback'
    }
    try{
      const r=await fetch('/api/ai-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:topic.destination,title:displayTitle(topic.title),contentType:topic.content_type,coverTitle:result.coverTitle,coverSubtitle:result.coverSubtitle,body:''})})
      if(r.ok)result={...result,...await r.json()}
    }catch{}
    const {data:last}=await supabase.from('drafts').select('version').eq('topic_id',topic.id).order('version',{ascending:false}).limit(1).maybeSingle()
    const body=`${result.body}\n\n${(result.hashtags||[]).join(' ')}`.trim()
    const {error}=await supabase.from('drafts').insert({topic_id:topic.id,title:result.title,cover_title:result.coverTitle,cover_subtitle:result.coverSubtitle,route:result.route||'',body,version:(last?.version||0)+1})
    setBusy(false)
    if(error){setMessage(`保存初稿失败：${error.message}`);return}
    setDraft({...result,body});setMessage('初稿已保存到云端；电脑端打开同一篇会直接看到。')
  }

  async function copyDraft(){
    if(!draft)return
    await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`.trim())
    setMessage('已复制，可以直接去小红书继续修改 / 发布。')
  }

  function openFullEditor(){
    if(!topic)return
    const title=topic.title
    setTopic(null)
    const buttons=[...document.querySelectorAll('button')]
    const nav=buttons.find(b=>b.textContent?.trim()==='内容') as HTMLButtonElement|undefined
    nav?.click()
    window.setTimeout(()=>{
      const select=document.querySelector('.osContentHead select') as HTMLSelectElement|null
      if(!select)return
      const option=[...select.options].find(o=>normalize(o.textContent||'').includes(normalize(title)))
      if(option){select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}))}
    },180)
  }

  if(!topic)return null
  const checklist=photoChecklist(topic)
  const cover=materials.find(m=>m.tags?.includes(`cover:${topic.id}`))

  return <div className="h17MobileTopicOverlay" onClick={()=>setTopic(null)}>
    <section className="h17MobileTopicSheet" onClick={e=>e.stopPropagation()}>
      <header>
        <button className="h17MobileBack" onClick={()=>setTopic(null)}><ArrowLeft size={19}/></button>
        <div><small>TOPIC WORKSPACE</small><h2>{displayTitle(topic.title)}</h2><p>{topic.destination} · {topic.content_type} · {topic.status==='idea'?'候选':topic.status==='doing'?'制作中':topic.status==='ready'?'待发布':'已发布'}</p></div>
        <button className="h17MobileClose" onClick={()=>setTopic(null)}><X size={18}/></button>
      </header>

      <div className="h17MobileNext">
        <span>现在最该做</span>
        <b>{materials.length?'检查图1与顺序，再生成发布稿':'先把这篇需要的真实照片放进来'}</b>
        <p>{materials.length?`已经有 ${materials.length} 张素材，下一步让系统把它们组织成可发布内容。`:'从这里上传会自动绑定当前这篇，不需要再次选择关联内容。'}</p>
        {topic.status==='idea'&&<button onClick={()=>void setDoing()} disabled={busy}>设为本周并开始制作</button>}
      </div>

      <div className="h17MobileUploadCard">
        <div className="h17MobileSectionTitle"><UploadCloud size={20}/><div><b>上传这篇的照片</b><span>手机相册 · 自动绑定当前内容</span></div></div>
        <label className="h17MobileFilePick"><input type="file" accept="image/*" multiple onChange={chooseFiles}/><Camera size={17}/>{files.length?`已选 ${files.length} 张，重新选择`:'从相册选择照片'}</label>
        {files.length>0&&<button className="h17MobilePrimary" onClick={()=>void upload()} disabled={busy}>{busy?'处理中…':`上传 ${files.length} 张并智能整理`}</button>}
        <div className="h17MobilePhotoHint"><small>这篇优先补：</small>{checklist.map(x=><span key={x}><Check size={12}/>{x}</span>)}</div>
      </div>

      <div className="h17MobileSmartCard">
        <div className="h17MobileSectionTitle"><ImageIcon size={20}/><div><b>图1 / 配图建议</b><span>{materials.length} 张素材已关联</span></div></div>
        {plan?<><h3>{plan.overlayTitle}</h3><p>{plan.overlaySubtitle}</p><div className="h17MobileReason">{plan.reason}</div></>:cover?<div className="h17MobileReason">已有图1记录。你可以点下面重新智能整理，让系统重新判断顺序和封面文字。</div>:<div className="h17MobileMuted">上传照片后这里会自动出现图1、图片顺序和封面文字建议。</div>}
        <button className="h17MobileSoft" onClick={()=>void analyzeMedia(topic)} disabled={busy||!materials.length}><Sparkles size={15}/>智能整理图1 / 顺序</button>
      </div>

      <div className="h17MobileSmartCard">
        <div className="h17MobileSectionTitle"><WandSparkles size={20}/><div><b>发布稿</b><span>标题 · 封面字 · 正文 · 标签</span></div></div>
        {draft?<><h3>{draft.coverTitle}</h3><p>{draft.coverSubtitle}</p><div className="h17MobileDraftText">{draft.body.slice(0,260)}{draft.body.length>260?'…':''}</div><button className="h17MobileSoft" onClick={()=>void copyDraft()}><Copy size={15}/>复制发布稿</button></>:<button className="h17MobilePrimary" onClick={()=>void makeDraft()} disabled={busy}><WandSparkles size={15}/>{busy?'生成中…':'生成并保存发布稿'}</button>}
      </div>

      {message&&<div className="h17MobileMessage">{message}</div>}
      <button className="h17MobileFull" onClick={openFullEditor}>进入完整内容工作区</button>
    </section>

    <style>{`
      .h17MobileTopicOverlay{display:none}
      @media(max-width:720px){
        .h17MobileTopicOverlay{display:flex;position:fixed;inset:0;z-index:520;background:rgba(27,34,31,.42);align-items:flex-end;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
        .h17MobileTopicSheet{width:100%;max-height:92vh;overflow:auto;background:#f7f3eb;border-radius:26px 26px 0 0;padding:16px 16px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(31,40,36,.2);color:#202522}
        .h17MobileTopicSheet>header{display:grid;grid-template-columns:34px 1fr 34px;gap:9px;align-items:start;margin-bottom:13px}
        .h17MobileTopicSheet>header button{border:0;background:#fff;border-radius:10px;width:34px;height:34px;display:grid;place-items:center;color:#47534e}
        .h17MobileTopicSheet header small{font-size:8px;letter-spacing:.18em;color:#2f7b80;font-weight:850}.h17MobileTopicSheet header h2{font-size:19px;line-height:1.35;margin:4px 0 3px}.h17MobileTopicSheet header p{font-size:10px;color:#7b827e;margin:0}
        .h17MobileNext,.h17MobileUploadCard,.h17MobileSmartCard{background:#fffdf9;border:1px solid #e1dbd2;border-radius:18px;padding:14px;margin-top:10px}
        .h17MobileNext{background:linear-gradient(135deg,#e9f5f1,#fff8eb);border-color:#d4e6df}.h17MobileNext>span{font-size:9px;letter-spacing:.14em;color:#2f7b80;font-weight:850}.h17MobileNext>b{display:block;font-size:18px;line-height:1.4;margin-top:6px}.h17MobileNext>p{font-size:11px;line-height:1.65;color:#66736d;margin:6px 0 10px}.h17MobileNext>button{border:0;background:#2f7b80;color:#fff;border-radius:11px;padding:9px 11px;font-weight:750}
        .h17MobileSectionTitle{display:flex;align-items:center;gap:9px;color:#2f6f69}.h17MobileSectionTitle>div{display:grid;gap:2px}.h17MobileSectionTitle b{font-size:14px;color:#26302c}.h17MobileSectionTitle span{font-size:9px;color:#7e8883}
        .h17MobileFilePick{margin-top:12px;position:relative;overflow:hidden;border:1px dashed #8eb9b1;background:#eef7f4;color:#2f6c66;border-radius:12px;padding:11px 12px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:750}.h17MobileFilePick input{position:absolute;inset:0;opacity:0}
        .h17MobilePrimary,.h17MobileSoft,.h17MobileFull{width:100%;border:0;border-radius:11px;padding:10px 12px;margin-top:9px;font-weight:780;display:flex;align-items:center;justify-content:center;gap:6px}.h17MobilePrimary{background:#2f7b80;color:#fff}.h17MobileSoft{background:#eaf4f2;color:#276862}.h17MobileFull{background:#202b28;color:#fff;margin-top:12px}.h17MobilePrimary:disabled,.h17MobileSoft:disabled{opacity:.45}
        .h17MobilePhotoHint{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.h17MobilePhotoHint small{width:100%;font-size:9px;color:#8a918d}.h17MobilePhotoHint span{font-size:9px;background:#f4f0e8;color:#606a65;border-radius:999px;padding:5px 7px;display:flex;align-items:center;gap:4px}
        .h17MobileSmartCard h3{font-size:16px;margin:10px 0 3px}.h17MobileSmartCard>p{font-size:10px;color:#2f7b80;margin:0}.h17MobileReason,.h17MobileMuted,.h17MobileDraftText{margin-top:9px;border-radius:11px;background:#f5f2ec;padding:9px 10px;font-size:10px;line-height:1.65;color:#65706a}.h17MobileDraftText{max-height:145px;overflow:hidden;white-space:pre-wrap}
        .h17MobileMessage{margin-top:10px;background:#233b38;color:#fff;border-radius:11px;padding:9px 10px;font-size:10px;line-height:1.55}
      }
    `}</style>
  </div>
}
