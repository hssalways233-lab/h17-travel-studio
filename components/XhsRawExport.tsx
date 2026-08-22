'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function crc32(bytes:Uint8Array){
  let c=0xffffffff
  for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}
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
  const centralBlob=new Blob(central)
  const end=new Blob([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBlob.size),u32(offset),u16(0)])
  return new Blob([...locals,centralBlob,end],{type:'application/zip'})
}
function safe(v=''){return v.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim().slice(0,60)||'travel'}

export default function XhsRawExport(){
  const supabase=useMemo(()=>createClient(),[])
  const [host,setHost]=useState<Element|null>(null)
  const [busy,setBusy]=useState(false)
  const [note,setNote]=useState('')

  useEffect(()=>{
    let alive=true
    const find=()=>{if(!alive)return;const h=document.querySelector('.osContentHead');if(h&&h!==host)setHost(h)}
    find();const o=new MutationObserver(find);o.observe(document.body,{childList:true,subtree:true})
    return()=>{alive=false;o.disconnect()}
  },[host])

  async function exportRaw(){
    if(busy)return
    const id=(document.querySelector('.osContentHead select') as HTMLSelectElement|null)?.value
    if(!id)return
    setBusy(true);setNote('正在打包真实原图…')
    try{
      const [{data:t},{data:m}]=await Promise.all([
        supabase.from('topics').select('id,title,destination,content_type').eq('id',id).maybeSingle(),
        supabase.from('materials').select('id,storage_path,caption,created_at').contains('tags',[`topic:${id}`]).order('created_at',{ascending:true}),
      ])
      if(!t)throw new Error('没有找到当前内容')
      if(!m?.length)throw new Error('当前内容还没有图片')
      const files:Array<{name:string;blob:Blob}>=[]
      let n=0
      for(const row of m as any[]){
        const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(row.storage_path,3600)
        if(!s?.signedUrl)continue
        const r=await fetch(s.signedUrl);if(!r.ok)continue
        const blob=await r.blob();n++
        const ext=blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':blob.type.includes('heic')?'heic':'jpg'
        files.push({name:`${String(n).padStart(2,'0')}-原图-${safe(row.caption||row.id)}.${ext}`,blob})
      }
      const instruction=`请直接分析压缩包里的全部真实原图，不要让我再次解释图片内容。\n\n当前选题：${String(t.title||'').replace(/[「」]/g,'').replace(/^下一篇[:：]\\s*/,'')}\n目的地：${t.destination||''}\n内容类型：${t.content_type||''}\n\n我要一套可以直接发小红书的最终发布包：\n1. 逐张看真实图片，从全部素材里决定最终发哪7-10张，并明确舍弃哪些。\n2. 给最终图片按01、02、03…排序。\n3. 两张真实打车/地图/订单截图必须认真读取：识别去程、返程、起终点、金额、币种、时长；看不清的绝对不要猜。\n4. 每张图明确：原图不加字 / 需要加字；需要加字时写出具体文字和位置。\n5. 人物照片绝不能重绘、换脸、改变五官、身材或样貌；只允许保留原图，必要时在不遮挡人物的位置叠字。\n6. 生成小红书标题，严格控制在20字符以内。\n7. 生成可直接复制发布的正文和5-7个精准标签；正文+标签控制在1000字符内。\n8. 正文必须使用图片中确认到的真实路线和费用信息，不写模板话，不虚构。\n9. 最终输出：标题、正文、标签、发图顺序、每张图的加字方案，并尽可能直接生成处理后的图片成品。\n\n重点：效率优先，直接给最终方案，不要再让我逐张补充说明。`
      files.push({name:'00-给ChatGPT的分析要求.txt',blob:new Blob([instruction],{type:'text/plain;charset=utf-8'})})
      const zip=await makeZip(files)
      const a=document.createElement('a');a.href=URL.createObjectURL(zip);a.download=`${safe(t.destination||'旅行')}-原图包-上传给ChatGPT.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)
      setNote(`已导出 ${n} 张真实原图。把这个 ZIP 直接上传到当前 ChatGPT 对话即可。`)
    }catch(e:any){setNote(e?.message||'导出失败')}
    finally{setBusy(false);setTimeout(()=>setNote(''),5000)}
  }

  return <>
    {host&&createPortal(<div className="h17RawExportWrap"><button className="h17RawExportBtn" onClick={()=>void exportRaw()} disabled={busy}>{busy?<Loader2 className="h17RawSpin" size={15}/>:<Download size={15}/>}不等AI：导出原图给ChatGPT</button>{note&&<small>{note}</small>}</div>,host)}
    <style>{`
      .h17RawExportWrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.h17RawExportBtn{border:1px solid #b9cfcb;background:#eef8f5;color:#1f5f62;border-radius:12px;padding:11px 14px;font-weight:800;display:flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap}.h17RawExportBtn:disabled{opacity:.6;cursor:wait}.h17RawExportWrap small{font-size:10px;color:#64716d;max-width:260px}.h17RawSpin{animation:h17rawspin 1s linear infinite}@keyframes h17rawspin{to{transform:rotate(360deg)}}
      @media(max-width:720px){.h17RawExportWrap{width:100%}.h17RawExportBtn{width:100%;justify-content:center}.h17RawExportWrap small{max-width:none;width:100%;text-align:center}}
    `}</style>
  </>
}
