'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const WEEKLY_COUNT = 6

type TopicRow = {id:string;title:string;destination:string;content_type:string;status:string;planned_at?:string|null}

const topicBank: Record<string, Array<[string,string]>> = {
  '马来西亚': [
    ['第一次去马来西亚最容易踩的坑','实用型'],['吉隆坡3天2夜怎么排最顺','路线型'],['马来西亚旅行真实花费怎么准备','决策型'],
    ['去马来西亚前一定要知道的6件事','经验型'],['吉隆坡不赶景点的一日Citywalk','路线型'],['马来西亚第一次自由行准备清单','实用型'],
    ['吉隆坡住哪里出行最方便','决策型'],['马来西亚哪些东西值得买','实用型']
  ],
  '香港': [
    ['第一次去香港别乱排路线','决策型'],['深圳出发香港一天怎么走最顺','路线型'],['香港一天真实花费要多少','实用型'],
    ['香港Citywalk不赶景点路线','路线型'],['福田口岸去香港最省事的走法','实用型'],['香港这些地方我会二刷','经验型']
  ],
  '新疆': [
    ['新疆旅行真实花费','决策型'],['第一次去新疆路线怎么选','路线型'],['去新疆才知道的6件事','经验型'],
    ['新疆旅行出发前准备清单','实用型'],['新疆到底适合几月份去','决策型'],['新疆长线旅行怎么少踩坑','经验型']
  ],
  '云南': [
    ['云南旅行回来后的真实建议','经验型'],['云南第一次自由行路线怎么排','路线型'],['云南旅行真实花费','决策型'],
    ['云南哪些地方值得二刷','经验型'],['云南旅行最容易浪费时间的地方','决策型'],['去云南前一定要准备的东西','实用型']
  ],
  '深圳周边': [
    ['周末只有一天我会去哪里','路线型'],['深圳打工人周末放空地','路线型'],['深圳周边不赶路的一日游','路线型'],
    ['深圳周末低预算怎么玩','实用型'],['深圳出发2小时能到的地方','决策型'],['深圳周边我会反复去的小城','经验型']
  ],
  '东山岛 / 漳州': [
    ['深圳出发2.5小时周末看海','路线型'],['东山岛到底值不值得去','决策型'],['漳州古城一天怎么逛','路线型'],
    ['东山岛周末真实花费','实用型'],['第一次去东山岛怎么少踩坑','经验型'],['漳州和东山岛怎么一起玩','路线型']
  ],
  '泰国': [
    ['第一次去泰国最容易踩的坑','实用型'],['泰国自由行真实花费','决策型'],['曼谷第一次去怎么排最顺','路线型'],
    ['泰国出发前准备清单','实用型'],['泰国值得买的伴手礼','实用型'],['泰国榴莲怎么吃不踩雷','经验型']
  ]
}

function escapeHtml(v:string){return v.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c))}
function mondayISO(){
  const d=new Date(); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d.toISOString()
}
function nativeSet(el:HTMLInputElement|HTMLTextAreaElement,value:string){
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set
  setter?.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}))
}

export default function StudioAutomationEnhancer(){
  useEffect(()=>{
    const supabase=createClient()
    let topicsCache:TopicRow[]=[]
    let lastGroupSig=''
    let lastPage=''
    const coverCache=new Map<string,string>()

    const getSessionUser=async()=> (await supabase.auth.getUser()).data.user

    async function refreshTopics(){
      const {data}=await supabase.from('topics').select('id,title,destination,content_type,status,planned_at').order('created_at',{ascending:false})
      topicsCache=(data||[]) as TopicRow[]
    }

    async function syncDestinationsFromTopics(){
      const user=await getSessionUser(); if(!user) return
      const {data:dest}=await supabase.from('destinations').select('name')
      const existing=new Set((dest||[]).map((d:any)=>d.name))
      const names=[...new Set(topicsCache.map(t=>t.destination).filter(Boolean))]
      const missing=names.filter(n=>!existing.has(n))
      if(missing.length) await supabase.from('destinations').insert(missing.map(name=>({user_id:user.id,name,region:name==='香港'?'港澳':name==='马来西亚'?'出境':null})))
    }

    async function ensureWeeklyTopics(showMessage=false){
      const user=await getSessionUser(); if(!user) return
      await refreshTopics()
      const week=mondayISO()
      const existingThisWeek=topicsCache.filter(t=>t.planned_at && new Date(t.planned_at)>=new Date(week))
      const need=Math.max(0,WEEKLY_COUNT-existingThisWeek.length)
      if(!need){ if(showMessage) alert(`本周自动选题已经补满 ${WEEKLY_COUNT} 条。`); return }
      const {data:destRows}=await supabase.from('destinations').select('name').order('created_at',{ascending:true})
      const destinations=(destRows||[]).map((d:any)=>d.name)
      const pool:string[] = destinations.length?destinations:Object.keys(topicBank)
      const currentTitles=new Set(topicsCache.map(t=>t.title))
      const weekNo=Math.floor(new Date(week).getTime()/604800000)
      const inserts:any[]=[]
      for(let round=0;round<12 && inserts.length<need;round++){
        for(let i=0;i<pool.length && inserts.length<need;i++){
          const dest=pool[(i+weekNo+round)%pool.length]
          const bank=topicBank[dest] || [[`${dest}第一次去怎么安排更顺`,'路线型'],[`${dest}旅行真实花费`,'决策型'],[`${dest}出发前准备清单`,'实用型']]
          const [title,type]=bank[(weekNo+i+round)%bank.length]
          if(currentTitles.has(title) || inserts.some(x=>x.title===title)) continue
          inserts.push({user_id:user.id,title,destination:dest,content_type:type,status:'idea',planned_at:week})
        }
      }
      if(inserts.length) await supabase.from('topics').insert(inserts)
      await refreshTopics(); await syncDestinationsFromTopics()
      if(showMessage) alert(`本周已自动补充 ${inserts.length} 条选题。`)
    }

    function findNav(label:string){
      return [...document.querySelectorAll('nav button,.mobileMenu button')].find(x=>x.textContent?.includes(label)) as HTMLButtonElement|undefined
    }

    function openProduction(title:string){
      findNav('内容制作')?.click()
      setTimeout(()=>{
        const select=document.querySelector('.workflowBar select') as HTMLSelectElement|null
        if(!select) return
        const option=[...select.options].find(o=>o.textContent?.includes(title))
        if(option){select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}))}
      },120)
    }

    function bindDashboardCards(){
      document.querySelectorAll('.kanban .task').forEach(el=>{
        const btn=el as HTMLButtonElement
        if(btn.dataset.smartOpen==='1') return
        btn.dataset.smartOpen='1'
        btn.title='点击进入该选题详情'
        btn.addEventListener('click',(e)=>{
          e.preventDefault();e.stopPropagation();
          const title=btn.querySelector('strong')?.textContent?.trim()||''
          if(title) openProduction(title)
        },true)
      })
    }

    async function openDestinationDrawer(name:string){
      document.querySelector('.smartDrawer')?.remove()
      const drawer=document.createElement('aside'); drawer.className='smartDrawer'
      drawer.innerHTML=`<div class="smartDrawerHead"><div><small>DESTINATION</small><h2>${escapeHtml(name)}</h2></div><button aria-label="关闭">×</button></div><div class="drawerLoading">正在整理该目的地内容…</div>`
      document.body.appendChild(drawer)
      drawer.querySelector('button')?.addEventListener('click',()=>drawer.remove())
      const {data:d}=await supabase.from('destinations').select('id,region').eq('name',name).limit(1).maybeSingle()
      const [{data:ts},{data:ps},{data:ms}]=await Promise.all([
        supabase.from('topics').select('id,title,content_type,status').eq('destination',name).order('created_at',{ascending:false}),
        supabase.from('posts').select('id,title,published_at').eq('destination',name).order('published_at',{ascending:false}),
        d?.id?supabase.from('materials').select('id,storage_path').eq('destination_id',d.id).order('created_at',{ascending:false}).limit(8):Promise.resolve({data:[] as any[]}) as any
      ])
      const images:string[]=[]
      for(const m of (ms||[]) as any[]){const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(m.storage_path,3600);if(s?.signedUrl) images.push(s.signedUrl)}
      drawer.innerHTML=`<div class="smartDrawerHead"><div><small>DESTINATION</small><h2>${escapeHtml(name)}</h2><p>${escapeHtml(d?.region||'旅行内容资产')}</p></div><button aria-label="关闭">×</button></div>
        <div class="drawerStats"><span><b>${(ts||[]).length}</b> 选题</span><span><b>${(ps||[]).length}</b> 已发布</span><span><b>${(ms||[]).length}</b> 素材</span></div>
        ${images.length?`<div class="drawerImages">${images.map(u=>`<img src="${u}" alt="">`).join('')}</div>`:''}
        <h3>选题树</h3><div class="drawerTopics">${(ts||[]).map((t:any)=>`<button data-topic="${escapeHtml(t.title)}"><span>${escapeHtml(t.title)}</span><em>${escapeHtml(t.content_type)} · ${escapeHtml(t.status)}</em></button>`).join('')||'<p>暂无选题</p>'}</div>`
      drawer.querySelector('.smartDrawerHead button')?.addEventListener('click',()=>drawer.remove())
      drawer.querySelectorAll('[data-topic]').forEach(el=>el.addEventListener('click',()=>{openProduction((el as HTMLElement).dataset.topic||'');drawer.remove()}))
    }

    async function bindDestinationCards(){
      const cards=[...document.querySelectorAll('.destCard')] as HTMLElement[]
      for(const card of cards){
        const name=card.querySelector('h3')?.textContent?.trim()||''; if(!name) continue
        if(card.dataset.smartDest!=='1'){
          card.dataset.smartDest='1'; card.tabIndex=0; card.title='点击查看目的地详情'
          card.addEventListener('click',()=>openDestinationDrawer(name))
          card.addEventListener('keydown',e=>{if(e.key==='Enter')openDestinationDrawer(name)})
        }
        const cover=card.querySelector('.destCover') as HTMLElement|null
        if(cover && !cover.querySelector('img')){
          let url=coverCache.get(name)
          if(!url){
            const {data:d}=await supabase.from('destinations').select('id').eq('name',name).limit(1).maybeSingle()
            if(d?.id){const {data:m}=await supabase.from('materials').select('storage_path').eq('destination_id',d.id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(m?.storage_path){const {data:s}=await supabase.storage.from('travel-media').createSignedUrl(m.storage_path,3600);url=s?.signedUrl;if(url)coverCache.set(name,url)}}
          }
          if(url) cover.innerHTML=`<img src="${url}" alt="${escapeHtml(name)}">`
        }
      }
    }

    function renderTopicGroups(){
      const toolbar=document.querySelector('.toolbar'); const table=document.querySelector('.tableWrap') as HTMLElement|null
      if(!toolbar||!table) return
      const sig=topicsCache.map(t=>`${t.id}:${t.status}`).join('|'); if(sig===lastGroupSig && document.querySelector('.smartTopicGroups')) return
      lastGroupSig=sig; table.style.display='none'
      let wrap=document.querySelector('.smartTopicGroups') as HTMLElement|null
      if(!wrap){wrap=document.createElement('section');wrap.className='smartTopicGroups';table.insertAdjacentElement('beforebegin',wrap)}
      const groups=new Map<string,TopicRow[]>(); topicsCache.forEach(t=>{if(!groups.has(t.destination))groups.set(t.destination,[]);groups.get(t.destination)!.push(t)})
      wrap.innerHTML=[...groups.entries()].map(([dest,items])=>`<details class="topicGroup" ${dest==='马来西亚'?'open':''}><summary><span><b>${escapeHtml(dest)}</b><em>${items.length} 个选题</em></span><strong>展开</strong></summary><div class="topicChildren">${items.map(t=>`<button data-title="${escapeHtml(t.title)}"><div><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.content_type)}</span></div><i class="status ${escapeHtml(t.status)}">${escapeHtml(t.status==='idea'?'选题':t.status==='doing'?'制作中':t.status==='ready'?'待发布':'已发布')}</i></button>`).join('')}</div></details>`).join('')
      wrap.querySelectorAll('[data-title]').forEach(el=>el.addEventListener('click',()=>openProduction((el as HTMLElement).dataset.title||'')))
    }

    function readProduction(){
      const select=document.querySelector('.workflowBar select') as HTMLSelectElement|null
      const opt=select?.selectedOptions?.[0]?.textContent||''
      const destination=opt.split('｜')[0]?.trim()||''
      const form=document.querySelector('.formPanel')
      const inputs=form?.querySelectorAll('input')||[]; const textareas=form?.querySelectorAll('textarea')||[]
      return {destination,contentType:'旅行内容',title:(inputs[0] as HTMLInputElement)?.value||'',coverTitle:(inputs[1] as HTMLInputElement)?.value||'',coverSubtitle:(inputs[2] as HTMLInputElement)?.value||'',route:(textareas[0] as HTMLTextAreaElement)?.value||'',body:(textareas[1] as HTMLTextAreaElement)?.value||'', inputs,textareas}
    }

    function ensureAIPanel(){
      const form=document.querySelector('.formPanel'); const actions=form?.querySelector('.formActions'); if(!form||!actions||form.querySelector('.aiStudioPanel')) return
      const panel=document.createElement('div'); panel.className='aiStudioPanel'
      panel.innerHTML=`<div><small>AI CONTENT ASSISTANT</small><b>直接生成可发布稿</b><span>根据当前选题、路线和素材字段生成；生成后仍可直接修改。</span></div><div class="aiActions"><button class="aiGenerate">✨ AI 生成可发布稿</button><button class="aiCopy">复制整篇</button></div><p class="aiStatus">无需离开这个页面，生成后直接复制去小红书。</p>`
      actions.insertAdjacentElement('beforebegin',panel)
      panel.querySelector('.aiGenerate')?.addEventListener('click',async()=>{
        const s=readProduction(); const status=panel.querySelector('.aiStatus')!; status.textContent='正在生成…'
        try{
          const r=await fetch('/api/ai-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)})
          const data=await r.json();
          const inputs=s.inputs as NodeListOf<HTMLInputElement>; const ta=s.textareas as NodeListOf<HTMLTextAreaElement>
          if(inputs[0]&&data.title)nativeSet(inputs[0],data.title); if(inputs[1]&&data.coverTitle)nativeSet(inputs[1],data.coverTitle); if(inputs[2]&&data.coverSubtitle)nativeSet(inputs[2],data.coverSubtitle)
          if(ta[0]&&data.route)nativeSet(ta[0],data.route); if(ta[1]&&data.body)nativeSet(ta[1],`${data.body}${data.hashtags?.length?'\n\n'+data.hashtags.join(' '):''}`)
          status.textContent=data.source==='openai'?'AI 已生成，可直接复制发布。':'智能稿已生成；后续接入 API 后会自动升级为 AI 深度生成。'
        }catch{status.textContent='生成失败，请稍后重试。'}
      })
      panel.querySelector('.aiCopy')?.addEventListener('click',async()=>{
        const s=readProduction(); const text=`${s.title}\n\n${s.body}`.trim(); await navigator.clipboard.writeText(text); panel.querySelector('.aiStatus')!.textContent='已复制标题 + 正文，可直接去发布。'
      })
    }

    function addAutoBadge(){
      const top=document.querySelector('.topActions'); if(!top||top.querySelector('.autoTopicBadge')) return
      const badge=document.createElement('button');badge.className='autoTopicBadge';badge.textContent=`每周自动选题 ${WEEKLY_COUNT} 条`;badge.title='点击立即检查本周选题'
      badge.addEventListener('click',()=>ensureWeeklyTopics(true));top.prepend(badge)
    }

    function interceptManualAdd(){
      document.querySelectorAll('.topActions button').forEach(el=>{
        const b=el as HTMLButtonElement; const txt=b.textContent||''
        if((txt.includes('新增选题')||txt.includes('新增目的地'))&&b.dataset.autoReplaced!=='1'){
          b.dataset.autoReplaced='1'; b.textContent=txt.includes('目的地')?'自动整理目的地':'立即补充选题'
          b.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation(); if(txt.includes('目的地'))syncDestinationsFromTopics().then(()=>alert('已根据选题自动整理目的地。')); else ensureWeeklyTopics(true)},true)
        }
      })
    }

    async function sync(){
      const page=(document.querySelector('.eyebrow')?.textContent||'').toLowerCase()
      if(page!==lastPage){lastPage=page; await refreshTopics()}
      addAutoBadge();interceptManualAdd();bindDashboardCards();ensureAIPanel()
      if(page==='topics') renderTopicGroups()
      if(page==='materials') await bindDestinationCards()
    }

    let interval:number
    async function start(){
      await refreshTopics(); await ensureWeeklyTopics(false); await syncDestinationsFromTopics(); await sync()
      interval=window.setInterval(sync,1200)
    }
    const timer=window.setTimeout(start,500)
    return()=>{window.clearTimeout(timer);if(interval)window.clearInterval(interval);document.querySelector('.smartDrawer')?.remove()}
  },[])
  return null
}
