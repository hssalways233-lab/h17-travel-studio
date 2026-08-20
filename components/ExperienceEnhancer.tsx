'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type TopicRow={id:string;title:string;destination:string;content_type:string;status:string;planned_at?:string|null}
type DestRow={id?:string;name:string;material_count?:number;idea_count?:number}

function mondayISO(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d.toISOString()}
function safeName(name:string){const ext=name.includes('.')?'.'+name.split('.').pop():'';const base=name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48)||'image';return `${base}${ext.toLowerCase()}`}

export default function ExperienceEnhancer(){
  useEffect(()=>{
    const supabase=createClient()
    let disposed=false
    let topics:TopicRow[]=[]
    let destinations:DestRow[]=[]
    let uploadInput:HTMLInputElement|null=null
    let uploadSheet:HTMLElement|null=null

    const isDashboard=()=>[...document.querySelectorAll('nav button,.mobileMenu button')].some(el=>el.classList.contains('active')&&el.textContent?.includes('工作台'))
    const findNav=(label:string)=>[...document.querySelectorAll('nav button,.mobileMenu button')].find(el=>el.textContent?.includes(label)) as HTMLButtonElement|undefined

    async function refreshCache(){
      const [{data:t},{data:d}]=await Promise.all([
        supabase.from('topics').select('id,title,destination,content_type,status,planned_at').order('created_at',{ascending:false}),
        supabase.from('destination_summary').select('name,material_count,idea_count').order('idea_count',{ascending:false})
      ])
      topics=(t||[]) as TopicRow[];destinations=(d||[]) as DestRow[]
    }

    function openProduction(title:string){
      localStorage.setItem('h17-pending-topic',title)
      findNav('内容制作')?.click()
      let tries=0
      const timer=setInterval(()=>{
        tries++
        const select=document.querySelector('.workflowBar select') as HTMLSelectElement|null
        if(select){
          const option=[...select.options].find(o=>o.textContent?.includes(title))
          if(option){
            select.value=option.value
            select.dispatchEvent(new Event('change',{bubbles:true}))
            localStorage.removeItem('h17-pending-topic')
            clearInterval(timer)
            return
          }
        }
        if(tries>30) clearInterval(timer)
      },100)
    }

    function renderDashboard(){
      if(!isDashboard()) return
      const main=document.querySelector('main')
      if(!main) return
      document.querySelector('.smartDashboardBoard')?.remove()
      const week=new Date(mondayISO())
      const doing=topics.filter(t=>['doing','ready'].includes(t.status)).slice(0,2)
      const weekly=topics.filter(t=>t.status==='idea'&&t.planned_at&&new Date(t.planned_at)>=week).slice(0,4)
      const fallback=topics.filter(t=>t.status==='idea').slice(0,4)
      const candidates=weekly.length?weekly:fallback
      const dests=destinations.slice(0,4)
      const board=document.createElement('section')
      board.className='smartDashboardBoard'
      const cards=(items:TopicRow[])=>items.map(t=>`<button class="smartExecCard" data-smart-topic="${t.title.replace(/"/g,'&quot;')}"><b>${t.title}</b><span>${t.destination} · ${t.content_type}</span></button>`).join('')||'<div class="smartEmptyState">暂无内容</div>'
      board.innerHTML=`<div class="smartBoardCol"><div class="smartBoardHead"><b>本周执行</b><span>只保留最重要的 2 篇</span></div>${cards(doing)}</div><div class="smartBoardCol"><div class="smartBoardHead"><b>候选池</b><span>本周自动生成，挑最值得做的</span></div>${cards(candidates)}</div><div class="smartBoardCol"><div class="smartBoardHead"><b>素材待开发</b><span>按已有旅行资产继续拆内容</span></div>${dests.map(d=>`<button class="smartDestBrief" data-dest="${d.name.replace(/"/g,'&quot;')}"><b>${d.name}</b><span>${d.material_count||0} 素材 · ${d.idea_count||0} 待开发</span></button>`).join('')||'<div class="smartEmptyState">先上传旅行素材</div>'}</div>`
      const feature=main.querySelector('.feature')
      if(feature) feature.insertAdjacentElement('afterend',board); else main.appendChild(board)
      const kanban=main.querySelector('.kanban') as HTMLElement|null;if(kanban)kanban.style.display='none'
      const accidental=main.querySelector('.smartTopicGroups') as HTMLElement|null;if(accidental)accidental.style.display='none'
    }

    function restoreNonDashboard(){
      if(isDashboard())return
      const kanban=document.querySelector('.kanban') as HTMLElement|null;if(kanban)kanban.style.display=''
      const accidental=document.querySelector('.smartTopicGroups') as HTMLElement|null;if(accidental)accidental.style.display=''
      document.querySelector('.smartDashboardBoard')?.remove()
    }

    function installDelegatedClicks(){
      document.addEventListener('click',e=>{
        const target=e.target as HTMLElement
        const card=target.closest('[data-smart-topic]') as HTMLElement|null
        if(card?.dataset.smartTopic){e.preventDefault();e.stopPropagation();openProduction(card.dataset.smartTopic);return}
        const grouped=target.closest('.topicChildren button[data-title]') as HTMLElement|null
        if(grouped?.dataset.title){e.preventDefault();e.stopPropagation();openProduction(grouped.dataset.title);return}
        const task=target.closest('.kanban .task') as HTMLElement|null
        if(task){const title=task.querySelector('strong')?.textContent?.trim();if(title){e.preventDefault();e.stopPropagation();openProduction(title);return}}
        const dest=target.closest('[data-dest]') as HTMLElement|null
        if(dest?.dataset.dest){findNav('旅行素材库')?.click()}
      },true)
    }

    async function uploadFiles(files:FileList){
      const select=uploadSheet?.querySelector('select') as HTMLSelectElement|null
      const topicId=select?.value||''
      const topic=topics.find(t=>t.id===topicId)
      const status=uploadSheet?.querySelector('.mobileUploadStatus') as HTMLElement|null
      if(!topic){if(status)status.textContent='请先选择一个选题';return}
      const {data:{user}}=await supabase.auth.getUser();if(!user){if(status)status.textContent='请先登录';return}
      const {data:dest}=await supabase.from('destinations').select('id').eq('name',topic.destination).limit(1).maybeSingle()
      const list=Array.from(files).filter(f=>f.type.startsWith('image/'))
      let ok=0
      for(let i=0;i<list.length;i++){
        const file=list[i];if(file.size>25*1024*1024)continue
        if(status)status.textContent=`正在上传 ${i+1}/${list.length}`
        const path=`${user.id}/${topicId}/${Date.now()}-${i}-${safeName(file.name)}`
        const up=await supabase.storage.from('travel-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
        if(up.error){if(status)status.textContent=`上传失败：${up.error.message}`;return}
        const db=await supabase.from('materials').insert({user_id:user.id,destination_id:dest?.id||null,storage_path:path,media_type:'image',tags:[`topic:${topicId}`,topic.destination],caption:file.name})
        if(db.error){await supabase.storage.from('travel-media').remove([path]);if(status)status.textContent=`保存失败：${db.error.message}`;return}
        ok++
      }
      if(status)status.textContent=`已上传 ${ok} 张，已同步云端`
      setTimeout(()=>uploadSheet?.classList.remove('open'),900)
    }

    function buildMobileUpload(){
      if(document.querySelector('.mobileUploadFab'))return
      const fab=document.createElement('button');fab.className='mobileUploadFab';fab.textContent='＋ 上传照片';document.body.appendChild(fab)
      uploadSheet=document.createElement('div');uploadSheet.className='mobileUploadSheet'
      uploadSheet.innerHTML=`<div class="mobileUploadPanel"><div class="mobileUploadHead"><div><small>MOBILE UPLOAD</small><b>从手机相册上传</b><span>上传后自动同步到电脑端</span></div><button class="mobileUploadClose">×</button></div><label>关联到选题<select></select></label><button class="mobileChoosePhotos">从相册选择照片</button><div class="mobileUploadStatus">支持一次多选多张</div><div class="mobilePwaTip">iPhone：Safari → 分享 → 添加到主屏幕，即可像 App 一样使用。</div></div>`
      document.body.appendChild(uploadSheet)
      uploadInput=document.createElement('input');uploadInput.type='file';uploadInput.accept='image/*';uploadInput.multiple=true;uploadInput.className='mobileHiddenInput';document.body.appendChild(uploadInput)
      const fill=()=>{const sel=uploadSheet?.querySelector('select');if(!sel)return;const groups=new Map<string,TopicRow[]>();topics.filter(t=>t.status!=='done').forEach(t=>{if(!groups.has(t.destination))groups.set(t.destination,[]);groups.get(t.destination)!.push(t)});sel.innerHTML=[...groups.entries()].map(([d,arr])=>`<optgroup label="${d}">${arr.map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}</optgroup>`).join('')}
      fab.addEventListener('click',()=>{fill();uploadSheet?.classList.add('open')})
      uploadSheet.querySelector('.mobileUploadClose')?.addEventListener('click',()=>uploadSheet?.classList.remove('open'))
      uploadSheet.querySelector('.mobileChoosePhotos')?.addEventListener('click',()=>uploadInput?.click())
      uploadInput.addEventListener('change',()=>{if(uploadInput?.files?.length)void uploadFiles(uploadInput.files);if(uploadInput)uploadInput.value=''})
    }

    installDelegatedClicks()
    buildMobileUpload()
    void refreshCache().then(()=>{renderDashboard()})

    const pending=localStorage.getItem('h17-pending-topic');if(pending)setTimeout(()=>openProduction(pending),300)

    const observer=new MutationObserver(()=>{if(disposed)return;if(isDashboard())renderDashboard();else restoreNonDashboard()})
    observer.observe(document.body,{childList:true,subtree:true})

    const channel=supabase.channel('h17-experience-live').on('postgres_changes',{event:'*',schema:'public',table:'materials'},()=>{
      const refresh=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('刷新')) as HTMLButtonElement|undefined
      refresh?.click()
    }).subscribe()

    return()=>{disposed=true;observer.disconnect();supabase.removeChannel(channel);document.querySelector('.mobileUploadFab')?.remove();document.querySelector('.mobileUploadSheet')?.remove();uploadInput?.remove()}
  },[])
  return null
}
