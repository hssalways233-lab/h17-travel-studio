import { NextResponse } from 'next/server'
import { generateText } from 'ai'

type DraftRequest={destination?:string;title?:string;contentType?:string;route?:string;coverTitle?:string;coverSubtitle?:string;body?:string;visualNotes?:string}

export const maxDuration=60
const TITLE_MAX=20
const BODY_MAX=1000
function clean(v?:string){return (v||'').trim()}
function stripTopic(v=''){return clean(v).replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'')}
function cut(v:string,max:number){return Array.from(v).slice(0,max).join('')}
function safeTitle(v:string){return cut(stripTopic(v),TITLE_MAX)}
function normalizeTags(tags:any,destination:string){const base=Array.isArray(tags)?tags.map((x:any)=>String(x).trim()).filter(Boolean):[];const cleaned=base.map(x=>x.startsWith('#')?x:`#${x}`).filter((x,i,a)=>a.indexOf(x)===i).slice(0,7);if(!cleaned.length)cleaned.push(`#${destination.replace(/\s+/g,'')}`,'#马来西亚旅行','#旅行攻略','#自由行');return cleaned}
function fitBody(body:string,tags:string[]){const suffix=tags.length?`\n\n${tags.join(' ')}`:'';const room=Math.max(0,BODY_MAX-Array.from(suffix).length);return cut(body.trim(),room).trim()}

function fallbackDraft(input:DraftRequest){
  const destination=clean(input.destination)||'这次旅行'
  const rawTopic=stripTopic(input.title)||`${destination}旅行攻略`
  const route=clean(input.route)
  const isPD=/Port\s*Dickson|波德申/i.test(rawTopic)
  const title=safeTitle(isPD?'Port Dickson值不值得专程去？':rawTopic)
  const coverTitle=cut(clean(input.coverTitle)||(isPD?'Port Dickson值不值得去？':rawTopic),14)
  const coverSubtitle=cut(clean(input.coverSubtitle)||(isPD?'吉隆坡出发｜真实体验':`${destination}真实走过后整理`),18)
  const body=isPD?'先说结论：如果你已经在吉隆坡，想找一个不用折腾、可以轻松看海放空的地方，Port Dickson值得列进备选；但如果你是冲着“海岛级海水”专程跑一趟，就别把期待拉太满。':'这篇会基于真实照片、路线和能确认的信息整理。'
  const hashtags=normalizeTags(isPD?['#PortDickson','#波德申','#马来西亚旅行','#吉隆坡周边游','#马来西亚自由行']:[],destination)
  return {title,coverTitle,coverSubtitle,route,body:fitBody(body,hashtags),hashtags,source:'smart-fallback',limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}}
}

export async function POST(request:Request){
  const input=(await request.json().catch(()=>({}))) as DraftRequest
  const fallback=fallbackDraft(input)
  try{
    const prompt=`你是资深小红书旅行编辑。请基于用户真实字段和图片分析结果，写一篇“现在就能发”的图文笔记，不要写成AI模板。\n\n平台硬限制：\n- 标题最多20个字符，绝不能超过20。\n- 正文连同#标签总共最多1000字符，目标650-900字符。\n- 标签5-7个，精准，不堆泛标签。\n\n写作要求：\n- 第一段直接给判断/结论。\n- 标题必须有搜索关键词+明确利益点/判断，但不能失实。\n- 结构优先：结论→真实交通/路线与费用→现场体验→适合谁/不适合谁→一句收尾。\n- 句子短，像真人发小红书；可少量emoji。\n- visualNotes里如果已经从图片确认到金额、币种、时长、起终点，必须优先使用这些真实信息。\n- 不虚构价格、时间、交通班次或图片看不到的信息。\n- 如果是 Port Dickson/波德申，标题优先做成20字符内的明确判断题；若图片已确认真实往返费用，正文必须具体写出。\n- coverTitle 12-14字内；coverSubtitle 16字内。\n- hashtags只返回数组，不塞进body。\n- 输出严格JSON：title, coverTitle, coverSubtitle, route, body, hashtags。不要markdown。\n\n用户字段：\n目的地：${clean(input.destination)}\n选题：${stripTopic(input.title)}\n内容类型：${clean(input.contentType)}\n路线：${clean(input.route)}\n现有封面主标题：${clean(input.coverTitle)}\n现有封面辅助标题：${clean(input.coverSubtitle)}\n现有正文：${clean(input.body)}\n图片分析摘要：${clean(input.visualNotes)}`

    const result=await generateText({model:'openai/gpt-5.6-sol',prompt,maxOutputTokens:3200,reasoning:'low'})
    const raw=result.text||''
    if(!raw.trim())return NextResponse.json({...fallback,error:'gateway_empty',errorMessage:'AI Gateway 返回了空内容。'})
    const parsed=JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim())
    const title=safeTitle(parsed.title||fallback.title)
    const hashtags=normalizeTags(parsed.hashtags,clean(input.destination)||'旅行')
    const rawBody=String(parsed.body||fallback.body).replace(/(?:\n\s*)?#\S+(?:\s+#\S+)*\s*$/,'')
    const body=fitBody(rawBody,hashtags)
    return NextResponse.json({...fallback,...parsed,title,coverTitle:cut(String(parsed.coverTitle||fallback.coverTitle),14),coverSubtitle:cut(String(parsed.coverSubtitle||fallback.coverSubtitle),18),body,hashtags,source:'openai',auth:'vercel-ai-sdk-oidc',limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}})
  }catch(error:any){
    console.error('ai-draft AI SDK exception',error)
    return NextResponse.json({...fallback,error:'gateway_exception',errorName:String(error?.name||'Error'),errorMessage:String(error?.message||error||'AI Gateway连接失败').slice(0,800)})
  }
}
