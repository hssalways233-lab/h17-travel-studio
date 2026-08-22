import { NextResponse } from 'next/server'
import { generateText } from 'ai'

type ImageInput={id:string;url:string;caption?:string}
type PlanRequest={title?:string;destination?:string;contentType?:string;images?:ImageInput[]}
type OverlayPosition='top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'
type PlanItem={id:string;include:boolean;role:string;needsText:boolean;overlayText:string;overlayPosition:OverlayPosition;reason:string;verifiedFacts:string[]}

export const maxDuration=60
export const dynamic='force-dynamic'

function cleanTopic(v=''){return v.replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'').trim()}
function fallback(input:PlanRequest){
  const images=(input.images||[]).slice(0,18)
  const take=Math.min(images.length,Math.max(6,Math.min(9,images.length)))
  const publishIds=images.slice(0,take).map(x=>x.id)
  const roles=['封面','先说结论','路线/交通','环境全景','人物氛围','细节补充','花费/证据','优缺点','结尾']
  const items:PlanItem[]=images.map((x,i)=>({
    id:x.id,include:i<take,role:i<take?(roles[i]||'补充图'):'不发',
    needsText:i<take&&[0,1,2,6,7].includes(i),
    overlayText:i===0?'值不值得专程去？':i===1?'先说结论':i===2?'吉隆坡怎么去':i===6?'真实路线和费用':i===7?'适合谁 / 不适合谁':'',
    overlayPosition:i===0?'top-left':i===1?'top-left':i===2?'top-center':i===6?'top-center':'bottom-left',
    reason:i<take?'规则兜底':'备选',verifiedFacts:[]
  }))
  return {coverId:publishIds[0]||null,publishIds,orderIds:publishIds,reason:'规则兜底，仅在AI不可用时返回。',overlayTitle:'值不值得专程去？',overlaySubtitle:`${input.destination||'这次旅行'} · 路线与真实体验`,items,verifiedFacts:[],source:'smart-fallback'}
}

function buildPrompt(input:PlanRequest){
  return `你是资深小红书旅行视觉编辑。逐张查看这组真实照片并做最终发布方案。重点识别打车/地图/订单截图里的平台、起终点、时长、距离、价格和币种。\n\n要求：\n1. 从全部照片里挑出最值得发的7-10张，不凑数。\n2. 明确封面和完整发图顺序。\n3. 若存在去程和返程打车截图，必须分别识别为“去程路线费用”“返程路线费用”，并把看清的金额、币种、时长、起终点写进 verifiedFacts；看不清绝不猜。\n4. 每张图判断发/不发、角色、是否加字、具体短字和安全位置。\n5. 人物照片绝不重绘、换脸、美化五官或身体；优先原图不加字。\n6. 路线/费用截图不遮核心数字和路线，最多加短标题。\n7. 纯海景、人物氛围、细节照优先原图。\n8. 推荐叙事：封面→结论→去程路线费用→返程路线费用→环境→人物→细节→总结，可按真实素材调整。\n9. 不虚构照片看不到的信息。\n\n选题：${input.title||''}\n目的地：${input.destination||''}\n类型：${input.contentType||''}\n\n只输出JSON，不要markdown：\n{"coverId":"...","publishIds":["..."],"orderIds":["..."],"reason":"...","overlayTitle":"...","overlaySubtitle":"...","verifiedFacts":["..."],"items":[{"id":"...","include":true,"role":"...","needsText":true,"overlayText":"...","overlayPosition":"top-left|top-center|top-right|bottom-left|bottom-center|bottom-right","reason":"...","verifiedFacts":["..."]}]}`
}

function cleanJson(raw:string){
  const trimmed=raw.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim()
  const start=trimmed.indexOf('{'),end=trimmed.lastIndexOf('}')
  return start>=0&&end>start?trimmed.slice(start,end+1):trimmed
}

async function runVision(model:string,input:PlanRequest,images:ImageInput[]){
  const content:any[]=[{type:'text',text:buildPrompt(input)}]
  for(const image of images){
    content.push({type:'text',text:`图片ID：${image.id}；文件名：${image.caption||''}`})
    content.push({type:'image',image:image.url})
  }
  const result=await generateText({
    model,
    messages:[{role:'user',content}],
    maxOutputTokens:5000,
    maxRetries:1,
    timeout:{totalMs:50000,stepMs:48000}
  })
  return {raw:result.text||'',warnings:result.warnings||[]}
}

export async function POST(request:Request){
  const input=(await request.json().catch(()=>({}))) as PlanRequest
  input.title=cleanTopic(input.title||'')
  const base=fallback(input)
  const images=(input.images||[]).slice(0,18)
  if(!images.length)return NextResponse.json({...base,error:'no_images'})

  const attempts:Array<{model:string;error:string}> = []
  let raw='',usedModel=''
  for(const model of ['openai/gpt-5.6-sol','openai/gpt-5.6-luna']){
    try{
      const out=await runVision(model,input,images)
      if(!out.raw.trim())throw new Error('模型返回空内容')
      raw=out.raw;usedModel=model;break
    }catch(error:any){
      attempts.push({model,error:String(error?.message||error||'unknown').slice(0,700)})
      console.error('media-plan model failed',model,error)
    }
  }

  if(!raw){
    return NextResponse.json({...base,error:'vision_models_failed',errorMessage:attempts.map(x=>`${x.model}: ${x.error}`).join(' | ').slice(0,1400),attempts})
  }

  try{
    const parsed=JSON.parse(cleanJson(raw))
    const ids=new Set(images.map(x=>x.id))
    const publishIds=Array.isArray(parsed.publishIds)?parsed.publishIds.filter((id:string)=>ids.has(id)).slice(0,18):base.publishIds
    const orderIds=Array.isArray(parsed.orderIds)?parsed.orderIds.filter((id:string)=>publishIds.includes(id)):publishIds
    const allowedPos=new Set<OverlayPosition>(['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'])
    const parsedItems=Array.isArray(parsed.items)?parsed.items:[]
    const itemMap=new Map(parsedItems.filter((x:any)=>ids.has(x.id)).map((x:any)=>[x.id,x]))
    const items=images.map(image=>{
      const x:any=itemMap.get(image.id)
      const b=base.items.find((y:PlanItem)=>y.id===image.id)!
      if(!x)return b
      const pos=allowedPos.has(x.overlayPosition)?x.overlayPosition:b.overlayPosition
      return {id:image.id,include:publishIds.includes(image.id),role:String(x.role||b.role||'补充图').slice(0,24),needsText:Boolean(x.needsText),overlayText:String(x.overlayText||'').slice(0,36),overlayPosition:pos,reason:String(x.reason||'').slice(0,140),verifiedFacts:Array.isArray(x.verifiedFacts)?x.verifiedFacts.map((v:any)=>String(v).trim()).filter(Boolean).slice(0,8):[]}
    })
    const verifiedFacts=Array.isArray(parsed.verifiedFacts)?parsed.verifiedFacts.map((v:any)=>String(v).trim()).filter(Boolean).slice(0,20):items.flatMap(x=>x.verifiedFacts).slice(0,20)
    return NextResponse.json({...base,...parsed,coverId:ids.has(parsed.coverId)&&publishIds.includes(parsed.coverId)?parsed.coverId:(publishIds[0]||base.coverId),publishIds:publishIds.length?publishIds:base.publishIds,orderIds:orderIds.length?orderIds:(publishIds.length?publishIds:base.orderIds),items,verifiedFacts,source:'openai',model:usedModel,auth:'vercel-ai-sdk-oidc'})
  }catch(error:any){
    console.error('media-plan parse failed',error,raw.slice(0,1000))
    return NextResponse.json({...base,error:'vision_json_parse_failed',errorMessage:String(error?.message||error).slice(0,700),rawPreview:raw.slice(0,900),model:usedModel})
  }
}
