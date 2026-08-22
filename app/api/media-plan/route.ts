import { NextResponse } from 'next/server'

type ImageInput={id:string;url:string;caption?:string}
type PlanRequest={title?:string;destination?:string;contentType?:string;images?:ImageInput[]}
type OverlayPosition='top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'
type PlanItem={id:string;include:boolean;role:string;needsText:boolean;overlayText:string;overlayPosition:OverlayPosition;reason:string;verifiedFacts:string[]}

export const maxDuration=60

function cleanTopic(v=''){return v.replace(/[「」]/g,'').replace(/^下一篇[:：]\s*/,'').trim()}
function fallback(input:PlanRequest){
  const images=(input.images||[]).slice(0,18)
  const take=Math.min(images.length,Math.max(6,Math.min(9,images.length)))
  const publishIds=images.slice(0,take).map(x=>x.id)
  const roles=['封面','先说结论','路线/交通','环境全景','人物氛围','细节补充','花费/证据','优缺点','结尾']
  const items:PlanItem[]=images.map((x,i)=>({
    id:x.id,
    include:i<take,
    role:i<take?(roles[i]||'补充图'):'不发',
    needsText:i<take&&[0,1,2,6,7].includes(i),
    overlayText:i===0?'值不值得专程去？':i===1?'先说结论':i===2?'吉隆坡怎么去':i===6?'真实路线和费用':i===7?'适合谁 / 不适合谁':'',
    overlayPosition:i===0?'top-left':i===1?'top-left':i===2?'top-center':i===6?'top-center':'bottom-left',
    reason:i<take?'先组成一条完整的“判断→路线→体验→证据→总结”叙事':'作为备选，避免同类画面过多',
    verifiedFacts:[]
  }))
  return {
    coverId:publishIds[0]||null,
    publishIds,
    orderIds:publishIds,
    reason:'先保留 6-9 张形成完整叙事；信息截图优先保留原始内容，只加短标题或标注；人物与风景图尽量不加字。',
    overlayTitle:'值不值得专程去？',
    overlaySubtitle:`${input.destination||'这次旅行'} · 路线与真实体验`,
    items,
    verifiedFacts:[],
    source:'smart-fallback'
  }
}

function extractText(data:any){
  const c=data?.choices?.[0]?.message?.content
  if(typeof c==='string')return c
  if(Array.isArray(c))return c.map((x:any)=>x?.text||x?.content||'').join('')
  return ''
}

export async function POST(request:Request){
  const input=(await request.json().catch(()=>({}))) as PlanRequest
  input.title=cleanTopic(input.title||'')
  const base=fallback(input)
  const images=(input.images||[]).slice(0,18)
  if(!images.length)return NextResponse.json({...base,error:'no_images'})

  const gatewayToken=process.env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN
  if(!gatewayToken){
    return NextResponse.json({...base,error:'missing_gateway_auth',errorMessage:'Vercel Function 没有收到 OIDC 令牌。'})
  }

  try{
    const prompt=`你是资深小红书旅行视觉编辑。请逐张认真看这组真实照片，做“最终可发布成片方案”。尤其要识别截图里的路线、打车平台、起终点、时长、距离、价格/币种等可以直接读到的证据。不要因为图片是截图就把它当普通配图。\n\n任务：\n1. 从全部照片里挑出最值得发的 7-10 张；不要为了凑数放重复/弱图。\n2. 明确第1张封面，以及完整发图顺序。\n3. 如果有去程和返程打车/地图/订单截图，必须优先识别并分别安排为“去程路线费用”“返程路线费用”或同等准确角色；把截图中能清楚读到的真实金额、币种、时长、起终点整理进 verifiedFacts。看不清就不要猜。\n4. 对每张图判断：发 / 不发、承担什么角色、是否需要加字、具体加什么短字，以及文字放哪块安全区域。\n5. 绝对不要修改、重绘或美化人物脸和身体。人物图优先原图不加字；如果必须加字，避开人物头脸和主体。\n6. 路线/费用截图不要遮住核心数字和路线；最多加一个顶部/底部短标题。原截图里的数字就是证据，不能改。\n7. 纯海景、人物氛围、细节照优先原图；封面、结论、路线/费用、优缺点总结才考虑加字。\n8. 顺序优先：封面→结论→去程路线费用→返程路线费用→环境→人物→细节→总结。根据真实素材灵活调整。\n9. 不虚构照片看不到的信息。\n\n选题：${input.title||''}\n目的地：${input.destination||''}\n内容类型：${input.contentType||''}\n\n严格输出JSON，不要markdown：\n{\n  "coverId":"...",\n  "publishIds":["..."],\n  "orderIds":["..."],\n  "reason":"整体选片逻辑",\n  "overlayTitle":"封面主字，尽量12字内",\n  "overlaySubtitle":"封面副字，尽量16字内",\n  "verifiedFacts":["只能写从图片清楚读到的事实"],\n  "items":[{\n    "id":"...",\n    "include":true,\n    "role":"封面/去程路线费用/返程路线费用/环境/人物等",\n    "needsText":true,\n    "overlayText":"短字；不加字为空",\n    "overlayPosition":"top-left|top-center|top-right|bottom-left|bottom-center|bottom-right",\n    "reason":"为什么这样处理",\n    "verifiedFacts":["本图清楚读到的事实"]\n  }]\n}`

    const content:any[]=[{type:'text',text:prompt}]
    for(const image of images){
      content.push({type:'text',text:`图片ID：${image.id}；文件名：${image.caption||''}`})
      content.push({type:'image_url',image_url:{url:image.url,detail:'high'}})
    }

    const response=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${gatewayToken}`},
      body:JSON.stringify({
        model:'openai/gpt-5.6-sol',
        messages:[{role:'user',content}],
        max_completion_tokens:6000,
        stream:false
      })
    })
    if(!response.ok){
      const detail=await response.text().catch(()=> '')
      console.error('media-plan gateway HTTP error',response.status,detail.slice(0,800))
      return NextResponse.json({...base,error:`gateway_http_${response.status}`,errorMessage:detail.slice(0,500)})
    }

    const data:any=await response.json()
    const raw=extractText(data)
    if(!raw.trim())return NextResponse.json({...base,error:'gateway_empty',errorMessage:'AI Gateway 返回了空内容。'})
    const parsed=JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim())
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
      return {
        id:image.id,
        include:publishIds.includes(image.id),
        role:String(x.role||b.role||'补充图').slice(0,24),
        needsText:Boolean(x.needsText),
        overlayText:String(x.overlayText||'').slice(0,36),
        overlayPosition:pos,
        reason:String(x.reason||'').slice(0,140),
        verifiedFacts:Array.isArray(x.verifiedFacts)?x.verifiedFacts.map((v:any)=>String(v).trim()).filter(Boolean).slice(0,8):[]
      }
    })
    const verifiedFacts=Array.isArray(parsed.verifiedFacts)?parsed.verifiedFacts.map((v:any)=>String(v).trim()).filter(Boolean).slice(0,20):items.flatMap(x=>x.verifiedFacts).slice(0,20)
    return NextResponse.json({
      ...base,
      ...parsed,
      coverId:ids.has(parsed.coverId)&&publishIds.includes(parsed.coverId)?parsed.coverId:(publishIds[0]||base.coverId),
      publishIds:publishIds.length?publishIds:base.publishIds,
      orderIds:orderIds.length?orderIds:(publishIds.length?publishIds:base.orderIds),
      items,
      verifiedFacts,
      source:'openai',
      auth:process.env.AI_GATEWAY_API_KEY?'gateway-key':'vercel-oidc'
    })
  }catch(error:any){
    console.error('media-plan gateway exception',error)
    return NextResponse.json({...base,error:'gateway_exception',errorMessage:String(error?.message||'AI Gateway连接失败').slice(0,500)})
  }
}
