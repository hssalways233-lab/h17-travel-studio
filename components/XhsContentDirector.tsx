'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Image as ImageIcon, RefreshCw, Sparkles, Type, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Topic={id:string;title:string;destination:string;content_type:string}
type Material={id:string;storage_path:string;tags:string[];caption:string|null;url:string}
type PlanItem={id:string;include:boolean;role:string;needsText:boolean;overlayText:string;reason:string}
type Plan={coverId:string|null;publishIds:string[];orderIds:string[];reason:string;overlayTitle:string;overlaySubtitle:string;items:PlanItem[];source?:string}

type DraftResult={title:string;coverTitle:string;coverSubtitle:string;route:string;body:string;hashtags:string[];source?:string}

const TITLE_MAX=20
const BODY_MAX=1000
function count(v=''){return Array.from(v).length}
function cut(v:string,max:number){return Array.from(v).slice(0,max).join('')}
function stripTitle(v=''){return v.replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'').trim()}
function pathOf(v=''){try{return new URL(v,location.origin).pathname}catch{return v.split('?')[0]}}
function nativeSet(el:HTMLInputElement|HTMLTextAreaElement,value:string){
  const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(el,value)
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))
}

export default function XhsContentDirector(){
  const supabase=useMemo(()=>createClient(),[])
  const [topicId,setTopicId]=useState('')
  const [topic,setTopic]=useState<Topic|null>(null)
  const [materials,setMaterials]=useState<Material[]>([])
  const [plan,setPlan]=useState<Plan|null>(null)
  const [mediaMount,setMediaMount]=useState<Element|null>(null)
  const [copyMount,setCopyMount]=useState<Element|null>(null)
  const [busy,setBusy]=useState(false)
  const [draftBusy,setDraftBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [titleCount,setTitleCount]=useState(0)
  const [bodyCount,setBodyCount]=useState(0)
  const autoSig=useRef('')

  function readTopicId(){return (document.querySelector('.osContentHead select') as HTMLSelectElement|null)?.value||''}
  function ensureMounts(){
    const media=document.querySelector('.osMediaMain')
    if(media){
      let m=media.querySelector(':scope > .h17DirectorMount')
      if(!m){m=document.createElement('div');m.className='h17DirectorMount';const gallery=media.querySelector('.osGallery');media.insertBefore(m,gallery||media.firstChild)}
      if(mediaMount!==m)setMediaMount(m)
    }else if(mediaMount)setMediaMount(null)
    const form=document.querySelector('.osCopyWorkspace .osForm')
    if(form){
      let m=form.querySelector(':scope > .h17LimitMount')
      if(!m){m=document.createElement('div');m.className='h17LimitMount';const ai=form.querySelector('.osAiBox');ai?.insertAdjacentElement('afterend',m)}
      if(copyMount!==m)setCopyMount(m)
    }else if(copyMount)setCopyMount(null)
  }

  async function refresh(id=readTopicId()){
    if(!id)return
    const [{data:t},{data:m}]=await Promise.all([
      supabase.from('topics').select('id,title,destination,content_type').eq('id',id).maybeSingle(),
      supabase.from('materials').select('id,storage_path,tags,caption').contains('tags',[`topic:${id}`]).order('created_at',{ascending:true})
    ])
    if(!t)return
    const signed:Material[]=[]
    for(const row of (m||[]) as any[]){
      const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(row.storage_path,3600)
      if(s?.signedUrl)signed.push({...row,url:s.signedUrl})
    }
    setTopic(t as Topic);setMaterials(signed)
    const existing=planFromTags(id,signed)
    if(existing)setPlan(existing)
    else setPlan(null)
  }

  function planFromTags(id:string,list:Material[]):Plan|null{
    const selected=list.filter(m=>m.tags?.includes(`publish:${id}`))
    if(!selected.length)return null
    const getOrder=(m:Material)=>Number((m.tags||[]).find(x=>x.startsWith(`order:${id}:`))?.split(':').pop()||99)
    const ordered=[...selected].sort((a,b)=>getOrder(a)-getOrder(b))
    const items:PlanItem[]=list.map(m=>{
      const roleTag=(m.tags||[]).find(x=>x.startsWith(`role:${id}:`))
      const copyTag=(m.tags||[]).find(x=>x.startsWith(`overlaycopy:${id}:`))
      return {id:m.id,include:selected.some(x=>x.id===m.id),role:roleTag?decodeURIComponent(roleTag.split(':').slice(2).join(':')):'补充图',needsText:(m.tags||[]).includes(`text:${id}:1`),overlayText:copyTag?decodeURIComponent(copyTag.split(':').slice(2).join(':')):'',reason:''}
    })
    return {coverId:ordered.find(m=>m.tags?.includes(`cover:${id}`))?.id||ordered[0]?.id||null,publishIds:ordered.map(x=>x.id),orderIds:ordered.map(x=>x.id),reason:'已采用系统选片方案。',overlayTitle:'',overlaySubtitle:'',items,source:'saved'}
  }

  useEffect(()=>{
    let alive=true
    const sync=()=>{if(!alive)return;ensureMounts();const id=readTopicId();if(id&&id!==topicId){setTopicId(id);void refresh(id)}}
    sync()
    const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true})
    const onChange=(e:Event)=>{const target=e.target as HTMLElement;if(target.matches?.('.osContentHead select')){const id=(target as HTMLSelectElement).value;setTopicId(id);void refresh(id)}}
    document.addEventListener('change',onChange,true)
    return()=>{alive=false;observer.disconnect();document.removeEventListener('change',onChange,true)}
  },[topicId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!topic||!materials.length)return
    const sig=`${topic.id}:${materials.map(x=>x.id).join(',')}`
    if(plan){applyGallery(plan);return}
    if(autoSig.current===sig)return
    autoSig.current=sig
    const timer=setTimeout(()=>void analyze(),450)
    return()=>clearTimeout(timer)
  },[topic?.id,materials.map(x=>x.id).join(','),plan]) // eslint-disable-line react-hooks/exhaustive-deps

  async function persistPlan(next:Plan){
    if(!topic)return
    const id=topic.id
    for(const m of materials){
      const item=next.items.find(x=>x.id===m.id)
      const order=next.orderIds.indexOf(m.id)
      const prefixes=[`publish:${id}`,`order:${id}:`,`text:${id}:`,`role:${id}:`,`overlaycopy:${id}:`]
      const tags=(m.tags||[]).filter(x=>!prefixes.some(p=>x===p||x.startsWith(p))&&x!==`cover:${id}`)
      if(next.publishIds.includes(m.id))tags.push(`publish:${id}`)
      if(order>=0)tags.push(`order:${id}:${String(order+1).padStart(2,'0')}`)
      if(item?.needsText)tags.push(`text:${id}:1`)
      if(item?.role)tags.push(`role:${id}:${encodeURIComponent(item.role)}`)
      if(item?.overlayText)tags.push(`overlaycopy:${id}:${encodeURIComponent(item.overlayText)}`)
      if(next.coverId===m.id)tags.push(`cover:${id}`)
      await supabase.from('materials').update({tags}).eq('id',m.id)
    }
  }

  async function analyze(){
    if(!topic||!materials.length||busy)return
    setBusy(true);setMessage(`正在分析 ${materials.length} 张真实照片…`)
    try{
      const r=await fetch('/api/media-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:stripTitle(topic.title),destination:topic.destination,contentType:topic.content_type,images:materials.slice(0,18).map(m=>({id:m.id,url:m.url,caption:m.caption||''}))})})
      if(!r.ok)throw new Error('图片分析失败')
      const next=await r.json() as Plan
      setPlan(next);await persistPlan(next);applyGallery(next)
      setMessage(`已直接选好 ${next.publishIds.length} / ${materials.length} 张，并按发布顺序排好。`)
    }catch(e:any){setMessage(e?.message||'图片分析失败，请重试')}
    finally{setBusy(false)}
  }

  function applyGallery(p:Plan){
    setTimeout(()=>{
      const cards=[...document.querySelectorAll('.osGallery .osMediaCard')] as HTMLElement[]
      const byPath=new Map(materials.map(m=>[pathOf(m.url),m]))
      cards.forEach(card=>{
        const img=card.querySelector('img') as HTMLImageElement|null;const m=img?byPath.get(pathOf(img.src)):undefined
        if(!m)return
        const order=p.orderIds.indexOf(m.id)
        const selected=order>=0
        card.style.order=String(selected?order:99)
        card.style.opacity=selected?'1':'.28'
        card.style.filter=selected?'none':'grayscale(.65)'
        card.title=selected?`建议第 ${order+1} 张发布`:'系统建议本篇不发这张'
      })
    },120)
  }

  function readCounts(){
    const form=document.querySelector('.osCopyWorkspace .osForm')
    const inputs=form?.querySelectorAll('input')||[];const areas=form?.querySelectorAll('textarea')||[]
    setTitleCount(count((inputs[0] as HTMLInputElement)?.value||''));setBodyCount(count((areas[1] as HTMLTextAreaElement)?.value||''))
  }

  useEffect(()=>{
    const onInput=(e:Event)=>{if((e.target as HTMLElement).closest?.('.osCopyWorkspace .osForm'))readCounts()}
    const onClick=(e:MouseEvent)=>{
      const target=e.target as HTMLElement
      const gen=target.closest('.osAiBox button') as HTMLButtonElement|null
      if(gen){e.preventDefault();e.stopPropagation();void generateDraft();return}
      const finish=target.closest('.osFormActions button') as HTMLButtonElement|null
      if(finish?.textContent?.includes('完成图文')){
        readCounts()
        const form=document.querySelector('.osCopyWorkspace .osForm');const inputs=form?.querySelectorAll('input')||[];const areas=form?.querySelectorAll('textarea')||[]
        const tc=count((inputs[0] as HTMLInputElement)?.value||'');const bc=count((areas[1] as HTMLTextAreaElement)?.value||'')
        if(tc>TITLE_MAX||bc>BODY_MAX){e.preventDefault();e.stopPropagation();alert(`先调整字数：标题 ${tc}/${TITLE_MAX}，正文 ${bc}/${BODY_MAX}`)}
      }
    }
    document.addEventListener('input',onInput,true);document.addEventListener('click',onClick,true)
    const timer=setInterval(()=>{ensureMounts();readCounts()},800)
    return()=>{document.removeEventListener('input',onInput,true);document.removeEventListener('click',onClick,true);clearInterval(timer)}
  },[topic,plan,materials]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateDraft(){
    const id=readTopicId();if(!id||draftBusy)return
    let t=topic
    if(!t||t.id!==id){const {data}=await supabase.from('topics').select('id,title,destination,content_type').eq('id',id).maybeSingle();t=data as Topic|null}
    if(!t)return
    const form=document.querySelector('.osCopyWorkspace .osForm');const inputs=form?.querySelectorAll('input')||[];const areas=form?.querySelectorAll('textarea')||[]
    const route=(areas[0] as HTMLTextAreaElement)?.value||''
    const existingBody=(areas[1] as HTMLTextAreaElement)?.value||''
    const visualNotes=plan?`${plan.reason}；发图顺序：${plan.items.filter(x=>x.include).map((x,i)=>`${i+1}.${x.role}${x.needsText?`（加字：${x.overlayText}）`:'（原图）'}`).join('；')}`:''
    setDraftBusy(true);setMessage('正在重写标题、正文和标签，并检查小红书字数…')
    try{
      const r=await fetch('/api/ai-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:t.destination,title:stripTitle(t.title),contentType:t.content_type,route,coverTitle:(inputs[1] as HTMLInputElement)?.value||plan?.overlayTitle||'',coverSubtitle:(inputs[2] as HTMLInputElement)?.value||plan?.overlaySubtitle||'',body:existingBody,visualNotes})})
      if(!r.ok)throw new Error('发布稿生成失败')
      const d=await r.json() as DraftResult
      const tags=(d.hashtags||[]).join(' ')
      const suffix=tags?`\n\n${tags}`:''
      const body=`${cut(d.body||'',BODY_MAX-count(suffix))}${suffix}`.trim()
      if(inputs[0])nativeSet(inputs[0] as HTMLInputElement,cut(d.title||'',TITLE_MAX))
      if(inputs[1])nativeSet(inputs[1] as HTMLInputElement,d.coverTitle||'')
      if(inputs[2])nativeSet(inputs[2] as HTMLInputElement,d.coverSubtitle||'')
      if(areas[0])nativeSet(areas[0] as HTMLTextAreaElement,d.route||route)
      if(areas[1])nativeSet(areas[1] as HTMLTextAreaElement,body)
      setTitleCount(count(d.title||''));setBodyCount(count(body))
      setMessage(`已重写：标题 ${count(d.title||'')}/${TITLE_MAX}，正文+标签 ${count(body)}/${BODY_MAX}。`)
    }catch(e:any){setMessage(e?.message||'生成失败，请重试')}
    finally{setDraftBusy(false)}
  }

  const selected=plan?.items.filter(x=>x.include).sort((a,b)=>(plan.orderIds.indexOf(a.id)-plan.orderIds.indexOf(b.id)))||[]
  const excluded=plan?.items.filter(x=>!x.include)||[]
  const materialMap=new Map(materials.map(x=>[x.id,x]))

  return <>
    {mediaMount&&createPortal(<section className="h17Director">
      <div className="h17DirectorHead"><div><span>AI VISUAL DIRECTOR</span><h3>这篇到底发哪几张</h3><p>{busy?'正在逐张看图…':plan?`已从 ${materials.length} 张里选出 ${selected.length} 张，顺序和加字位置已经定好。`:'正在准备选片方案…'}</p></div><button onClick={()=>void analyze()} disabled={busy||!materials.length}><RefreshCw size={15}/>{busy?'分析中':'重新分析'}</button></div>
      {plan&&<><div className="h17DirectorSummary"><b>封面字：{plan.overlayTitle||'按图决定'}</b><span>{plan.overlaySubtitle}</span><p>{plan.reason}</p></div><div className="h17DirectorGrid">{selected.map((item,i)=>{const m=materialMap.get(item.id);return <article key={item.id} className={item.id===plan.coverId?'cover':''}>{m?.url&&<img src={m.url} alt="推荐配图"/>}<i>{i+1}</i><div><b>{item.role}</b><span className={item.needsText?'text':'raw'}>{item.needsText?<><Type size={12}/>加字：{item.overlayText||'短信息'}</>:<><ImageIcon size={12}/>原图，不加字</>}</span><small>{item.reason}</small></div></article>})}</div>{excluded.length>0&&<details className="h17DirectorSkip"><summary><XCircle size={14}/>本篇不建议发 {excluded.length} 张</summary><div>{excluded.map(x=>{const m=materialMap.get(x.id);return <span key={x.id}>{m?.url&&<img src={m.url} alt="备选"/>}<small>{x.reason||'与主线重复/作为备选'}</small></span>})}</div></details>}<div className="h17DirectorDone"><CheckCircle2 size={15}/>方案已自动写入素材：原图库会按推荐顺序排在前面，不建议发的图会变淡。</div></>}
      {message&&<div className="h17DirectorMsg"><Sparkles size={14}/>{message}</div>}
    </section>,mediaMount)}
    {copyMount&&createPortal(<div className="h17XhsLimits"><div><b>小红书发布限制</b><span>标题最多20字符 · 正文含标签最多1000字符</span></div><em className={titleCount>TITLE_MAX?'bad':''}>标题 {titleCount}/{TITLE_MAX}</em><em className={bodyCount>BODY_MAX?'bad':''}>正文 {bodyCount}/{BODY_MAX}</em>{draftBusy&&<strong>正在重写…</strong>}</div>,copyMount)}
    <style>{`
      .h17Director{border:1px solid #cfe0da;background:linear-gradient(135deg,#f2faf7,#fffaf1);border-radius:18px;padding:16px;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.h17DirectorHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.h17DirectorHead span{font-size:9px;letter-spacing:.17em;color:#2f7b80;font-weight:850}.h17DirectorHead h3{margin:5px 0 3px;font-size:20px}.h17DirectorHead p{margin:0;color:#77817c;font-size:11px}.h17DirectorHead button{border:1px solid #cfe1db;background:#fff;color:#2f6b65;border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:5px;font-weight:700}.h17DirectorSummary{margin-top:12px;background:#fff;border-radius:13px;padding:11px 12px}.h17DirectorSummary b{display:block;font-size:15px}.h17DirectorSummary span{display:block;color:#2f7b80;font-size:11px;margin-top:2px}.h17DirectorSummary p{font-size:10px;line-height:1.6;color:#68736e;margin:7px 0 0}.h17DirectorGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:11px}.h17DirectorGrid article{position:relative;background:#fff;border:1px solid #e1ddd4;border-radius:13px;overflow:hidden}.h17DirectorGrid article.cover{border:2px solid #2f7b80}.h17DirectorGrid img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block}.h17DirectorGrid article>i{position:absolute;left:7px;top:7px;background:#202a27;color:#fff;border-radius:999px;width:23px;height:23px;display:grid;place-items:center;font-size:10px;font-style:normal}.h17DirectorGrid article>div{padding:8px;display:grid;gap:5px}.h17DirectorGrid b{font-size:11px}.h17DirectorGrid span{font-size:9px;border-radius:8px;padding:5px 6px;display:flex;align-items:center;gap:4px}.h17DirectorGrid span.text{background:#fff1d7;color:#8b6118}.h17DirectorGrid span.raw{background:#edf6f3;color:#36685f}.h17DirectorGrid small{font-size:9px;line-height:1.45;color:#7b837f}.h17DirectorSkip{margin-top:10px;background:#f4f1eb;border-radius:11px;padding:8px 10px}.h17DirectorSkip summary{font-size:10px;color:#68716d;display:flex;align-items:center;gap:5px;cursor:pointer}.h17DirectorSkip>div{display:flex;gap:7px;overflow:auto;margin-top:8px}.h17DirectorSkip span{width:82px;flex:0 0 auto}.h17DirectorSkip img{width:82px;height:82px;object-fit:cover;border-radius:9px;opacity:.55}.h17DirectorSkip small{display:block;font-size:8px;line-height:1.35;color:#888f8b}.h17DirectorDone,.h17DirectorMsg{margin-top:10px;border-radius:10px;padding:8px 10px;font-size:10px;display:flex;align-items:center;gap:6px}.h17DirectorDone{background:#eaf5f1;color:#37675f}.h17DirectorMsg{background:#203a35;color:#fff}.h17XhsLimits{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff7e8;border:1px solid #ecd7aa;border-radius:12px;padding:9px 11px;margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.h17XhsLimits>div{margin-right:auto}.h17XhsLimits b{display:block;font-size:11px}.h17XhsLimits span{font-size:9px;color:#837866}.h17XhsLimits em{font-style:normal;font-size:10px;background:#fff;border-radius:999px;padding:5px 7px;color:#51605a}.h17XhsLimits em.bad{background:#fff0ee;color:#a1493e}.h17XhsLimits strong{font-size:10px;color:#2f7b80}
      @media(max-width:720px){.h17DirectorGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.h17DirectorHead h3{font-size:17px}.h17DirectorHead{align-items:center}.h17DirectorHead button{padding:7px}.h17XhsLimits{align-items:flex-start}.h17XhsLimits>div{width:100%}}
    `}</style>
  </>
}
