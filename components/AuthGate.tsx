'use client'

import { useEffect, useMemo, useState } from 'react'
import TravelOS from '@/components/TravelOS'
import { createClient } from '@/lib/supabase/client'

export default function AuthGate(){
  const supabase = useMemo(()=>createClient(),[])
  const [ready,setReady] = useState(false)
  const [message,setMessage] = useState('正在确认登录状态…')

  useEffect(()=>{
    let mounted = true

    async function bootstrap(){
      try{
        const url = new URL(window.location.href)
        const hash = new URLSearchParams(url.hash.replace(/^#/,''))
        const accessToken = hash.get('access_token') || url.searchParams.get('access_token')
        const refreshToken = hash.get('refresh_token') || url.searchParams.get('refresh_token')
        const code = url.searchParams.get('code')
        const tokenHash = url.searchParams.get('token_hash')
        const type = url.searchParams.get('type')

        if(accessToken && refreshToken){
          setMessage('正在完成手机登录…')
          const {error} = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if(error) throw error
          window.history.replaceState({},'',url.pathname)
        }else if(tokenHash){
          setMessage('正在验证登录链接…')
          const {error} = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type || 'email') as 'email'|'magiclink'|'signup'|'recovery'|'invite'|'email_change'|'sms'|'phone_change',
          })
          if(error) throw error
          window.history.replaceState({},'',url.pathname)
        }else if(code){
          setMessage('正在完成安全登录…')
          const {error} = await supabase.auth.exchangeCodeForSession(code)
          if(error) throw error
          window.history.replaceState({},'',url.pathname)
        }

        // Give the auth client one tick to persist localStorage before TravelOS mounts.
        await new Promise(resolve=>setTimeout(resolve,120))
        const {data:{session}} = await supabase.auth.getSession()
        if(session?.user){ setMessage('登录成功，正在进入工作台…') }
      }catch(error){
        console.error('H17 auth bootstrap failed',error)
        setMessage('登录链接未能完成，请从工作台重新发送一封登录邮件。')
        await new Promise(resolve=>setTimeout(resolve,900))
      }finally{
        if(mounted) setReady(true)
      }
    }

    void bootstrap()
    return()=>{mounted=false}
  },[supabase])

  if(!ready){
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f6f2ea',color:'#1f2927',fontFamily:'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'}}>
      <div style={{textAlign:'center',padding:32}}>
        <div style={{fontSize:28,fontWeight:800,marginBottom:12}}>禾十七</div>
        <div style={{fontSize:15,color:'#64716d'}}>{message}</div>
      </div>
    </main>
  }

  return <TravelOS/>
}
