import { NextResponse } from 'next/server'

type ImageInput={id:string;url:string;caption?:string}
type PlanRequest={title?:string;destination?:string;contentType?:string;images?:ImageInput[]}
type PlanItem={id:string;include:boolean;role:string;needsText:boolean;overlayText:string;reason:string}

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
    overlayText:i===0?'值不值得专程去？':i===1?'先说结论':i===2?'吉隆坡怎么去':i===6?'这趟怎么花':i===7?'优点 / 缺点':'',
    reason:i<take?'先组成一条完整的“决策→路线→体验→总结”叙事':'作为备选，避免同类画面过多'
  }))
  return {
    coverId:publishIds[0]||null,
    publishIds,
    orderIds:publishIds,
    reason:'先保留 6-9 张形成完整叙事；只有信息图、路线、结论和总结页加字，纯景色/人物图尽量保留原图。',
    overlayTitle:'值不值得专程去？',
    overlaySubtitle:`${input.destination||'这次旅行'} · 真实体验`,
    items,
    source:'smart-fallback'
  }
}

export async function POST(request:Request){
  const input=(await request.json().catch(()=>({}))) as PlanRequest
  input.title=cleanTopic(input.title||'')
  const base=fallback(input)
  const apiKey=process.env.OPENAI_API_KEY
  const images=(input.images||[]).slice(0,18)
  if(!apiKey||!images.length)return NextResponse.json(base)

  try{
    const content:any[]=[{type:'input_text',text:`你是资深小红书旅行视觉编辑。请直接从这组真实照片里做“可发布成片方案”，不是泛泛建议。\n\n任务：\n1. 从全部照片里挑出最值得发的 7-10 张；照片不足时可少于7张，但不要为凑数放重复/弱图。\n2. 明确第1张封面，以及完整发图顺序。\n3. 对每张图判断：发 / 不发、承担什么角色、是否需要加字、具体加什么字。\n4. 只有封面、结论、路线/交通、花费/证据、优缺点总结这类信息图建议加字；纯海景、人物氛围、细节照优先原图，不要每张都加字。\n5. 避免相似角度重复；优先主体清楚、人物状态自然、目的地识别度高、构图干净、适合手机竖屏阅读的图。\n6. 顺序优先：封面→先说结论→路线/交通→环境→人物→细节→花费/证据→优缺点→结尾。根据实际照片可调整，不要硬套。\n7. 不虚构照片看不到的信息；如果没有花费截图/交通截图，不要假装有。\n\n选题：${input.title||''}\n目的地：${input.destination||''}\n内容类型：${input.contentType||''}\n\n严格输出JSON，不要markdown：\n{\n  "coverId":"...",\n  "publishIds":["..."],\n  "orderIds":["..."],\n  "reason":"整体选片逻辑",\n  "overlayTitle":"封面主字，尽量12字内",\n  "overlaySubtitle":"封面副字，尽量16字内",\n  "items":[{"id":"...","include":true,"role":"封面/路线/环境等","needsText":true,"overlayText":"要加的短字；不加字则空字符串","reason":"为什么这样处理"}]\n}`}]
    for(const image of images){
      content.push({type:'input_text',text:`图片ID：${image.id}；文件名：${image.caption||''}`})
      content.push({type:'input_image',image_url:image.url})
    }
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'gpt-5.6',input:[{role:'user',content}],text:{verbosity:'low'}})
    })
    if(!response.ok)return NextResponse.json(base)
    const data:any=await response.json()
    const raw=data.output_text||data.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text||''
    const parsed=JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim())
    const ids=new Set(images.map(x=>x.id))
    const publishIds=Array.isArray(parsed.publishIds)?parsed.publishIds.filter((id:string)=>ids.has(id)).slice(0,18):base.publishIds
    const orderIds=Array.isArray(parsed.orderIds)?parsed.orderIds.filter((id:string)=>publishIds.includes(id)):publishIds
    const parsedItems=Array.isArray(parsed.items)?parsed.items:[]
    const itemMap=new Map(parsedItems.filter((x:any)=>ids.has(x.id)).map((x:any)=>[x.id,x]))
    const items=images.map(image=>{
      const x:any=itemMap.get(image.id)
      return x?{
        id:image.id,
        include:publishIds.includes(image.id),
        role:String(x.role||'补充图').slice(0,20),
        needsText:Boolean(x.needsText),
        overlayText:String(x.overlayText||'').slice(0,30),
        reason:String(x.reason||'').slice(0,120)
      }:base.items.find((y:PlanItem)=>y.id===image.id)
    }).filter(Boolean)
    return NextResponse.json({
      ...base,
      ...parsed,
      coverId:ids.has(parsed.coverId)&&publishIds.includes(parsed.coverId)?parsed.coverId:(publishIds[0]||base.coverId),
      publishIds:publishIds.length?publishIds:base.publishIds,
      orderIds:orderIds.length?orderIds:(publishIds.length?publishIds:base.orderIds),
      items,
      source:'openai'
    })
  }catch{
    return NextResponse.json(base)
  }
}
