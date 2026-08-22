'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, ChevronRight } from 'lucide-react'

export default function FinalPackLauncher(){
  const [mount,setMount]=useState<Element|null>(null)
  const [ready,setReady]=useState(false)

  useEffect(()=>{
    let alive=true
    const sync=()=>{
      if(!alive)return
      const shell=document.querySelector('.osContentShell')
      const head=shell?.querySelector('.osContentHead')
      if(shell&&head){
        let target=shell.querySelector(':scope > .h17FinalPackLauncherMount')
        if(!target){
          target=document.createElement('div')
          target.className='h17FinalPackLauncherMount'
          head.insertAdjacentElement('afterend',target)
        }
        setMount(target)
      }else setMount(null)
      setReady(Boolean(document.querySelector('.h17FinalPackBtn')))
    }
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true})
    const timer=window.setInterval(sync,800)
    return()=>{alive=false;observer.disconnect();window.clearInterval(timer)}
  },[])

  function launch(){
    const hidden=document.querySelector('.h17FinalPackBtn') as HTMLButtonElement|null
    if(hidden){hidden.click();return}
    // give the existing pack component one more render tick before surfacing an error
    window.setTimeout(()=>{
      const retry=document.querySelector('.h17FinalPackBtn') as HTMLButtonElement|null
      if(retry)retry.click()
      else alert('最终发布包模块还没有就绪，请刷新一次页面后重试。')
    },250)
  }

  if(!mount)return null

  return <>
    {createPortal(<section className="h17FinalPackLauncher">
      <div className="h17FinalPackLauncherIcon"><Sparkles size={18}/></div>
      <div className="h17FinalPackLauncherCopy">
        <span>FINAL PUBLISH PACK</span>
        <b>直接生成这篇的小红书最终发布包</b>
        <p>读取当前内容的真实原图 → 自动选片、排序、识别路线/费用、决定哪些图加字，并生成限字标题、正文和标签。</p>
      </div>
      <button onClick={launch} disabled={!ready}><span>{ready?'生成最终发布包':'正在准备…'}</span><ChevronRight size={17}/></button>
    </section>,mount)}
    <style>{`
      .h17FinalPackLauncherMount{width:100%}
      .h17FinalPackLauncher{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;background:linear-gradient(135deg,#eef8f5 0%,#fffaf1 100%);border:1px solid #d4e5df;border-radius:16px;padding:14px 15px;box-shadow:0 8px 24px rgba(35,61,57,.05)}
      .h17FinalPackLauncherIcon{width:38px;height:38px;border-radius:12px;background:#dff0ec;color:#276e70;display:grid;place-items:center}
      .h17FinalPackLauncherCopy{min-width:0;display:grid;gap:3px}.h17FinalPackLauncherCopy>span{font-size:9px;letter-spacing:.17em;font-weight:900;color:#2f7b80}.h17FinalPackLauncherCopy>b{font-size:15px;color:#202522}.h17FinalPackLauncherCopy>p{margin:0;color:#77807b;font-size:11px;line-height:1.55}
      .h17FinalPackLauncher>button{border:0;border-radius:12px;background:#2f7b80;color:white;padding:11px 14px;font-weight:800;display:flex;align-items:center;gap:7px;white-space:nowrap;cursor:pointer}.h17FinalPackLauncher>button:disabled{opacity:.55;cursor:default}
      /* hide the old cramped launcher so there is only one obvious entry */
      .osContentHead>.h17FinalPackBtn{display:none!important}
      @media(max-width:720px){.h17FinalPackLauncher{grid-template-columns:auto 1fr;padding:12px;gap:10px}.h17FinalPackLauncherIcon{width:34px;height:34px}.h17FinalPackLauncherCopy>b{font-size:14px}.h17FinalPackLauncherCopy>p{font-size:10px}.h17FinalPackLauncher>button{grid-column:1/-1;width:100%;justify-content:center}.h17FinalPackLauncherCopy>span{font-size:8px}}
    `}</style>
  </>
}
