'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type LoginMode='email'|'code'

function makeDeviceCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes=new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return 'H17-'+Array.from(bytes,b=>alphabet[b%alphabet.length]).join('')
}

export default function AuthBridge(){
  const supabase=useMemo(()=>createClient(),[])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [deviceCode,setDeviceCode]=useState('')
  const [sessionEmail,setSessionEmail]=useState<string|null>(null)
  const [loginOpen,setLoginOpen]=useState(false)
  const [setupOpen,setSetupOpen]=useState(false)
  const [mode,setMode]=useState<LoginMode>('email')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{
    let alive=true
    supabase.auth.getSession().then(({data})=>{
      if(!alive)return
      const e=data.session?.user.email||null
      setSessionEmail(e)
      if(e)setEmail(e)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const e=session?.user.email||null
      setSessionEmail(e)
      if(e)setEmail(e)
    })
    return()=>{alive=false;subscription.unsubscribe()}
  },[supabase])

  function defaultMode():LoginMode{
    if(typeof navigator==='undefined')return 'email'
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?'code':'email'
  }

  useEffect(()=>{
    function capture(e:MouseEvent){
      const el=e.target as HTMLElement|null
      const btn=el?.closest('button') as HTMLButtonElement|null
      if(!btn)return
      const text=(btn.textContent||'').trim()
      if(text==='邮箱登录'||text.includes('邮箱登录')){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()
        setMessage('');setPassword('');setMode(defaultMode());setLoginOpen(true)
      }
    }
    document.addEventListener('click',capture,true)
    return()=>document.removeEventListener('click',capture,true)
  },[])

  async function sendMagicLink(){
    if(!email.trim())return setMessage('请输入登录邮箱')
    setBusy(true);setMessage('')
    const {error}=await supabase.auth.signInWithOtp({
      email:email.trim(),
      options:{emailRedirectTo:window.location.origin}
    })
    setBusy(false)
    if(error){
      if(/rate limit/i.test(error.message))setMessage('登录邮件发送过于频繁，请稍后再试一次。不要连续点击。')
      else setMessage(error.message)
      return
    }
    setMessage('登录邮件已发送。请打开最新一封邮件完成登录；成功后电脑端右上角会出现“生成手机登录码”。')
  }

  async function loginWithCode(){
    if(!email.trim()||!password)return setMessage('请输入邮箱和手机登录码')
    setBusy(true);setMessage('')
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
    setBusy(false)
    if(error){
      if(/invalid login credentials/i.test(error.message))setMessage('邮箱或手机登录码不正确。如果你还没生成过登录码，请先用“首次/电脑登录”完成一次邮箱登录。')
      else setMessage(error.message)
      return
    }
    setLoginOpen(false);setPassword('');setMessage('登录成功，正在同步…')
    setTimeout(()=>location.reload(),300)
  }

  async function generateDeviceCode(){
    const code=makeDeviceCode()
    setBusy(true);setMessage('')
    const {error}=await supabase.auth.updateUser({password:code})
    setBusy(false)
    if(error){setMessage(error.message);return}
    setDeviceCode(code)
  }

  async function copyCode(){
    if(!deviceCode)return
    await navigator.clipboard.writeText(deviceCode)
    setMessage('登录码已复制。手机端输入同一个邮箱 + 这个登录码即可。')
  }

  return <>
    {sessionEmail&&<button onClick={()=>{setMessage('');setDeviceCode('');setSetupOpen(true)}} style={styles.setupButton}>生成手机登录码</button>}

    {(loginOpen||setupOpen)&&<div style={styles.backdrop} onClick={()=>{setLoginOpen(false);setSetupOpen(false)}}>
      <div style={styles.modal} onClick={e=>e.stopPropagation()}>
        <button style={styles.close} onClick={()=>{setLoginOpen(false);setSetupOpen(false)}}>×</button>

        {loginOpen?<>
          <div style={styles.eyebrow}>SIGN IN</div>
          <h2 style={styles.title}>登录与同步</h2>
          <p style={styles.desc}>第一次在电脑登录，用邮箱完成一次验证；之后手机直接用“邮箱 + 手机登录码”，不再反复收邮件。</p>

          <div style={styles.tabs}>
            <button style={{...styles.tab,...(mode==='email'?styles.tabActive:{})}} onClick={()=>{setMode('email');setMessage('')}}>首次 / 电脑登录</button>
            <button style={{...styles.tab,...(mode==='code'?styles.tabActive:{})}} onClick={()=>{setMode('code');setMessage('')}}>手机快捷登录</button>
          </div>

          <label style={styles.label}>邮箱</label>
          <input style={styles.input} inputMode="email" autoCapitalize="none" value={email} onChange={e=>setEmail(e.target.value)} placeholder="你的登录邮箱"/>

          {mode==='email'?<>
            <div style={styles.infoBox}>现在这台电脑还没有登录状态，所以先用邮箱完成一次登录。登录成功后，右上角才会出现“生成手机登录码”。</div>
            {message&&<div style={message.includes('已发送')?styles.info:styles.error}>{message}</div>}
            <button style={styles.primary} disabled={busy} onClick={()=>void sendMagicLink()}>{busy?'发送中…':'发送登录邮件'}</button>
            <p style={styles.tip}>只点一次。打开最新收到的邮件完成登录即可。</p>
          </>:<>
            <label style={styles.label}>手机登录码</label>
            <input style={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="例如 H17-XXXXXXXXXX" onKeyDown={e=>{if(e.key==='Enter')void loginWithCode()}}/>
            {message&&<div style={styles.error}>{message}</div>}
            <button style={styles.primary} disabled={busy} onClick={()=>void loginWithCode()}>{busy?'登录中…':'登录并同步'}</button>
            <p style={styles.tip}>只有在电脑已经登录、并生成过手机登录码之后才使用这一项。</p>
          </>}
        </>:<>
          <div style={styles.eyebrow}>ONE-TIME SETUP</div>
          <h2 style={styles.title}>生成手机登录码</h2>
          <p style={styles.desc}>当前账号：{sessionEmail}<br/>生成后，手机以后直接登录，不再经过 QQ 邮箱，也不会再遇到邮件频率限制。</p>
          {!deviceCode?<button style={styles.primary} disabled={busy} onClick={()=>void generateDeviceCode()}>{busy?'正在生成…':'一键生成手机登录码'}</button>:<>
            <div style={styles.codeBox}>{deviceCode}</div>
            <button style={styles.primary} onClick={()=>void copyCode()}>复制登录码</button>
          </>}
          {message&&<div style={styles.info}>{message}</div>}
          <p style={styles.tip}>生成新登录码会替换旧登录码。电脑端不会退出；手机端刷新网站，点“邮箱登录”→“手机快捷登录”即可。</p>
        </>}
      </div>
    </div>}

    {message&&!loginOpen&&!setupOpen&&<div style={styles.toast}>{message}</div>}
  </>
}

const styles:{[k:string]:React.CSSProperties}={
  setupButton:{position:'fixed',right:22,top:18,zIndex:9000,border:'1px solid #bcd8d3',background:'#eaf6f4',color:'#226b6e',borderRadius:14,padding:'11px 16px',fontSize:14,fontWeight:800,boxShadow:'0 10px 34px rgba(25,35,30,.12)',cursor:'pointer'},
  backdrop:{position:'fixed',inset:0,zIndex:9999,background:'rgba(28,31,29,.48)',display:'flex',alignItems:'center',justifyContent:'center',padding:18},
  modal:{position:'relative',width:'min(460px,100%)',background:'#fffdf8',border:'1px solid #dfd8cb',borderRadius:26,padding:'30px 24px 24px',boxShadow:'0 30px 90px rgba(0,0,0,.22)',fontFamily:'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'},
  close:{position:'absolute',right:16,top:14,border:0,background:'#f2eee5',width:36,height:36,borderRadius:18,fontSize:24,lineHeight:'30px',cursor:'pointer'},
  eyebrow:{fontSize:12,fontWeight:800,letterSpacing:3,color:'#2f7d80',marginBottom:8},
  title:{fontSize:28,lineHeight:1.2,margin:'0 0 10px',color:'#202522'},
  desc:{fontSize:14,lineHeight:1.7,color:'#68706c',margin:'0 0 18px'},
  tabs:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,padding:5,background:'#f1ede5',borderRadius:14,marginBottom:18},
  tab:{border:0,background:'transparent',borderRadius:10,padding:'10px 8px',fontSize:13,fontWeight:800,color:'#68706c',cursor:'pointer'},
  tabActive:{background:'#fff',color:'#236b6e',boxShadow:'0 2px 10px rgba(0,0,0,.06)'},
  label:{display:'block',fontSize:13,fontWeight:700,color:'#4f5753',margin:'12px 0 7px'},
  input:{width:'100%',boxSizing:'border-box',border:'1px solid #d8d2c7',borderRadius:14,padding:'14px 15px',fontSize:16,outline:'none',background:'#fff'},
  primary:{width:'100%',border:0,borderRadius:15,padding:'14px 16px',marginTop:16,background:'#2f7d80',color:'#fff',fontSize:16,fontWeight:800,cursor:'pointer'},
  codeBox:{marginTop:16,padding:'18px 16px',borderRadius:16,background:'#edf6f4',border:'1px solid #c8ded9',fontSize:23,fontWeight:800,letterSpacing:1.4,textAlign:'center',color:'#205f62',wordBreak:'break-all'},
  infoBox:{marginTop:14,padding:'12px 13px',borderRadius:12,background:'#f4f1ea',color:'#626a66',fontSize:13,lineHeight:1.65},
  error:{marginTop:12,padding:'10px 12px',borderRadius:12,background:'#fff1ef',color:'#a44438',fontSize:13,lineHeight:1.5},
  info:{marginTop:12,padding:'10px 12px',borderRadius:12,background:'#edf6f4',color:'#28696b',fontSize:13,lineHeight:1.5},
  tip:{fontSize:12,lineHeight:1.65,color:'#7c827e',margin:'14px 2px 0'},
  toast:{position:'fixed',left:'50%',bottom:90,transform:'translateX(-50%)',zIndex:9998,maxWidth:'88vw',background:'#222826',color:'#fff',padding:'12px 16px',borderRadius:14,fontSize:13,boxShadow:'0 12px 40px rgba(0,0,0,.22)'}
}
