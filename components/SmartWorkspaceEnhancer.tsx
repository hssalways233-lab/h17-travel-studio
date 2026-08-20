'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type SmartTopic = {
  id:string
  title:string
  destination:string
  content_type:string
  status:'idea'|'doing'|'ready'|'done'
  xhs_url:string|null
  planned_at:string|null
  created_at:string
}

type AutoItem = { title:string; type:string }

const statusName:Record<string,string> = {idea:'选题',doing:'制作中',ready:'待发布',done:'已发布'}

const autoDestinations:Record<string,{region:string;items:AutoItem[]}> = {
  '香港':{region:'港澳',items:[
    {title:'深圳去香港到底哪个口岸最省时间',type:'实用型'},
    {title:'第一次去香港别乱排｜一天Citywalk顺路版',type:'路线型'},
    {title:'香港下雨天还能怎么玩｜室内半日路线',type:'路线型'},
    {title:'香港夜景不只维港｜傍晚到夜晚这样走',type:'路线型'},
    {title:'第一次去香港最容易踩的6个小坑',type:'经验型'},
    {title:'香港一天预算怎么分才不容易超支',type:'决策型'},
    {title:'中环怎么走最好拍｜街区散步路线',type:'路线型'},
    {title:'深圳打工人的香港周末放空路线',type:'路线型'}]},
  '马来西亚':{region:'出境',items:[
    {title:'第一次去吉隆坡最容易踩的坑',type:'实用型'},
    {title:'吉隆坡出发前3天一定要做的4件事',type:'实用型'},
    {title:'吉隆坡5天4晚到底要准备多少钱',type:'决策型'},
    {title:'第一次去马来西亚行李怎么带更实用',type:'实用型'},
    {title:'吉隆坡机场到市区怎么选最省事',type:'决策型'},
    {title:'双子塔周边半日怎么走不绕路',type:'路线型'},
    {title:'马来西亚第一次自由行适合怎么玩',type:'路线型'},
    {title:'去马来西亚前我最想提前知道的7件事',type:'经验型'}]},
  '新疆':{region:'国内长线',items:[
    {title:'第一次去新疆先选北疆还是南疆',type:'决策型'},
    {title:'新疆7天到底怎么排才不一直坐车',type:'路线型'},
    {title:'新疆旅行穿什么｜温差大的实用清单',type:'实用型'},
    {title:'第一次自驾新疆最容易忽略的准备',type:'经验型'},
    {title:'新疆旅行预算主要花在哪些地方',type:'决策型'},
    {title:'不想特种兵｜新疆慢一点的路线怎么排',type:'路线型'},
    {title:'去新疆前真正需要下载和准备的东西',type:'实用型'},
    {title:'新疆回来后最想纠正的几个误区',type:'经验型'}]},
  '云南':{region:'国内长线',items:[
    {title:'云南自由行第一次怎么选城市',type:'决策型'},
    {title:'大理丽江怎么排才不会一直赶路',type:'路线型'},
    {title:'云南雨季旅行到底值不值得去',type:'决策型'},
    {title:'云南行李怎么带｜拍照和实用都兼顾',type:'实用型'},
    {title:'第一次去云南最容易多花的几笔钱',type:'经验型'},
    {title:'云南慢旅行｜不追景点的一周路线',type:'路线型'},
    {title:'大理住古城还是洱海边更适合你',type:'决策型'},
    {title:'云南回来后最推荐保留的3种体验',type:'经验型'}]},
  '东山岛 / 漳州':{region:'福建',items:[
    {title:'深圳出发2.5h周末看海怎么排',type:'路线型'},
    {title:'东山岛到底值不值得去一次',type:'决策型'},
    {title:'东山岛两天一夜不绕路路线',type:'路线型'},
    {title:'漳州古城和东山岛怎么一起玩',type:'路线型'},
    {title:'周末去东山岛预算要准备多少',type:'决策型'},
    {title:'第一次去东山岛最容易踩的坑',type:'经验型'},
    {title:'东山岛看日落住哪里更方便',type:'决策型'},
    {title:'不自驾去东山岛到底方不方便',type:'实用型'}]},
  '深圳周边':{region:'广东',items:[
    {title:'周末只有一天我会去深圳哪里放空',type:'路线型'},
    {title:'深圳打工人下班后也能去的散步路线',type:'路线型'},
    {title:'深圳周边不用请假的看海目的地',type:'决策型'},
    {title:'深圳半日Citywalk怎么走更舒服',type:'路线型'},
    {title:'深圳雨天周末不逛商场还能去哪',type:'路线型'},
    {title:'深圳周末预算200元怎么安排一天',type:'决策型'},
    {title:'深圳人少一点的拍照散步路线',type:'路线型'},
    {title:'深圳周边一日游交通怎么选最省事',type:'实用型'}]},
  '泰国':{region:'出境',items:[
    {title:'第一次去泰国曼谷清迈普吉怎么串联',type:'路线型'},
    {title:'泰国自由行出发前一定确认的8件事',type:'实用型'},
    {title:'泰国旅行现金到底准备多少更合适',type:'决策型'},
    {title:'第一次去泰国行李怎么带不超重',type:'实用型'},
    {title:'曼谷清迈普吉分别适合留几天',type:'决策型'},
    {title:'泰国榴莲怎么吃更不容易踩坑',type:'经验型'},
    {title:'泰国6人出行打车还是公共交通更方便',type:'决策型'},
    {title:'泰国回来最值得带的伴手礼清单',type:'实用型'}]},
  '珠海长隆':{region:'广东',items:[
    {title:'珠海长隆一天到底怎么安排不走回头路',type:'路线型'},
    {title:'第一次去珠海长隆住一晚值不值',type:'决策型'},
    {title:'珠海长隆最容易浪费时间的几个环节',type:'经验型'},
    {title:'深圳出发去珠海长隆交通怎么选',type:'实用型'},
    {title:'珠海长隆亲测必看和可跳过项目',type:'经验型'},
    {title:'珠海长隆预算大头到底花在哪里',type:'决策型'}]}
}

function esc(v:string){return v.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c))}

export default function SmartWorkspaceEnhancer(){
  useEffect(()=>{
    const supabase = createClient()
    let disposed = false
    let topics:SmartTopic[] = []
    let dailyCount = 0
    let lastGroupedHash = ''

    const getPageTitle = () => (document.querySelector('main h1')?.textContent || '').trim()

    async function refreshTopics(){
      const {data} = await supabase.from('topics').select('id,title,destination,content_type,status,xhs_url,planned_at,created_at').order('created_at',{ascending:false})
      topics = (data || []) as SmartTopic[]
      lastGroupedHash = ''
    }

    async function ensureDailyTopics(){
      const {data:{user}} = await supabase.auth.getUser()
      if(!user) return
      const today = new Date()
      const start = new Date(today.getFullYear(),today.getMonth(),today.getDate())
      const end = new Date(start); end.setDate(end.getDate()+1)

      const {data:todayRows} = await supabase.from('topics').select('id').gte('planned_at',start.toISOString()).lt('planned_at',end.toISOString())
      const existingToday = todayRows?.length || 0
      if(existingToday >= 6){ dailyCount = existingToday; return }

      const {data:destRows} = await supabase.from('destinations').select('name')
      const existingDest = new Set((destRows||[]).map((d:any)=>d.name))
      const missingDest = Object.entries(autoDestinations).filter(([name])=>!existingDest.has(name)).map(([name,v])=>({user_id:user.id,name,region:v.region}))
      if(missingDest.length) await supabase.from('destinations').insert(missingDest)

      const {data:allRows} = await supabase.from('topics').select('title,destination')
      const existing = new Set((allRows||[]).map((t:any)=>`${t.destination}::${t.title}`))
      const pool = Object.entries(autoDestinations).flatMap(([destination,v])=>v.items.map(item=>({destination,...item})))
      const seed = Math.floor(start.getTime()/86400000) % pool.length
      const rotated = [...pool.slice(seed),...pool.slice(0,seed)]
      const picked:any[] = []
      const usedDest = new Set<string>()
      const need = 6-existingToday

      for(const item of rotated){
        if(picked.length>=need) break
        const key = `${item.destination}::${item.title}`
        if(existing.has(key) || usedDest.has(item.destination)) continue
        picked.push({user_id:user.id,title:item.title,destination:item.destination,content_type:item.type,status:'idea',planned_at:new Date().toISOString()})
        usedDest.add(item.destination)
      }
      if(picked.length<need){
        for(const item of rotated){
          if(picked.length>=need) break
          const key = `${item.destination}::${item.title}`
          if(existing.has(key) || picked.some(x=>x.destination===item.destination && x.title===item.title)) continue
          picked.push({user_id:user.id,title:item.title,destination:item.destination,content_type:item.type,status:'idea',planned_at:new Date().toISOString()})
        }
      }
      if(picked.length) await supabase.from('topics').insert(picked)
      dailyCount = existingToday + picked.length
      await refreshTopics()
    }

    function ensureModal(){
      let host = document.querySelector('.smartDetailModal') as HTMLElement|null
      if(host) return host
      host = document.createElement('div')
      host.className = 'smartDetailModal'
      host.innerHTML = '<div class="smartModalBackdrop" data-smart-close="1"></div><section class="smartModalCard"><button class="smartModalClose" data-smart-close="1">×</button><div class="smartModalBody"></div></section>'
      document.body.appendChild(host)
      return host
    }

    function closeModal(){ const host=ensureModal(); host.classList.remove('open') }

    function showTopicDetail(topic:SmartTopic){
      const host = ensureModal(); const body=host.querySelector('.smartModalBody') as HTMLElement
      body.innerHTML = `<span class="smartEyebrow">${esc(topic.destination)}</span><h2>${esc(topic.title)}</h2><div class="smartMetaRow"><span>${esc(topic.content_type)}</span><span>${esc(statusName[topic.status]||topic.status)}</span></div><div class="smartDetailBlocks"><div><b>当前阶段</b><p>${topic.status==='idea'?'可进入制作，补封面、路线、正文与素材。':topic.status==='doing'?'正在制作，建议直接进入内容制作继续完善。':topic.status==='ready'?'内容已接近完成，可检查后发布。':'已发布，可进入数据复盘。'}</p></div><div><b>下一步</b><p>${topic.status==='done'?'查看数据与复盘':'进入内容制作，并让 AI 先生成一版可发布稿。'}</p></div></div><div class="smartModalActions">${topic.status!=='done'?`<button data-smart-open-production="${topic.id}">进入内容制作</button>`:''}<button class="secondary" data-smart-advance="${topic.id}">推进状态</button></div>`
      host.classList.add('open')
    }

    function showDestinationDetail(name:string){
      const host = ensureModal(); const body=host.querySelector('.smartModalBody') as HTMLElement
      const list = topics.filter(t=>t.destination===name)
      body.innerHTML = `<span class="smartEyebrow">目的地内容资产</span><h2>${esc(name)}</h2><p class="smartLead">这里集中查看这个目的地的全部选题，并直接进入某一篇继续制作。</p><div class="smartDestinationTopics">${list.length?list.map(t=>`<button class="smartTopicMini" data-smart-topic="${t.id}"><span><b>${esc(t.title)}</b><small>${esc(t.content_type)}</small></span><em>${esc(statusName[t.status]||t.status)}</em></button>`).join(''):'<div class="smartEmpty">还没有选题，系统会在每日自动补充时逐步加入。</div>'}</div>`
      host.classList.add('open')
    }

    function openProduction(topicId:string){
      closeModal()
      const navBtn = Array.from(document.querySelectorAll('nav button')).find(b=>(b.textContent||'').includes('内容制作')) as HTMLButtonElement|undefined
      navBtn?.click()
      let tries=0
      const timer=setInterval(()=>{
        tries++
        const select=document.querySelector('.workflowBar select') as HTMLSelectElement|null
        if(select){
          select.value=topicId
          select.dispatchEvent(new Event('change',{bubbles:true}))
          clearInterval(timer)
        } else if(tries>20) clearInterval(timer)
      },120)
    }

    async function advanceTopic(id:string){
      const topic=topics.find(t=>t.id===id); if(!topic) return
      const order=['idea','doing','ready','done'] as const
      const next=order[(order.indexOf(topic.status)+1)%order.length]
      await supabase.from('topics').update({status:next}).eq('id',id)
      await refreshTopics(); closeModal()
    }

    function renderGroupedTopics(){
      if(getPageTitle()!=='选题库' || !topics.length) return
      const toolbar=document.querySelector('.toolbar') as HTMLElement|null
      const table=document.querySelector('.tableWrap') as HTMLElement|null
      if(!toolbar || !table) return
      table.style.display='none'
      let root=document.querySelector('.smartTopicGroups') as HTMLElement|null
      if(!root){ root=document.createElement('section'); root.className='smartTopicGroups'; toolbar.insertAdjacentElement('afterend',root) }
      const q=((toolbar.querySelector('input') as HTMLInputElement|null)?.value||'').trim().toLowerCase()
      const filtered=topics.filter(t=>!q || `${t.destination} ${t.title} ${t.content_type}`.toLowerCase().includes(q))
      const hash=filtered.map(t=>`${t.id}:${t.status}`).join('|')+'::'+q
      if(hash===lastGroupedHash) return
      lastGroupedHash=hash
      const groups=new Map<string,SmartTopic[]>()
      for(const t of filtered){ if(!groups.has(t.destination)) groups.set(t.destination,[]); groups.get(t.destination)!.push(t) }
      root.innerHTML = `<div class="smartGroupHead"><div><span class="smartEyebrow">按目的地管理</span><h3>大类 → 多个小选题</h3></div><span>共 ${filtered.length} 条 · 每天自动补充 6 条</span></div>${[...groups.entries()].map(([dest,list],i)=>`<details class="smartDestGroup" ${i<2?'open':''}><summary><div><b>${esc(dest)}</b><span>${list.length} 个选题</span></div><div class="smartStatusSummary"><em>${list.filter(t=>t.status==='doing').length} 制作中</em><em>${list.filter(t=>t.status==='ready').length} 待发布</em></div></summary><div class="smartTopicGrid">${list.map(t=>`<button class="smartTopicItem" data-smart-topic="${t.id}"><span class="smartTopicText"><b>${esc(t.title)}</b><small>${esc(t.content_type)}</small></span><span class="status ${t.status}">${esc(statusName[t.status]||t.status)}</span></button>`).join('')}</div></details>`).join('') || '<div class="smartEmpty">没有匹配的选题</div>'}`
    }

    function groupProductionSelect(){
      if(getPageTitle()!=='内容制作' || !topics.length) return
      const select=document.querySelector('.workflowBar select') as HTMLSelectElement|null
      if(!select) return
      const available=topics.filter(t=>t.status!=='done')
      const hash=available.map(t=>`${t.id}:${t.status}`).join('|')
      if(select.dataset.smartHash===hash) return
      const current=select.value
      const groups=new Map<string,SmartTopic[]>()
      for(const t of available){ if(!groups.has(t.destination)) groups.set(t.destination,[]); groups.get(t.destination)!.push(t) }
      select.innerHTML=''
      for(const [dest,list] of groups){
        const og=document.createElement('optgroup'); og.label=`${dest}（${list.length}）`
        for(const t of list){ const opt=document.createElement('option');opt.value=t.id;opt.textContent=`${t.title}（${statusName[t.status]}）`;og.appendChild(opt) }
        select.appendChild(og)
      }
      select.dataset.smartHash=hash
      if(available.some(t=>t.id===current)) select.value=current
      else if(available[0]){ select.value=available[0].id; select.dispatchEvent(new Event('change',{bubbles:true})) }
    }

    function setReactValue(el:HTMLInputElement|HTMLTextAreaElement,value:string){
      const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set
      setter?.call(el,value)
      el.dispatchEvent(new Event('input',{bubbles:true}))
    }

    function findField(label:string){
      const form=document.querySelector('.formPanel')
      if(!form) return null
      return Array.from(form.querySelectorAll('.field')).find(f=>(f.querySelector('span')?.textContent||'').includes(label))?.querySelector('input,textarea') as HTMLInputElement|HTMLTextAreaElement|null
    }

    function ensureAiPanel(){
      if(getPageTitle()!=='内容制作') return
      const form=document.querySelector('.formPanel') as HTMLElement|null
      const actions=form?.querySelector('.formActions') as HTMLElement|null
      if(!form || !actions || form.querySelector('.smartAiPanel')) return
      const panel=document.createElement('section')
      panel.className='smartAiPanel'
      panel.innerHTML=`<div class="smartAiHead"><div><span class="smartEyebrow">AI CONTENT</span><h3>一键生成可直接发布的版本</h3><p>选好大类和小选题后，先生成，再按你的真实经历微调；不用从空白正文开始写。</p></div><button data-smart-ai-generate="1">AI 生成发布稿</button></div><div class="smartAiResult" hidden><textarea class="smartAiCopyText" readonly></textarea><div class="smartAiActions"><span class="smartAiStatus">已生成，可直接复制</span><button class="secondary" data-smart-copy="1">复制全部发布稿</button></div></div>`
      actions.insertAdjacentElement('beforebegin',panel)
    }

    async function generateAiDraft(){
      const panel=document.querySelector('.smartAiPanel') as HTMLElement|null
      const btn=panel?.querySelector('[data-smart-ai-generate]') as HTMLButtonElement|null
      if(!panel || !btn) return
      const select=document.querySelector('.workflowBar select') as HTMLSelectElement|null
      const topic=topics.find(t=>t.id===select?.value)
      if(!topic) return alert('请先选择一个具体选题')
      btn.disabled=true; btn.textContent='正在生成…'
      const payload={
        destination:topic.destination,title:topic.title,contentType:topic.content_type,
        route:findField('路线')?.value||'',coverTitle:findField('封面主标题')?.value||'',coverSubtitle:findField('封面辅助标题')?.value||'',body:findField('正文')?.value||''
      }
      try{
        const res=await fetch('/api/ai-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        const data=await res.json()
        const map:[[string,string]]|any=[['内容标题',data.title],['封面主标题',data.coverTitle],['封面辅助标题',data.coverSubtitle],['路线',data.route],['正文',data.body]]
        for(const [label,value] of map){ const el=findField(label); if(el && typeof value==='string') setReactValue(el,value) }
        const result=panel.querySelector('.smartAiResult') as HTMLElement
        const text=panel.querySelector('.smartAiCopyText') as HTMLTextAreaElement
        const hashtags=Array.isArray(data.hashtags)?data.hashtags.join(' '):''
        text.value=`${data.title||topic.title}\n\n${data.body||''}${hashtags?`\n\n${hashtags}`:''}`
        result.hidden=false
        const status=panel.querySelector('.smartAiStatus') as HTMLElement
        status.textContent=data.source==='openai'?'AI 已生成 · 可直接复制发布':'智能稿已生成 · 可直接复制发布'
      }catch{ alert('生成失败，请稍后再试') }
      finally{ btn.disabled=false; btn.textContent='重新生成发布稿' }
    }

    async function copyAiDraft(){
      const text=(document.querySelector('.smartAiCopyText') as HTMLTextAreaElement|null)?.value||''
      if(!text) return
      await navigator.clipboard.writeText(text)
      const s=document.querySelector('.smartAiStatus') as HTMLElement|null
      if(s){s.textContent='已复制 ✓ 现在可以直接去小红书发布';setTimeout(()=>s.textContent='已生成，可直接复制',2200)}
    }

    function enhanceTop(){
      const page=getPageTitle()
      if(!['工作台','旅行素材库','选题库'].includes(page)) return
      const actions=document.querySelector('.topActions') as HTMLElement|null
      if(!actions) return
      const manual=Array.from(actions.querySelectorAll('button')).find(b=>!b.classList.contains('secondary')) as HTMLButtonElement|undefined
      if(manual) manual.style.display='none'
      let badge=actions.querySelector('.smartAutoBadge') as HTMLElement|null
      if(!badge){badge=document.createElement('div');badge.className='smartAutoBadge';actions.appendChild(badge)}
      badge.textContent=page==='旅行素材库'?'目的地自动关联':`每日自动更新 · ${dailyCount||6} 条选题`
    }

    function enhanceClickable(){
      if(getPageTitle()==='旅行素材库') document.querySelectorAll('.destCard').forEach(x=>x.classList.add('smartClickable'))
      if(getPageTitle()==='工作台') document.querySelectorAll('.kanban .task').forEach(x=>x.classList.add('smartClickable'))
    }

    async function onClick(e:MouseEvent){
      const target=e.target as HTMLElement
      if(target.closest('[data-smart-close]')) return closeModal()
      const ai=target.closest('[data-smart-ai-generate]'); if(ai){e.preventDefault();return generateAiDraft()}
      const copy=target.closest('[data-smart-copy]'); if(copy){e.preventDefault();return copyAiDraft()}
      const open=target.closest('[data-smart-open-production]') as HTMLElement|null; if(open){e.preventDefault();return openProduction(open.dataset.smartOpenProduction||'')}
      const advance=target.closest('[data-smart-advance]') as HTMLElement|null; if(advance){e.preventDefault();return advanceTopic(advance.dataset.smartAdvance||'')}
      const smartTopic=target.closest('[data-smart-topic]') as HTMLElement|null; if(smartTopic){e.preventDefault();const t=topics.find(x=>x.id===smartTopic.dataset.smartTopic);if(t)showTopicDetail(t);return}

      if(getPageTitle()==='工作台'){
        const task=target.closest('.kanban .task') as HTMLElement|null
        if(task){
          e.preventDefault();e.stopPropagation()
          const title=(task.querySelector('strong')?.textContent||'').trim()
          const dest=(task.querySelector('span')?.textContent||'').split('·')[0].trim()
          const t=topics.find(x=>x.title===title && (!dest || x.destination===dest)) || topics.find(x=>x.title===title)
          if(t) showTopicDetail(t)
          return
        }
      }
      if(getPageTitle()==='旅行素材库'){
        const card=target.closest('.destCard') as HTMLElement|null
        if(card){e.preventDefault();const name=(card.querySelector('h3')?.textContent||'').trim();if(name)showDestinationDetail(name)}
      }
    }

    document.addEventListener('click',onClick,true)

    const interval=setInterval(()=>{
      if(disposed) return
      enhanceTop();enhanceClickable();renderGroupedTopics();groupProductionSelect();ensureAiPanel()
      const search=document.querySelector('.toolbar input') as HTMLInputElement|null
      if(getPageTitle()==='选题库' && search && search.dataset.smartWatch!=='1'){
        search.dataset.smartWatch='1';search.addEventListener('input',()=>{lastGroupedHash='';setTimeout(renderGroupedTopics,20)})
      }
    },600)

    async function init(){
      await refreshTopics()
      const {data:{session}}=await supabase.auth.getSession()
      if(session?.user){await ensureDailyTopics();await refreshTopics()}
      supabase.auth.onAuthStateChange(async(_event,session)=>{if(session?.user){await ensureDailyTopics();await refreshTopics()}})
    }
    init()

    const channel=supabase.channel('h17-smart-workspace').on('postgres_changes',{event:'*',schema:'public',table:'topics'},async()=>{await refreshTopics()}).subscribe()

    return ()=>{
      disposed=true
      clearInterval(interval)
      document.removeEventListener('click',onClick,true)
      supabase.removeChannel(channel)
      document.querySelector('.smartDetailModal')?.remove()
    }
  },[])

  return null
}
