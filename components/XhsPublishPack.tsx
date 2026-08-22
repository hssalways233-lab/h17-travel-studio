'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, FileArchive, Loader2, Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Topic={id:string;title:string;destination:string;content_type:string}
type Material={id:string;storage_path:string;caption:string|null;url:string}
type OverlayPosition='top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'
type PlanItem={id:string;include:boolean;role:string;needsText:boolean;overlayText:string;overlayPosition:OverlayPosition;reason:string;verifiedFacts:string[]}
type Plan={coverId:string|null;publishIds:string[];orderIds:string[];reason:string;overlayTitle:string;overlaySubtitle:string;items:PlanItem[];verifiedFacts:string[];source?:string}
type Draft={title:string;coverTitle:string;coverSubtitle:string;route:string;body:string;hashtags:string[];source?:string}

type Pack={topic:Topic;materials:Material[];plan:Plan;draft:Draft}

function stripTitle(v=''){return v.replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'').trim()}
function count(v=''){return Array.from(v).length}
function safeFile(v=''){return v.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim().slice(0,60)||'image'}

function crc32(bytes:Uint8Array){
  let c=0xffffffff
  for(const b of bytes){
    c^=b
    for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)
  }
  return (c^0xffffffff)>>>0
}
function u16(n:number){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n:number){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
async function makeZip(files:Array<{name:string;blob:Blob}>){
  const enc=new TextEncoder();const locals:BlobPart[]=[];const central:BlobPart[]=[];let offset=0
  for(const f of files){
    const name=enc.encode(f.name);const data=new Uint8Array(await f.blob.arrayBuffer());const crc=crc32(data)
    const local=new Blob([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data])
    locals.push(local)
    const cen=new Blob([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name])
    central.push(cen);offset+=local.size
  }
  const centralBlob=new Blob(central);const end=new Blob([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBlob.size),u32(offset),u16(0)])
  return new Blob([...locals,centralBlob,end],{type:'application/zip'})
}

async function renderImage(m:Material,item:PlanItem){
  const res=await fetch(m.url);if(!res.ok)throw new Error('读取图片失败')
  const original=await res.blob()
  if(!item.needsText||!item.overlayText.trim())return {blob:original,ext:original.type.includes('png')?'png':original.type.includes('webp')?'webp':'jpg'}
  const bitmap=await createImageBitmap(original)
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片处理失败')
  ctx.drawImage(bitmap,0,0)
  const w=canvas.width,h=canvas.height
  const size=Math.max(30,Math.min(82,Math.round(w*0.055)))
  ctx.font=`800 ${size}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`
  ctx.textBaseline='middle'
  const chars=Array.from(item.overlayText.trim());const maxChars=Math.max(6,Math.floor(w/(size*.95)))
  const lines:string[]=[];for(let i=0;i<chars.length;i+=maxChars)lines.push(chars.slice(i,i+maxChars).join(''))
  const padX=Math.round(size*.55),padY=Math.round(size*.42),lineH=Math.round(size*1.22)
  const textW=Math.min(w-Math.round(w*.1),Math.max(...lines.map(x=>ctx.measureText(x).width))+padX*2)
  const boxH=lines.length*lineH+padY*2
  const margin=Math.round(Math.min(w,h)*.055)
  let x=margin,y=margin
  if(item.overlayPosition.includes('right'))x=w-margin-textW
  else if(item.overlayPosition.includes('center'))x=(w-textW)/2
  if(item.overlayPosition.startsWith('bottom'))y=h-margin-boxH
  ctx.fillStyle='rgba(20,28,26,.78)'
  const r=Math.round(size*.42);ctx.beginPath();ctx.roundRect(x,y,textW,boxH,r);ctx.fill()
  ctx.fillStyle='#fff';ctx.textAlign='left'
  lines.forEach((line,i)=>ctx.fillText(line,x+padX,y+padY+lineH*i+lineH/2))
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('导出图片失败')),'image/png'))
  return {blob,ext:'png'}
}

export default function XhsPublishPack(){
  const supabase=useMemo(()=>createClient(),[])
  const [host,setHost]=useState<Element|null>(null)
  const [open,setOpen]=useState(false)
  const [busy,setBusy]=useState(false)
  const [downloading,setDownloading]=useState(false)
  const [pack,setPack]=useState<Pack|null>(null)
  const [message,setMessage]=useState('')

  useEffect(()=>{
    let alive=true
    const find=()=>{if(!alive)return;const h=document.querySelector('.osContentHead');if(h&&h!==host)setHost(h)}
    find();const o=new MutationObserver(find);o.observe(document.body,{childList:true,subtree:true})
    return()=>{alive=false;o.disconnect()}
  },[host])

  async function build(){
    const id=(document.querySelector('.osContentHead select') as HTMLSelectElement|null)?.value
    if(!id)return
    setOpen(true);setBusy(true);setPack(null);setMessage('正在逐张读取真实素材，识别路线、费用、人物和环境…')
    try{
      const [{data:t},{data:m},{data:d}]=await Promise.all([
        supabase.from('topics').select('id,title,destination,content_type').eq('id',id).maybeSingle(),
        supabase.from('materials').select('id,storage_path,caption').contains('tags',[`topic:${id}`]).order('created_at',{ascending:true}),
        supabase.from('drafts').select('route,body,cover_title,cover_subtitle').eq('topic_id',id).order('version',{ascending:false}).limit(1).maybeSingle(),
      ])
      if(!t)throw new Error('没有找到当前内容')
      const materials:Material[]=[]
      for(const row of (m||[]) as any[]){
        const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(row.storage_path,3600)
        if(s?.signedUrl)materials.push({...row,url:s.signedUrl})
      }
      if(!materials.length)throw new Error('当前内容还没有图片')
      setMessage(`正在分析 ${materials.length} 张原图；人物图只允许保留原图或加文字，不做任何重绘。`)
      const pr=await fetch('/api/media-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:stripTitle(t.title),destination:t.destination,contentType:t.content_type,images:materials.map(x=>({id:x.id,url:x.url,caption:x.caption||''}))})})
      if(!pr.ok)throw new Error('真实图片分析失败')
      const plan=await pr.json() as Plan
      if(plan.source!=='openai'){
        setMessage('当前视觉模型没有真正连上，系统只能按规则排图，不能可靠读取你两张打车截图里的金额和路线。我不会拿规则结果冒充真实分析。')
        setPack({topic:t as Topic,materials,plan,draft:{title:'',coverTitle:'',coverSubtitle:'',route:d?.route||'',body:'',hashtags:[],source:'fallback'}})
        return
      }
      const visualNotes=[plan.reason,...(plan.verifiedFacts||[]),...plan.items.filter(x=>x.include).flatMap((x,i)=>[`图${i+1} ${x.role}${x.needsText?` 加字“${x.overlayText}”`:' 原图'}`,...(x.verifiedFacts||[])])].join('；')
      setMessage('路线与费用证据已识别，正在生成标题、正文和标签…')
      const dr=await fetch('/api/ai-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:t.destination,title:stripTitle(t.title),contentType:t.content_type,route:d?.route||'',coverTitle:plan.overlayTitle||d?.cover_title||'',coverSubtitle:plan.overlaySubtitle||d?.cover_subtitle||'',body:d?.body||'',visualNotes})})
      if(!dr.ok)throw new Error('发布文案生成失败')
      const draft=await dr.json() as Draft
      setPack({topic:t as Topic,materials,plan,draft});setMessage('最终发布包已生成：选片、顺序、加字、标题、正文和标签都已定好。')
    }catch(e:any){setMessage(e?.message||'生成失败')}
    finally{setBusy(false)}
  }

  async function copyAll(){
    if(!pack)return
    const text=`${pack.draft.title}\n\n${pack.draft.body}\n\n${pack.draft.hashtags.join(' ')}`.trim()
    await navigator.clipboard.writeText(text);setMessage('标题、正文、标签已复制。')
  }

  async function downloadPack(){
    if(!pack||pack.plan.source!=='openai')return
    setDownloading(true);setMessage('正在用原图生成发布包：不换脸、不修人像，只在指定图片叠加文字…')
    try{
      const map=new Map(pack.materials.map(x=>[x.id,x]));const selected=pack.plan.items.filter(x=>x.include).sort((a,b)=>pack.plan.orderIds.indexOf(a.id)-pack.plan.orderIds.indexOf(b.id))
      const files:Array<{name:string;blob:Blob}>=[]
      for(let i=0;i<selected.length;i++){
        const item=selected[i],m=map.get(item.id);if(!m)continue
        const out=await renderImage(m,item)
        files.push({name:`${String(i+1).padStart(2,'0')}-${safeFile(item.role)}.${out.ext}`,blob:out.blob})
      }
      const guide=[
        `标题（${count(pack.draft.title)}/20）：${pack.draft.title}`,
        '',
        '正文：',pack.draft.body,'',
        `标签：${pack.draft.hashtags.join(' ')}`,'',
        `正文+标签字符数：${count(`${pack.draft.body}\n\n${pack.draft.hashtags.join(' ')}`)}/1000`,'',
        '发图顺序：',
        ...selected.map((x,i)=>`${i+1}. ${x.role}｜${x.needsText?`加字：${x.overlayText}｜位置：${x.overlayPosition}`:'原图，不加字'}${x.verifiedFacts?.length?`｜证据：${x.verifiedFacts.join('；')}`:''}`),
        '',
        '图片中确认到的真实信息：',...(pack.plan.verifiedFacts||[]).map(x=>`- ${x}`),
        '',
        '原则：所有人物照片保留原图，不重绘、不换脸、不修改样貌。'
      ].join('\n')
      files.push({name:'发布文案与排图说明.txt',blob:new Blob([guide],{type:'text/plain;charset=utf-8'})})
      const zip=await makeZip(files);const a=document.createElement('a');a.href=URL.createObjectURL(zip);a.download=`${safeFile(pack.topic.destination)}-小红书最终发布包.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)
      setMessage('发布包已下载：按 01、02、03… 顺序直接上传小红书即可。')
    }catch(e:any){setMessage(e?.message||'下载失败')}
    finally{setDownloading(false)}
  }

  const selected=pack?.plan.items.filter(x=>x.include).sort((a,b)=>pack.plan.orderIds.indexOf(a.id)-pack.plan.orderIds.indexOf(b.id))||[]
  const mm=new Map(pack?.materials.map(x=>[x.id,x])||[])

  return <>
    {host&&createPortal(<button className="h17FinalPackBtn" onClick={()=>void build()}><Sparkles size={15}/>生成最终发布包</button>,host)}
    {open&&createPortal(<div className="h17PackBackdrop" onClick={()=>setOpen(false)}><section className="h17Pack" onClick={e=>e.stopPropagation()}>
      <header><div><span>FINAL PUBLISH PACK</span><h2>小红书最终发布包</h2><p>只使用禾十七里这篇的真实原图。人物不重绘、不换脸、不改样貌。</p></div><button onClick={()=>setOpen(false)}><X size={19}/></button></header>
      {busy&&<div className="h17PackLoading"><Loader2 className="spin" size={20}/>{message}</div>}
      {!busy&&message&&<div className="h17PackMessage">{message}</div>}
      {pack&&<>
        {pack.plan.source!=='openai'?<div className="h17PackWarn">真实视觉模型当前未连接，所以我没有把“规则猜测”当成最终答案。连接后这里会直接读取你那两张往返打车截图中的路线、金额和时长。</div>:<>
          <div className="h17PackActions"><button onClick={()=>void copyAll()}><Copy size={15}/>复制标题+正文+标签</button><button className="primary" onClick={()=>void downloadPack()} disabled={downloading}>{downloading?<Loader2 className="spin" size={15}/>:<FileArchive size={15}/>}一键下载成品图+文案</button></div>
          <section className="h17PackCopy"><div><small>标题 {count(pack.draft.title)}/20</small><b>{pack.draft.title}</b></div><p>{pack.draft.body}</p><strong>{pack.draft.hashtags.join(' ')}</strong><small>正文+标签 {count(`${pack.draft.body}\n\n${pack.draft.hashtags.join(' ')}`)}/1000</small></section>
          {(pack.plan.verifiedFacts||[]).length>0&&<section className="h17Facts"><span>从你图片里确认到的真实信息</span>{pack.plan.verifiedFacts.map((x,i)=><p key={i}><Check size={13}/>{x}</p>)}</section>}
          <div className="h17PackGrid">{selected.map((item,i)=>{const m=mm.get(item.id);return <article key={item.id}>{m&&<img src={m.url} alt={item.role}/>}<i>{i+1}</i><div><b>{item.role}</b><span>{item.needsText?`加字：${item.overlayText}`:'原图，不加字'}</span>{item.needsText&&<small>位置：{item.overlayPosition}</small>}{item.verifiedFacts?.map((f,j)=><small key={j}>{f}</small>)}</div></article>})}</div>
        </>}
      </>}
    </section></div>,document.body)}
    <style>{`
      .h17FinalPackBtn{border:0;border-radius:12px;background:#1f5f62;color:#fff;padding:11px 14px;font-weight:800;display:flex;align-items:center;gap:7px;white-space:nowrap;cursor:pointer}
      .h17PackBackdrop{position:fixed;inset:0;z-index:900;background:rgba(24,30,28,.48);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px}
      .h17Pack{width:min(1120px,96vw);max-height:92vh;overflow:auto;background:#f8f5ee;border-radius:24px;padding:22px;color:#202522;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 30px 90px rgba(0,0,0,.22)}
      .h17Pack>header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.h17Pack>header span{font-size:9px;letter-spacing:.2em;color:#2f7b80;font-weight:900}.h17Pack>header h2{margin:6px 0 4px;font-size:30px}.h17Pack>header p{margin:0;color:#77807b;font-size:12px}.h17Pack>header button{border:0;background:#eee8df;border-radius:999px;width:38px;height:38px;display:grid;place-items:center}
      .h17PackLoading,.h17PackMessage,.h17PackWarn{margin-top:16px;padding:12px 14px;border-radius:13px;background:#edf6f3;color:#315f59;display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.6}.h17PackWarn{background:#fff4df;color:#795621}
      .h17PackActions{display:flex;justify-content:flex-end;gap:8px;margin:16px 0}.h17PackActions button{border:1px solid #d8d2c9;background:#fff;border-radius:11px;padding:10px 12px;display:flex;align-items:center;gap:6px;font-weight:750}.h17PackActions .primary{background:#2f7b80;border-color:#2f7b80;color:#fff}
      .h17PackCopy{background:#fff;border:1px solid #e1dbd2;border-radius:18px;padding:16px}.h17PackCopy>div{display:flex;justify-content:space-between;gap:12px;align-items:center}.h17PackCopy b{font-size:18px}.h17PackCopy small{color:#77807b}.h17PackCopy p{white-space:pre-wrap;line-height:1.7;font-size:13px}.h17PackCopy strong{display:block;color:#2f6b66;font-size:12px;margin-top:10px}
      .h17Facts{margin-top:14px;background:#fff9ec;border:1px solid #eadcba;border-radius:16px;padding:14px}.h17Facts>span{font-size:10px;font-weight:850;color:#8a6726}.h17Facts p{margin:7px 0 0;display:flex;gap:6px;align-items:flex-start;font-size:11px;line-height:1.55}
      .h17PackGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.h17PackGrid article{position:relative;background:#fff;border:1px solid #e1dbd2;border-radius:16px;overflow:hidden}.h17PackGrid img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover}.h17PackGrid article>i{position:absolute;top:8px;left:8px;background:#202b28;color:#fff;width:26px;height:26px;border-radius:999px;display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:850}.h17PackGrid article>div{padding:10px;display:grid;gap:4px}.h17PackGrid b{font-size:12px}.h17PackGrid span{font-size:10px;color:#2f7b80}.h17PackGrid small{font-size:9px;line-height:1.45;color:#7b827e}
      .spin{animation:h17spin 1s linear infinite}@keyframes h17spin{to{transform:rotate(360deg)}}
      @media(max-width:720px){.h17FinalPackBtn{width:100%;justify-content:center;margin-top:8px}.h17PackBackdrop{padding:0;align-items:end}.h17Pack{width:100%;max-height:94vh;border-radius:24px 24px 0 0;padding:17px 14px calc(24px + env(safe-area-inset-bottom))}.h17Pack>header h2{font-size:24px}.h17PackActions{display:grid;grid-template-columns:1fr}.h17PackActions button{justify-content:center}.h17PackGrid{grid-template-columns:repeat(2,1fr);gap:9px}.h17PackCopy>div{display:grid}.h17PackGrid img{aspect-ratio:4/5}}
    `}</style>
  </>
}
