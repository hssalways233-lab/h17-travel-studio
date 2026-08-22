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

export const maxDuration=60

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
  return cut(body.trim(),room).trim()
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
    body=`先说结论：如果你已经在吉隆坡，想找一个不用折腾转机、可以轻松看海放空的地方，Port Dickson值得列进备选；但如果你是冲着“海岛级海水”专程跑一趟，就别把期待拉太满。\n\n🚗 怎么去\n这次路线是：${routeText}。它最大的优势不是“海有多惊艳”，而是离吉隆坡相对近，周末临时想换个场景也比较好安排。\n\n🌊 到底值不值得？\n我更愿意把它理解成“吉隆坡周边的轻度假海边”，而不是必打卡景点。适合慢慢走、看看海、拍几张照片、吃顿饭；如果你的马来西亚行程已经很满，它不是非去不可。\n\n📌 更适合\n• 已经在吉隆坡，想安排半天/一天周边游\n• 不想赶景点，想轻松一点\n• 对“方便、放空”比“顶级海景”更看重\n\n不太适合：时间很紧、只想看最惊艳海景的人。`
  }else{
    const routeLine = route ? `\n\n📍路线\n${route}` : ''
    body=`先说结论：这篇不是景点清单，而是把这次旅行里真正会影响体验的部分先讲清楚。${routeLine}\n\n我更想解决三个问题：\n① 到底值不值得去\n② 怎么走最省时间\n③ 哪些细节出发前知道更有用\n\n如果你也是第一次去${destination}，先看结论和路线，再决定哪些地方值得放进自己的行程。\n\n这篇属于「${contentType}」，尽量用真实照片和能确认的信息说话，不把行程写成模板。`
  }
  const hashtags=normalizeTags(isPD?['#PortDickson','#波德申','#马来西亚旅行','#吉隆坡周边游','#马来西亚自由行']:[],destination)
  return {title,coverTitle,coverSubtitle,route,body:fitBody(body,hashtags),hashtags,source:'smart-fallback',limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}}
}

function extractText(data:any){
  const c=data?.choices?.[0]?.message?.content
  if(typeof c==='string')return c
  if(Array.isArray(c))return c.map((x:any)=>x?.text||x?.content||'').join('')
  return ''
}

export async function POST(request: Request){
  const input = (await request.json().catch(()=>({}))) as DraftRequest
  const fallback = fallbackDraft(input)
  const gatewayToken=process.env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN
  if(!gatewayToken)return NextResponse.json({...fallback,error:'missing_gateway_auth',errorMessage:'Vercel Function 没有收到 OIDC 令牌。'})

  try{
    const prompt = `你是资深小红书旅行编辑。请基于用户真实字段和图片分析结果，写一篇“现在就能发”的图文笔记，不要写成AI模板。\n\n平台硬限制：\n- 标题最多20个字符（中文、英文、空格、标点都按字符看待），绝不能超过20。\n- 正文连同#标签总共最多1000字符，目标650-900字符。\n- 标签5-7个，精准，不堆泛标签。\n\n写作要求：\n- 第一段直接给判断/结论。\n- 标题必须有搜索关键词+明确利益点/判断，但不能失实。\n- 结构优先：结论→真实交通/路线与费用→现场体验→适合谁/不适合谁→一句收尾。\n- 句子短，像真人发小红书；可少量emoji。\n- visualNotes里如果已经从图片确认到金额、币种、时长、起终点，必须优先使用这些真实信息；不要丢掉。\n- 不虚构价格、时间、交通班次或图片看不到的信息。\n- 如果是 Port Dickson/波德申，标题优先做成20字符内的明确判断题；若图片已确认真实往返费用，正文必须具体写出。\n- coverTitle 12-14字内；coverSubtitle 16字内。\n- hashtags只返回数组，不塞进body。\n- 输出严格JSON：title, coverTitle, coverSubtitle, route, body, hashtags。不要markdown。\n\n用户字段：\n目的地：${clean(input.destination)}\n选题：${stripTopic(input.title)}\n内容类型：${clean(input.contentType)}\n路线：${clean(input.route)}\n现有封面主标题：${clean(input.coverTitle)}\n现有封面辅助标题：${clean(input.coverSubtitle)}\n现有正文：${clean(input.body)}\n图片分析摘要：${clean(input.visualNotes)}`

    const response=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${gatewayToken}`},
      body:JSON.stringify({
        model:'openai/gpt-5.6-sol',
        messages:[{role:'user',content:prompt}],
        max_completion_tokens:3200,
        stream:false
      })
    })
    if(!response.ok){
      const detail=await response.text().catch(()=> '')
      console.error('ai-draft gateway HTTP error',response.status,detail.slice(0,800))
      return NextResponse.json({...fallback,error:`gateway_http_${response.status}`,errorMessage:detail.slice(0,500)})
    }
    const data:any=await response.json()
    const raw=extractText(data)
    if(!raw.trim())return NextResponse.json({...fallback,error:'gateway_empty',errorMessage:'AI Gateway 返回了空内容。'})
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim())
    const title=safeTitle(parsed.title||fallback.title)
    const hashtags=normalizeTags(parsed.hashtags,clean(input.destination)||'旅行')
    const rawBody=String(parsed.body||fallback.body).replace(/(?:\n\s*)?#\S+(?:\s+#\S+)*\s*$/,'')
    const body=fitBody(rawBody,hashtags)
    return NextResponse.json({
      ...fallback,
      ...parsed,
      title,
      coverTitle:cut(String(parsed.coverTitle||fallback.coverTitle),14),
      coverSubtitle:cut(String(parsed.coverSubtitle||fallback.coverSubtitle),18),
      body,
      hashtags,
      source:'openai',
      auth:process.env.AI_GATEWAY_API_KEY?'gateway-key':'vercel-oidc',
      limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}
    })
  }catch(error:any){
    console.error('ai-draft gateway exception',error)
    return NextResponse.json({...fallback,error:'gateway_exception',errorMessage:String(error?.message||'AI Gateway连接失败').slice(0,500)})
  }
}
