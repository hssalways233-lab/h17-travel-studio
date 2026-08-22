'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import TravelOS from '@/components/TravelOS'
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

    async function prepare(){
      try{
        setState('loading')
        setMessage('正在确认这台设备…')

        let {data:{session},error:sessionError} = await supabase.auth.getSession()
        if(sessionError) throw sessionError

        if(!session){
          const {data,error} = await supabase.auth.signInAnonymously()
          if(error){
            if(alive){
              setMessage(error.message.toLowerCase().includes('anonymous')
                ? '私人模式还差最后一步：请先在 Supabase 开启 Anonymous Sign-Ins。'
                : `设备初始化失败：${error.message}`)
              setState('setup')
            }
            return
          }
          session = data.session
        }

        if(!session){
          if(alive){setMessage('没有建立设备会话，请刷新后再试。');setState('setup')}
          return
        }

        const {data,error} = await supabase.rpc('h17_workspace_is_unlocked')
        if(error){
          if(alive){
            setMessage(error.message.includes('h17_workspace_is_unlocked')
              ? '私人模式数据库还没有初始化。请先运行 private-workspace.sql。'
              : `权限检查失败：${error.message}`)
            setState('setup')
          }
          return
        }

        if(alive)setState(data===true?'ready':'locked')
      }catch(error:any){
        if(alive){
          setMessage(`设备初始化失败：${error?.message||'未知错误'}`)
          setState('setup')
        }
      }
    }

    const timer = window.setTimeout(()=>{
      if(alive && state==='loading'){
        setMessage('设备确认超时，请点下面按钮重试。')
        setState('setup')
      }
    },10000)

    void prepare()
    return()=>{alive=false;window.clearTimeout(timer)}
  },[supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function unlock(e:FormEvent){
    e.preventDefault()
    if(!passphrase.trim())return
    setBusy(true)
    setMessage('正在验证私人访问口令…')

    const {data,error} = await supabase.rpc('h17_unlock_workspace',{p_passphrase:passphrase.trim()})
    setBusy(false)

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
    setState('ready')
  }

  if(state==='ready'){
    return <div className="h17PrivateReady">
      <div className="h17PrivateBadge"><ShieldCheck size={15}/> 私人模式 · 此设备已授权</div>
      <TravelOS/>
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
