import { NextResponse } from 'next/server'

type ImageInput={id:string;url:string;caption?:string}
type PlanRequest={title?:string;destination?:string;contentType?:string;images?:ImageInput[]}

function fallback(input:PlanRequest){
  const images=input.images||[]
  return {
    coverId:images[0]?.id||null,
    orderIds:images.map(x=>x.id),
    reason:'先按上传顺序整理；图1优先使用第一张主视觉，后续可在内容页手动调整。',
    overlayTitle:(input.title||`${input.destination||''}旅行攻略`).replace(input.destination||'','').trim().slice(0,14)||`${input.destination||'旅行'}攻略`,
    overlaySubtitle:`${input.destination||'这次旅行'} · 真实旅行整理`,
    notes:images.map((x,i)=>({id:x.id,note:i===0?'优先作为图1候选':'按叙事顺序承接'})),
    source:'smart-fallback'
  }
}

export async function POST(request:Request){
  const input=(await request.json().catch(()=>({}))) as PlanRequest
  const base=fallback(input)
  const apiKey=process.env.OPENAI_API_KEY
  const images=(input.images||[]).slice(0,10)
  if(!apiKey||!images.length)return NextResponse.json(base)

  try{
    const content:any[]=[{type:'input_text',text:`你是旅行小红书视觉编辑。请根据这些真实照片判断：1) 哪张最适合图1/封面；2) 1-10张的叙事顺序；3) 封面主标题和副标题。\n要求：不虚构照片里看不到的信息；优先人物/地标清楚、主体明确、适合手机竖屏封面的照片；顺序要有开场-路线/场景-细节-收尾。\n选题：${input.title||''}\n目的地：${input.destination||''}\n内容类型：${input.contentType||''}\n严格输出JSON：coverId, orderIds, reason, overlayTitle, overlaySubtitle, notes。notes为[{id,note}]。`}]
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
    const orderIds=Array.isArray(parsed.orderIds)?parsed.orderIds.filter((id:string)=>ids.has(id)):base.orderIds
    return NextResponse.json({...base,...parsed,coverId:ids.has(parsed.coverId)?parsed.coverId:base.coverId,orderIds:orderIds.length?orderIds:base.orderIds,source:'openai'})
  }catch{
    return NextResponse.json(base)
  }
}
