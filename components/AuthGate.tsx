'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import TravelOS from '@/components/TravelOS'
import TravelOSAssistant from '@/components/TravelOSAssistant'
import { createClient } from '@/lib/supabase/client'

type GateState = 'loading' | 'locked' | 'ready' | 'setup'

export default function AuthGate(){
  const supabase = useMemo(()=>createClient(),[])
  const [state,setState] = useState<GateState>('loading')
  const [passphrase,setPassphrase] = useState('')
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('正在确认这台设备…')

  useEffect(()=>{
    let alive = true
    let settled = false

    const finish = (nextState:GateState,nextMessage?:string)=>{
      if(!alive)return
      settled = true
      window.clearTimeout(timer)
      if(nextMessage!==undefined)setMessage(nextMessage)
      setState(nextState)
    }

    const timer = window.setTimeout(()=>{
      if(alive && !settled){
        finish('setup','设备确认超时，请点下面按钮重试。')
      }
    },12000)

    async function prepare(){
      try{
        setState('loading')
        setMessage('正在确认这台设备…')

        let {data:{session},error:sessionError} = await supabase.auth.getSession()
        if(sessionError) throw sessionError

        if(!session){
          setMessage('正在建立这台设备的私人会话…')
          const {data,error} = await supabase.auth.signInAnonymously()
          if(error){
            finish('setup',error.message.toLowerCase().includes('anonymous')
              ? '私人模式还差最后一步：请先在 Supabase 开启 Anonymous Sign-Ins。'
              : `设备初始化失败：${error.message}`)
            return
          }
          session = data.session
        }

        if(!session){
          finish('setup','没有建立设备会话，请刷新后再试。')
          return
        }

        setMessage('正在检查这台设备是否已授权…')
        const {data,error} = await supabase.rpc('h17_workspace_is_unlocked')
        if(error){
          finish('setup',error.message.includes('h17_workspace_is_unlocked')
            ? '私人模式数据库还没有初始化。请先运行 private-workspace.sql。'
            : `权限检查失败：${error.message}`)
          return
        }

        finish(data===true?'ready':'locked','')
      }catch(error:any){
        finish('setup',`设备初始化失败：${error?.message||'未知错误'}`)
      }
    }

    void prepare()
    return()=>{
      alive=false
      settled=true
      window.clearTimeout(timer)
    }
  },[supabase])

  async function unlock(e:FormEvent){
    e.preventDefault()
    if(!passphrase.trim())return
    setBusy(true)
    setMessage('正在验证私人访问口令…')

    try{
      const {data,error} = await supabase.rpc('h17_unlock_workspace',{p_passphrase:passphrase.trim()})
      if(error){
        setMessage(`验证失败：${error.message}`)
        return
      }
      if(data!==true){
        setMessage('访问口令不正确，请重新输入。')
        setPassphrase('')
        return
      }

      setPassphrase('')
      setMessage('')
      setState('ready')
    }catch(error:any){
      setMessage(`验证失败：${error?.message||'网络异常，请重试'}`)
    }finally{
      setBusy(false)
    }
  }

  if(state==='ready'){
    return <div className="h17PrivateReady">
      <div className="h17PrivateBadge"><ShieldCheck size={15}/> 私人模式 · 此设备已授权</div>
      <TravelOS/>
      <TravelOSAssistant/>
    </div>
  }

  return <main className="h17GatePage">
    <section className="h17GateCard">
      <div className="h17GateMark">禾十七 <span>TRAVEL OS</span></div>

      {state==='loading'?<>
        <div className="h17GateIcon"><ShieldCheck size={28}/></div>
        <h1>正在进入私人工作区</h1>
        <p>{message}</p>
        <div className="h17GateLoader"><i/></div>
      </>:state==='setup'?<>
        <div className="h17GateIcon"><LockKeyhole size={28}/></div>
        <h1>私人模式连接异常</h1>
        <p>{message}</p>
        <button className="h17GateRetry" onClick={()=>location.reload()}>重新连接</button>
      </>:<>
        <div className="h17GateIcon"><LockKeyhole size={28}/></div>
        <span className="h17GateEyebrow">PRIVATE WORKSPACE</span>
        <h1>进入禾十七</h1>
        <p>这台设备第一次进入时验证一次。之后手机和电脑都会长期记住，不需要邮箱、验证码或登录码。</p>
        <form onSubmit={unlock}>
          <label>私人访问口令</label>
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={e=>{setPassphrase(e.target.value);setMessage('')}}
            placeholder="输入访问口令"
          />
          {message&&<div className="h17GateMessage">{message}</div>}
          <button disabled={busy||!passphrase.trim()}>{busy?'验证中…':'进入工作台'}</button>
        </form>
        <small>✓ 网址本身不再等于访问权限　✓ 验证后本机自动保持授权</small>
      </>}
    </section>
  </main>
}
