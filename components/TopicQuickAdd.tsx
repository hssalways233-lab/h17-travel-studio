'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TYPES=['路线型','决策型','实用型','经验型']

export default function TopicQuickAdd(){
  const supabase=useMemo(()=>createClient(),[])
  const [host,setHost]=useState<Element|null>(null)
  const [open,setOpen]=useState(false)
  const [destination,setDestination]=useState('')
  const [title,setTitle]=useState('')
  const [contentType,setContentType]=useState('实用型')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{
    let active=true
    const find=()=>{
      if(!active)return
      const el=document.querySelector('.osContentHead')
      if(el)setHost(el)
    }
    find()
    const observer=new MutationObserver(find)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>{active=false;observer.disconnect()}
  },[])

  async function submit(e:FormEvent){
    e.preventDefault()
    if(!destination.trim()||!title.trim())return
    setBusy(true);setMessage('正在加入选题库…')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setBusy(false);setMessage('设备会话失效，请刷新页面。');return}

    const {data:existing}=await supabase.from('topics').select('id').eq('title',title.trim()).limit(1).maybeSingle()
    if(existing?.id){setBusy(false);setMessage('这个标题已经在选题库里了。');return}

    const {data:dest}=await supabase.from('destinations').select('id').eq('name',destination.trim()).limit(1).maybeSingle()
    if(!dest?.id){
      const {error:destError}=await supabase.from('destinations').insert({user_id:user.id,name:destination.trim(),region:null})
      if(destError){setBusy(false);setMessage(`目的地创建失败：${destError.message}`);return}
    }

    const {error}=await supabase.from('topics').insert({
      user_id:user.id,
      title:title.trim(),
      destination:destination.trim(),
      content_type:contentType,
      status:'idea',
      planned_at:new Date().toISOString(),
    })
    setBusy(false)
    if(error){setMessage(`添加失败：${error.message}`);return}
    setMessage('已加入；它会立即出现在右侧内容下拉框里。')
    setTitle('')
    setTimeout(()=>{setOpen(false);setMessage('')},800)
  }

  return <>
    {host&&createPortal(<button className="h17InlineTopicAdd" onClick={()=>setOpen(true)}><Plus size={15}/> 自己添加下一篇</button>,host)}
    {open&&createPortal(<div className="h17TopicAddBackdrop" onClick={()=>setOpen(false)}>
      <section className="h17TopicAddCard" onClick={e=>e.stopPropagation()}>
        <header><div><small>NEW TOPIC</small><h3>自己添加下一篇</h3></div><button onClick={()=>setOpen(false)}><X size={19}/></button></header>
        <p>系统推荐只是建议。你随时可以自己决定下一篇，添加后会进入候选池，并马上出现在“内容”的下拉框里。</p>
        <form onSubmit={submit}>
          <label>目的地<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="例如：马来西亚 / 香港 / 泰国"/></label>
          <label>标题<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="输入你想做的下一篇标题"/></label>
          <label>内容类型<select value={contentType} onChange={e=>setContentType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
          {message&&<div className="h17TopicAddMessage">{message}</div>}
          <button className="h17TopicAddPrimary" disabled={busy||!destination.trim()||!title.trim()}>{busy?'添加中…':'加入候选池'}</button>
        </form>
      </section>
    </div>,document.body)}
    <style jsx global>{`
      .h17InlineTopicAdd{border:1px solid #cfe2dc;background:#edf6f3;color:#2f6660;border-radius:12px;padding:9px 11px;display:flex;align-items:center;gap:6px;font-weight:800;white-space:nowrap;cursor:pointer;margin-left:10px}
      .h17TopicAddBackdrop{position:fixed;inset:0;z-index:260;background:rgba(25,31,29,.38);backdrop-filter:blur(3px);display:grid;place-items:center;padding:18px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
      .h17TopicAddCard{width:min(440px,100%);background:#fffdf9;border:1px solid #ded8cd;border-radius:22px;padding:20px;box-shadow:0 28px 80px rgba(30,42,37,.18);color:#202522}
      .h17TopicAddCard header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.h17TopicAddCard header small{font-size:9px;letter-spacing:.18em;color:#2f7b80;font-weight:900}.h17TopicAddCard h3{font-size:24px;margin:5px 0 0}.h17TopicAddCard header button{border:1px solid #e0dad0;background:#fff;border-radius:10px;width:36px;height:36px;display:grid;place-items:center;color:#4c5651}.h17TopicAddCard>p{font-size:12px;line-height:1.7;color:#737b76;margin:12px 0 16px}
      .h17TopicAddCard form{display:grid;gap:10px}.h17TopicAddCard label{display:grid;gap:5px;font-size:11px;font-weight:700;color:#53605a}.h17TopicAddCard input,.h17TopicAddCard select{width:100%;border:1px solid #dcd5ca;background:#fff;color:#202522;border-radius:11px;padding:11px 12px;outline:none}.h17TopicAddCard input:focus,.h17TopicAddCard select:focus{border-color:#8eb7b1;box-shadow:0 0 0 3px rgba(47,123,128,.08)}
      .h17TopicAddMessage{font-size:11px;line-height:1.55;background:#f3f0e9;border-radius:10px;padding:9px;color:#5f6a65}.h17TopicAddPrimary{border:0;border-radius:12px;background:#2f7b80;color:#fff;padding:11px 13px;font-weight:850}.h17TopicAddPrimary:disabled{opacity:.5}
      .h17StrategySynced{font-size:10px;line-height:1.55;color:#62716b;background:#edf6f3;border-radius:10px;padding:8px 9px;margin-top:8px}
      @media(max-width:720px){.h17InlineTopicAdd{font-size:11px;padding:8px 9px;margin-left:0;margin-top:8px}.h17TopicAddBackdrop{align-items:end}.h17TopicAddCard{border-radius:22px 22px 0 0;width:100%;max-width:none}}
    `}</style>
  </>
}