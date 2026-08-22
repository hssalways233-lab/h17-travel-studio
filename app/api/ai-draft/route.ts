import { NextResponse } from 'next/server'
import { generateText } from 'ai'

type DraftRequest={destination?:string;title?:string;contentType?:string;route?:string;coverTitle?:string;coverSubtitle?:string;body?:string;visualNotes?:string}

export const maxDuration=60
export const dynamic='force-dynamic'

const TITLE_MAX=20
const BODY_MAX=1000
function clean(v?:string){return (v||'').trim()}
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
function fallbackDraft(input:DraftRequest){
  const destination=clean(input.destination)||'这次旅行'
  const rawTopic=stripTopic(input.title)||`${destination}旅行攻略`
  const route=clean(input.route)
  const isPD=/Port\s*Dickson|波德申/i.test(rawTopic)
  const title=safeTitle(isPD?'Port Dickson值不值得专程去？':rawTopic)
  const coverTitle=cut(clean(input.coverTitle)||(isPD?'Port Dickson值不值得去？':rawTopic),14)
  const coverSubtitle=cut(clean(input.coverSubtitle)||(isPD?'吉隆坡出发｜真实体验':`${destination}真实走过后整理`),18)
  const body=isPD?`先说结论：如果你已经在吉隆坡，想找个不用太折腾、能看海放空的地方，Port Dickson可以列进备选。但如果你是冲着“顶级海岛感”专程过去，预期别拉太高。\n\n我这次最值得参考的是两张真实往返打车截图：路线、实际费用和时间都以图里为准。\n\n现场更像吉隆坡周边的轻度假海边，适合拍照、散步、慢慢待半天到一天。`:''
  const hashtags=normalizeTags(isPD?['#PortDickson','#波德申','#马来西亚旅行','#吉隆坡周边游','#马来西亚自由行']:[],destination)
  return {title,coverTitle,coverSubtitle,route,body:fitBody(body,hashtags),hashtags,source:'smart-fallback',limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}}
}
function cleanJson(raw:string){const s=raw.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();const a=s.indexOf('{'),b=s.lastIndexOf('}');return a>=0&&b>a?s.slice(a,b+1):s}

async function runDraft(model:string,prompt:string){
  const result=await generateText({model,prompt,maxOutputTokens:2600,maxRetries:1,timeout:{totalMs:40000,stepMs:38000}})
  return result.text||''
}

export async function POST(request:Request){
  const input=(await request.json().catch(()=>({}))) as DraftRequest
  const fallback=fallbackDraft(input)
  const prompt=`你是资深小红书旅行编辑。根据真实字段和视觉分析结果，写一篇现在就能发的旅行图文。\n\n硬限制：标题最多20字符；正文+标签最多1000字符；标签5-7个。\n要求：第一段直接给判断；结构为结论→真实往返交通/路线/费用→现场体验→适合谁/不适合谁→收尾；像真人写，避免AI模板话；visualNotes里确认到的金额、币种、时长、起终点必须使用，不能遗漏；没有确认的信息不能编。Port Dickson标题要有明确判断感。coverTitle 12-14字内，coverSubtitle 16字内。只输出JSON：{"title":"","coverTitle":"","coverSubtitle":"","route":"","body":"","hashtags":[""]}\n\n目的地：${clean(input.destination)}\n选题：${stripTopic(input.title)}\n类型：${clean(input.contentType)}\n路线：${clean(input.route)}\n视觉分析：${clean(input.visualNotes)}\n现有正文仅供参考：${clean(input.body)}`

  const attempts:Array<{model:string;error:string}>=[]
  let raw='',usedModel=''
  for(const model of ['openai/gpt-5.6-sol','openai/gpt-5.6-luna']){
    try{raw=await runDraft(model,prompt);if(!raw.trim())throw new Error('模型返回空内容');usedModel=model;break}
    catch(error:any){attempts.push({model,error:String(error?.message||error).slice(0,700)});console.error('ai-draft model failed',model,error)}
  }
  if(!raw)return NextResponse.json({...fallback,error:'draft_models_failed',errorMessage:attempts.map(x=>`${x.model}: ${x.error}`).join(' | ').slice(0,1400),attempts})

  try{
    const parsed=JSON.parse(cleanJson(raw))
    const title=safeTitle(parsed.title||fallback.title)
    const hashtags=normalizeTags(parsed.hashtags,clean(input.destination)||'旅行')
    const rawBody=String(parsed.body||fallback.body).replace(/(?:\n\s*)?#\S+(?:\s+#\S+)*\s*$/,'')
    const body=fitBody(rawBody,hashtags)
    return NextResponse.json({...fallback,...parsed,title,coverTitle:cut(String(parsed.coverTitle||fallback.coverTitle),14),coverSubtitle:cut(String(parsed.coverSubtitle||fallback.coverSubtitle),18),body,hashtags,source:'openai',model:usedModel,limits:{titleMax:TITLE_MAX,bodyMax:BODY_MAX}})
  }catch(error:any){
    return NextResponse.json({...fallback,error:'draft_json_parse_failed',errorMessage:String(error?.message||error).slice(0,700),rawPreview:raw.slice(0,900),model:usedModel})
  }
}
