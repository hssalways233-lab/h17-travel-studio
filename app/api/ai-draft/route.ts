import { NextResponse } from 'next/server'

type DraftRequest = {
  destination?: string
  title?: string
  contentType?: string
  route?: string
  coverTitle?: string
  coverSubtitle?: string
  body?: string
}

function clean(v?: string){ return (v || '').trim() }

function fallbackDraft(input: DraftRequest){
  const destination = clean(input.destination) || '这次旅行'
  const topic = clean(input.title) || `${destination}旅行攻略`
  const route = clean(input.route)
  const contentType = clean(input.contentType) || '实用型'
  const coverTitle = clean(input.coverTitle) || topic.replace(/^.*?[｜|]/,'').slice(0,18)
  const coverSubtitle = clean(input.coverSubtitle) || `${destination}真实走过后整理`

  const routeLine = route ? `\n📍路线\n${route}\n` : ''
  const body = `如果你也准备去${destination}，这篇先存下来。\n\n这不是把热门景点全部塞进一天的行程，而是按真实出行逻辑，把“怎么走更顺、哪些地方值得停、哪些坑可以绕开”整理到一起。${routeLine}\n✅ 我会优先看这几件事\n1. 路线是不是顺路，尽量少折返\n2. 时间留出余量，不为了打卡一直赶路\n3. 交通、吃饭和拍照点尽量放在同一条动线上\n4. 真正影响体验的细节，比景点清单更重要\n\n💡适合谁\n第一次去${destination}、时间有限、又不想照着旅游团路线赶场的人。\n\n这篇属于「${contentType}」，后续我会继续把实际走过的路线、花费和踩坑拆开整理。\n\n你更想先看路线、预算还是住宿？`

  return {
    title: topic,
    coverTitle,
    coverSubtitle,
    route,
    body,
    hashtags: [`#${destination}旅行`, '#旅行攻略', '#自由行攻略', '#真实旅行分享', '#周末去哪儿'],
    source: 'smart-fallback'
  }
}

export async function POST(request: Request){
  const input = (await request.json().catch(()=>({}))) as DraftRequest
  const fallback = fallbackDraft(input)
  const apiKey = process.env.OPENAI_API_KEY
  if(!apiKey) return NextResponse.json(fallback)

  try{
    const prompt = `你是小红书旅行内容编辑。请根据用户的真实素材字段，生成一篇可以直接复制发布的小红书旅行笔记。\n\n要求：\n- 不虚构用户没有提供的具体价格、营业时间、交通班次、亲身经历或数据。\n- 风格自然、像真实旅行者，不要AI腔，不要堆夸张形容词。\n- 标题有搜索关键词但不标题党。\n- 正文结构清晰，可使用少量emoji。\n- 输出严格为JSON，不要markdown代码块。\n- JSON字段必须为 title, coverTitle, coverSubtitle, route, body, hashtags。hashtags为字符串数组。\n\n用户字段：\n目的地：${clean(input.destination)}\n选题：${clean(input.title)}\n内容类型：${clean(input.contentType)}\n路线：${clean(input.route)}\n现有封面主标题：${clean(input.coverTitle)}\n现有封面辅助标题：${clean(input.coverSubtitle)}\n现有正文：${clean(input.body)}`

    const response = await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'gpt-5.6',input:prompt,text:{verbosity:'low'}})
    })
    if(!response.ok) return NextResponse.json(fallback)
    const data:any = await response.json()
    const raw = data.output_text || data.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text || ''
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/```$/,'').trim())
    return NextResponse.json({...fallback,...parsed,source:'openai'})
  }catch{
    return NextResponse.json(fallback)
  }
}
