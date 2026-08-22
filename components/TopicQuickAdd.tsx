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
  </>
}