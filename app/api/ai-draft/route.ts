import { NextResponse } from 'next/server'

type DraftRequest = {
  destination?: string
  title?: string
  contentType?: string
  route?: string
  coverTitle?: string
  coverSubtitle?: string
  body?: string
  visualNotes?: string
}

const TITLE_MAX=20
const BODY_MAX=1000
function clean(v?: string){ return (v || '').trim() }
function stripTopic(v=''){return clean(v).replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'')}
function cut(v:string,max:number){return Array.from(v).slice(0,max).join('')}
function safeTitle(v:string){return cut(stripTopic(v),TITLE_MAX)}
function normalizeTags(tags:any,destination:string){
  const base=Array.isArray(tags)?tags.map((x:any)=>String(x).trim()).filter(Boolean):[]
  const cleaned=base.map(x=>x.startsWith('#')?x:`#${x}`).filter((x,i,a)=>a.indexOf(x)===i).slice(0,7)
  if(!cleaned.length)cleaned.push(`#${destination.replace(/\s+/g,'')}`,'#马来西亚旅行','#旅行攻略','#自由行')
  return cleaned
}
function fitBody(body:string,tags:string[]){
  const suffix=tags.length?`\n\n${tags.join(' ')}`:''
  const room=Math.max(0,BODY_MAX-Array.from(suffix).length)
  return `${cut(body.trim(),room)}${suffix}`.trim()
}

function fallbackDraft(input: DraftRequest){
  const destination = clean(input.destination) || '这次旅行'
  const rawTopic = stripTopic(input.title) || `${destination}旅行攻略`
  const route = clean(input.route)
  const contentType = clean(input.contentType) || '实用型'
  const isPD=/Port\s*Dickson|波德申/i.test(rawTopic)
  const title=safeTitle(isPD?'Port Dickson值不值得专程去？':rawTopic)
  const coverTitle=cut(clean(input.coverTitle)||(isPD?'Port Dickson值不值得去？':rawTopic),14)
  const coverSubtitle=cut(clean(input.coverSubtitle)||(isPD?'吉隆坡出发｜真实体验':`${destination}真实走过后整理`),18)

  let body=''
  if(isPD){
    const routeText=route||'吉隆坡出发到 Port Dickson'
    body=`先说结论：如果你已经在吉隆坡，想找一个不用折腾转机、可以轻松看海放空的地方，Port Dickson值得列进备选；但如果你是冲着“海岛级海水”专程跑一趟，就别把期待拉太满。\n\n🚗 怎么去\n这次路线是：${routeText}。它最大的优势不是“海有多惊艳”，而是离吉隆坡相对近，周末临时想换个场景也比较好安排。\n\n🌊 到底值不值得？\n我更愿意把它理解成“吉隆坡周边的轻度假海边”，而不是必打卡景点。适合慢慢走、看看海、拍几张照片、吃顿饭；如果你的马来西亚行程已经很满，它不是非去不可。\n\n📌 更适合\n• 已经在吉隆坡，想安排半天/一天周边游\n• 不想赶景点，想轻松一点\n• 对“方便、放空”比“顶级海景”更看重\n\n不太适合：时间很紧、只想看最惊艳海景的人。\n\n这篇我会把路线、现场感受和真实照片放在一起，给你一个更接近“去之前该有的预期”。`
  }else{
    const routeLine = route ? `\n\n📍路线\n${route}` : ''
    body=`先说结论：这篇不是景点清单，而是把这次旅行里真正会影响体验的部分先讲清楚。${routeLine}\n\n我更想解决三个问题：\n① 到底值不值得去\n② 怎么走最省时间\n③ 哪些细节出发前知道更有用\n\n如果你也是第一次去${destination}，先看结论和路线，再决定哪些地方值得放进自己的行程。\n\n这篇属于「${contentType}」，我会尽量用真实照片和能确认的信息说话，不把行程写成模板。`
  }
  const hashtags=normalizeTags(isPD?['#PortDickson','#波德申','#马来西亚旅行','#吉隆坡周边游','#马来西亚自由行']:[],destination)
  return {title,coverTitle,coverSubtitle,route,body:fitBody(body,hashtags),hashtags,source:'smart-fallback',limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}}
}

export async function POST(request: Request){
  const input = (await request.json().catch(()=>({}))) as DraftRequest
  const fallback = fallbackDraft(input)
  const apiKey = process.env.OPENAI_API_KEY
  if(!apiKey) return NextResponse.json(fallback)

  try{
    const prompt = `你是资深小红书旅行编辑。请基于用户真实字段，写一篇“现在就能发”的图文笔记，不要写成AI模板。\n\n平台硬限制：\n- 标题最多20个字符（中文、英文、空格、标点都按字符看待）。目标最好18-20字符，绝不能超过20。\n- 正文连同#标签总共最多1000字符。目标正文+标签控制在650-900字符，绝不能超过1000。\n- 标签5-7个，精准，不堆泛标签。\n\n写作要求：\n- 第一段直接给判断/结论，不要“如果你也准备去，这篇先收藏”这种模板开头。\n- 标题必须有搜索关键词+明确利益点/判断，但不能失实。\n- 结构优先：结论→怎么去/路线→真实体验→适合谁/不适合谁→一句收尾。\n- 句子短，像真人发小红书；可少量emoji，不要连续emoji。\n- 不虚构具体价格、营业时间、交通班次、亲身经历或数据；没有的信息宁可不写。\n- 如果选题里承诺“花费”，但用户没提供具体金额，不要在最终标题继续承诺“真实花费”。\n- 如果是 Port Dickson/波德申，优先把标题压成类似“Port Dickson值不值得专程去？”这种20字符内的明确判断题。\n- coverTitle要12-14字内；coverSubtitle要16字内。\n- hashtags只返回数组，不要再重复塞进body；系统会自动拼到正文末尾。\n- 输出严格JSON：title, coverTitle, coverSubtitle, route, body, hashtags。不要markdown。\n\n用户字段：\n目的地：${clean(input.destination)}\n选题：${stripTopic(input.title)}\n内容类型：${clean(input.contentType)}\n路线：${clean(input.route)}\n现有封面主标题：${clean(input.coverTitle)}\n现有封面辅助标题：${clean(input.coverSubtitle)}\n现有正文：${clean(input.body)}\n图片分析摘要：${clean(input.visualNotes)}`

    const response = await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'gpt-5.6',input:prompt,text:{verbosity:'low'}})
    })
    if(!response.ok) return NextResponse.json(fallback)
    const data:any = await response.json()
    const raw = data.output_text || data.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text || ''
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim())
    const title=safeTitle(parsed.title||fallback.title)
    const hashtags=normalizeTags(parsed.hashtags,fallback.title)
    const body=fitBody(String(parsed.body||fallback.body).replace(/(?:\n\s*)?#\S+(?:\s+#\S+)*\s*$/,''),hashtags)
    return NextResponse.json({
      ...fallback,
      ...parsed,
      title,
      coverTitle:cut(String(parsed.coverTitle||fallback.coverTitle),14),
      coverSubtitle:cut(String(parsed.coverSubtitle||fallback.coverSubtitle),18),
      body,
      hashtags,
      source:'openai',
      limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}
    })
  }catch{
    return NextResponse.json(fallback)
  }
}
