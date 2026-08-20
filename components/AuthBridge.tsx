'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(()=>{
    function capture(e:MouseEvent){
      const el=e.target as HTMLElement|null
      const btn=el?.closest('button') as HTMLButtonElement|null
      if(!btn)return
      const text=(btn.textContent||'').trim()
      if(text==='邮箱登录'||text.includes('邮箱登录')){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()
        setMessage('')
        setLoginOpen(true)
      }
    }
    document.addEventListener('click',capture,true)
    return()=>document.removeEventListener('click',capture,true)
  },[])

  async function login(){
    if(!email.trim()||!password)return setMessage('请输入邮箱和手机登录码')
    setBusy(true);setMessage('')
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
    setBusy(false)
    if(error){
      if(/invalid login credentials/i.test(error.message))setMessage('邮箱或登录码不正确。请在已登录的电脑端重新生成一次“手机登录码”。')
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
    {sessionEmail&&<button onClick={()=>{setMessage('');setDeviceCode('');setSetupOpen(true)}} style={styles.setupButton}>手机登录设置</button>}

    {(loginOpen||setupOpen)&&<div style={styles.backdrop} onClick={()=>{setLoginOpen(false);setSetupOpen(false)}}>
      <div style={styles.modal} onClick={e=>e.stopPropagation()}>
        <button style={styles.close} onClick={()=>{setLoginOpen(false);setSetupOpen(false)}}>×</button>
        {loginOpen?<>
          <div style={styles.eyebrow}>DEVICE LOGIN</div>
          <h2 style={styles.title}>手机直接登录</h2>
          <p style={styles.desc}>这次不再发送邮件。手机用“邮箱 + 手机登录码”直接登录，之后会保持登录并与电脑实时同步。</p>
          <label style={styles.label}>邮箱</label>
          <input style={styles.input} inputMode="email" autoCapitalize="none" value={email} onChange={e=>setEmail(e.target.value)} placeholder="你的登录邮箱"/>
          <label style={styles.label}>手机登录码</label>
          <input style={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="例如 H17-XXXXXXXXXX" onKeyDown={e=>{if(e.key==='Enter')void login()}}/>
          {message&&<div style={styles.error}>{message}</div>}
          <button style={styles.primary} disabled={busy} onClick={()=>void login()}>{busy?'登录中…':'登录并同步'}</button>
          <p style={styles.tip}>第一次使用：在当前已经登录成功的电脑端，点击左下角“手机登录设置” → “生成手机登录码”。只做一次。</p>
        </>:<>
          <div style={styles.eyebrow}>ONE-TIME SETUP</div>
          <h2 style={styles.title}>生成手机登录码</h2>
          <p style={styles.desc}>当前账号：{sessionEmail}<br/>生成后，手机以后直接登录，不再经过 QQ 邮箱，不再触发 email rate limit。</p>
          {!deviceCode?<button style={styles.primary} disabled={busy} onClick={()=>void generateDeviceCode()}>{busy?'正在生成…':'一键生成手机登录码'}</button>:<>
            <div style={styles.codeBox}>{deviceCode}</div>
            <button style={styles.primary} onClick={()=>void copyCode()}>复制登录码</button>
          </>}
          {message&&<div style={styles.info}>{message}</div>}
          <p style={styles.tip}>生成新登录码会替换旧登录码。电脑端不会退出；手机端刷新网站，点“邮箱登录”后输入邮箱和这个登录码即可。</p>
        </>}
      </div>
    </div>}

    {message&&!loginOpen&&!setupOpen&&<div style={styles.toast}>{message}</div>}
  </>
}

const styles:{[k:string]:React.CSSProperties}={
  setupButton:{position:'fixed',left:18,bottom:18,zIndex:80,border:'1px solid #c7d9d6',background:'#eef7f5',color:'#266f72',borderRadius:14,padding:'10px 14px',fontSize:13,fontWeight:700,boxShadow:'0 8px 30px rgba(25,35,30,.08)'},
  backdrop:{position:'fixed',inset:0,zIndex:9999,background:'rgba(28,31,29,.48)',display:'flex',alignItems:'center',justifyContent:'center',padding:18},
  modal:{position:'relative',width:'min(440px,100%)',background:'#fffdf8',border:'1px solid #dfd8cb',borderRadius:26,padding:'30px 24px 24px',boxShadow:'0 30px 90px rgba(0,0,0,.22)',fontFamily:'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'},
  close:{position:'absolute',right:16,top:14,border:0,background:'#f2eee5',width:36,height:36,borderRadius:18,fontSize:24,lineHeight:'30px',cursor:'pointer'},
  eyebrow:{fontSize:12,fontWeight:800,letterSpacing:3,color:'#2f7d80',marginBottom:8},
  title:{fontSize:28,lineHeight:1.2,margin:'0 0 10px',color:'#202522'},
  desc:{fontSize:14,lineHeight:1.7,color:'#68706c',margin:'0 0 20px'},
  label:{display:'block',fontSize:13,fontWeight:700,color:'#4f5753',margin:'12px 0 7px'},
  input:{width:'100%',boxSizing:'border-box',border:'1px solid #d8d2c7',borderRadius:14,padding:'14px 15px',fontSize:16,outline:'none',background:'#fff'},
  primary:{width:'100%',border:0,borderRadius:15,padding:'14px 16px',marginTop:16,background:'#2f7d80',color:'#fff',fontSize:16,fontWeight:800,cursor:'pointer'},
  codeBox:{marginTop:16,padding:'18px 16px',borderRadius:16,background:'#edf6f4',border:'1px solid #c8ded9',fontSize:23,fontWeight:800,letterSpacing:1.4,textAlign:'center',color:'#205f62',wordBreak:'break-all'},
  error:{marginTop:12,padding:'10px 12px',borderRadius:12,background:'#fff1ef',color:'#a44438',fontSize:13,lineHeight:1.5},
  info:{marginTop:12,padding:'10px 12px',borderRadius:12,background:'#edf6f4',color:'#28696b',fontSize:13,lineHeight:1.5},
  tip:{fontSize:12,lineHeight:1.65,color:'#7c827e',margin:'14px 2px 0'},
  toast:{position:'fixed',left:'50%',bottom:90,transform:'translateX(-50%)',zIndex:9998,maxWidth:'88vw',background:'#222826',color:'#fff',padding:'12px 16px',borderRadius:14,fontSize:13,boxShadow:'0 12px 40px rgba(0,0,0,.22)'}
}
