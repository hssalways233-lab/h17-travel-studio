'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}

export default function V2Corrections(){
  useEffect(()=>{
    const supabase=createClient()

    function applyWorkspaceLabel(){
      document.querySelectorAll('.osSidebar nav button,.osMobileNav button').forEach(btn=>{
        const span=btn.querySelector('span')
        if(span?.textContent?.trim()==='今天') span.textContent='工作台'
      })
      const active=[...document.querySelectorAll('.osSidebar nav button,.osMobileNav button')].find(btn=>btn.classList.contains('active'))
      if(active?.textContent?.includes('工作台')){
        const h1=document.querySelector('.osTopbar h1')
        const eyebrow=document.querySelector('.osTopbar .osEyebrow')
        if(h1)h1.textContent='工作台'
        if(eyebrow)eyebrow.textContent='WORKSPACE'
      }
    }

    function closeReview(){document.querySelector('.osReviewOverlay')?.remove()}

    async function openReview(row:HTMLElement){
      closeReview()
      const title=row.querySelector('b')?.textContent?.trim()||''
      const destination=row.querySelector('div>span')?.textContent?.trim()||''
      if(!title)return

      const {data:post,error}=await supabase.from('posts')
        .select('id,title,destination,xhs_url,published_at')
        .eq('title',title).eq('destination',destination).limit(1).maybeSingle()
      if(error||!post){
        alert('没有找到这篇已发布内容的记录，请刷新后再试。')
        return
      }
      const {data:summary}=await supabase.from('post_summary').select('*').eq('id',post.id).limit(1).maybeSingle()
      const values={
        views:Number(summary?.views||0),likes:Number(summary?.likes||0),saves:Number(summary?.saves||0),
        comments:Number(summary?.comments||0),shares:0,follows:Number(summary?.follows||0)
      }

      const overlay=document.createElement('div')
      overlay.className='osReviewOverlay'
      overlay.innerHTML=`
        <section class="osReviewSheet">
          <div class="osReviewHead">
            <div><small>DATA REVIEW</small><h2>${esc(title)}</h2><p>${esc(destination)} · 不跳页面，直接在这里完成复盘</p></div>
            <button class="osReviewClose" aria-label="关闭">×</button>
          </div>
          <div class="osReviewMetrics">
            ${[['views','浏览'],['likes','点赞'],['saves','收藏'],['comments','评论'],['shares','分享'],['follows','涨粉']].map(([k,label])=>`<label><span>${label}</span><input inputmode="numeric" data-key="${k}" value="${(values as any)[k]}"></label>`).join('')}
          </div>
          <div class="osReviewInsight">
            <div><span>收藏率</span><b data-save-rate>—</b></div>
            <div><span>互动率</span><b data-engagement>—</b></div>
            <div><span>系统判断</span><b data-judgement>继续观察</b></div>
          </div>
          <div class="osReviewActions">
            ${post.xhs_url?`<a href="${esc(post.xhs_url)}" target="_blank" rel="noreferrer">打开小红书</a>`:''}
            <button class="osReviewSave">保存本次数据快照</button>
          </div>
        </section>`
      document.body.appendChild(overlay)

      const recalc=()=>{
        const get=(k:string)=>Number((overlay.querySelector(`input[data-key="${k}"]`) as HTMLInputElement)?.value||0)||0
        const views=get('views'),likes=get('likes'),saves=get('saves'),comments=get('comments')
        const saveRate=views?saves/views*100:0
        const engagement=views?(likes+saves+comments)/views*100:0
        const sr=overlay.querySelector('[data-save-rate]');if(sr)sr.textContent=views?saveRate.toFixed(1)+'%':'—'
        const er=overlay.querySelector('[data-engagement]');if(er)er.textContent=views?engagement.toFixed(1)+'%':'—'
        const judge=overlay.querySelector('[data-judgement]');if(judge)judge.textContent=views>3000||saves>50?'值得继续扩写':'继续观察'
      }
      overlay.querySelectorAll('input').forEach(i=>i.addEventListener('input',recalc));recalc()
      overlay.querySelector('.osReviewClose')?.addEventListener('click',closeReview)
      overlay.addEventListener('click',e=>{if(e.target===overlay)closeReview()})
      overlay.querySelector('.osReviewSave')?.addEventListener('click',async()=>{
        const {data:{user}}=await supabase.auth.getUser();if(!user)return alert('请先登录')
        const get=(k:string)=>Number((overlay.querySelector(`input[data-key="${k}"]`) as HTMLInputElement)?.value||0)||0
        const button=overlay.querySelector('.osReviewSave') as HTMLButtonElement
        button.disabled=true;button.textContent='保存中…'
        const {error:saveError}=await supabase.from('post_metrics').insert({
          user_id:user.id,post_id:post.id,views:get('views'),likes:get('likes'),saves:get('saves'),comments:get('comments'),shares:get('shares'),follows:get('follows')
        })
        if(saveError){button.disabled=false;button.textContent='保存本次数据快照';alert(saveError.message);return}
        button.textContent='已保存 ✓'
        setTimeout(()=>{closeReview();(document.querySelector('.osIconBtn') as HTMLButtonElement|null)?.click()},550)
      })
    }

    const onClick=(e:MouseEvent)=>{
      const target=e.target as HTMLElement
      const reviewBtn=target.closest('.osAnalytics .osRankRow > button') as HTMLElement|null
      if(reviewBtn){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()
        const row=reviewBtn.closest('.osRankRow') as HTMLElement|null
        if(row)void openReview(row)
        return
      }
      if(target.closest('.osSidebar nav button,.osMobileNav button'))setTimeout(applyWorkspaceLabel,0)
    }

    applyWorkspaceLabel()
    document.addEventListener('click',onClick,true)
    return()=>{document.removeEventListener('click',onClick,true);closeReview()}
  },[])
  return null
}
