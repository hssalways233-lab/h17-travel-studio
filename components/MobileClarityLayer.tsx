'use client'

import { useEffect } from 'react'

export default function MobileClarityLayer(){
  useEffect(()=>{
    let active=true

    function enhance(){
      if(!active||!window.matchMedia('(max-width:720px)').matches)return

      document.querySelectorAll('.h17MobileTopicSheet .h17MobileSmartCard').forEach(card=>{
        const el=card as HTMLElement
        if(el.dataset.mobileFold==='1')return
        el.dataset.mobileFold='1'
        el.classList.add('h17MobileCollapsible')
        const head=el.querySelector('.h17MobileSectionTitle') as HTMLElement|null
        if(!head)return
        head.classList.add('h17MobileFoldHead')
        head.setAttribute('role','button')
        head.setAttribute('tabindex','0')
        head.setAttribute('aria-expanded','false')
        const label=document.createElement('span')
        label.className='h17MobileFoldLabel'
        label.textContent='展开'
        head.appendChild(label)
        const toggle=()=>{
          const expanded=el.classList.toggle('expanded')
          head.setAttribute('aria-expanded',expanded?'true':'false')
          label.textContent=expanded?'收起':'展开'
        }
        head.addEventListener('click',toggle)
        head.addEventListener('keydown',(event)=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}
        })
      })
    }

    enhance()
    const observer=new MutationObserver(enhance)
    observer.observe(document.body,{childList:true,subtree:true})
    window.addEventListener('resize',enhance)
    return()=>{active=false;observer.disconnect();window.removeEventListener('resize',enhance)}
  },[])

  return <style>{`
    @media(max-width:720px){
      /* 手机端只保留当前任务，移除两个长期悬浮层 */
      .h17SmartFab,
      .h17StrategyDock{display:none!important}

      /* 上传/保存反馈改成顶部短暂提示，不再压住底部导航 */
      .osSmartToast{
        position:fixed!important;
        left:14px!important;right:14px!important;
        top:calc(72px + env(safe-area-inset-top))!important;
        bottom:auto!important;
        width:auto!important;max-width:none!important;
        z-index:490!important;
        border-radius:12px!important;
        padding:10px 12px!important;
        font-size:11px!important;
        box-shadow:0 10px 28px rgba(30,45,40,.14)!important;
        animation:h17MobileToastOut 4.2s ease forwards;
      }
      .osSmartToast button{display:none!important}
      @keyframes h17MobileToastOut{0%,76%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-8px);pointer-events:none}}

      /* 顶部私人状态再轻一点 */
      .h17MobilePrivateStatus{padding:8px 14px 9px!important;gap:8px!important}
      .h17MobilePrivateIcon{width:28px!important;height:28px!important;border-radius:9px!important}
      .h17MobilePrivateCopy b{font-size:11px!important}
      .h17MobilePrivateCopy span{font-size:9px!important}

      /* 内容页阶段在手机只保留素材/图文/发布，数据统一从底部“数据”进入 */
      .osStepTabs{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;overflow:visible!important}
      .osStepTabs>button:nth-child(4){display:none!important}

      /* 内容标题卡更紧凑，减少首屏高度 */
      .osContentHead{gap:10px!important;padding:16px!important}
      .osContentHead h2{font-size:22px!important;line-height:1.28!important}
      .osContentHead p{margin-top:4px!important}
      .h17InlineTopicAdd{margin-top:8px!important}

      /* 手机上传弹层只聚焦上传，不让底部组件穿透视觉层 */
      .osMobileSheet{z-index:500!important}
      .osMobilePanel{padding-bottom:calc(22px + env(safe-area-inset-bottom))!important}
      .osMobilePanel label{font-size:11px!important}
      .osMobilePanel select{font-size:12px!important;line-height:1.35!important;max-height:44px!important}

      /* 选题详情：上传保持展开；图1建议与发布稿默认收起 */
      .h17MobileTopicSheet{padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}
      .h17MobileNext{padding:12px 13px!important}
      .h17MobileNext>b{font-size:16px!important}
      .h17MobileNext>p{margin-bottom:6px!important}
      .h17MobileUploadCard{padding:13px!important}
      .h17MobilePhotoHint{margin-top:8px!important}
      .h17MobilePhotoHint span{padding:4px 6px!important}
      .h17MobileCollapsible{padding:0!important;overflow:hidden!important}
      .h17MobileCollapsible:not(.expanded)>:not(.h17MobileSectionTitle){display:none!important}
      .h17MobileCollapsible.expanded{padding:13px!important}
      .h17MobileCollapsible>.h17MobileSectionTitle{padding:13px!important;margin:0!important;cursor:pointer!important}
      .h17MobileCollapsible.expanded>.h17MobileSectionTitle{padding:0 0 8px!important}
      .h17MobileFoldHead{position:relative;padding-right:48px!important}
      .h17MobileFoldLabel{position:absolute;right:13px;top:50%;transform:translateY(-50%);font-size:10px!important;color:#2f7b80!important;background:#edf6f3;padding:5px 7px;border-radius:999px;white-space:nowrap}
      .h17MobileCollapsible.expanded .h17MobileFoldLabel{right:0}

      /* 素材区的上传成功状态留在内容本身，不再需要底部大提示 */
      .osMediaWorkspace{padding-bottom:24px!important}
      .osUpload{min-height:150px!important}

      /* 给底部导航留足空间，任何内容不再压在导航上 */
      .travelOS main,.osMain{padding-bottom:96px!important}
    }
  `}</style>
}
