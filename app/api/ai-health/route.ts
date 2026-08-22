import { generateText } from 'ai'

export const dynamic='force-dynamic'
export const maxDuration=30

export async function GET(request:Request){
  const oidcHeader=request.headers.get('x-vercel-oidc-token')
  const info:any={
    ok:false,
    gatewayModel:'openai/gpt-5.6-sol',
    hasOidcHeader:Boolean(oidcHeader),
    hasGatewayKey:Boolean(process.env.AI_GATEWAY_API_KEY),
    vercel:Boolean(process.env.VERCEL),
  }
  try{
    const result=await generateText({
      model:'openai/gpt-5.6-sol',
      prompt:'Reply with exactly: H17_AI_OK',
      maxOutputTokens:32,
      reasoning:'minimal',
    })
    info.ok=result.text.trim().includes('H17_AI_OK')
    info.text=result.text.trim().slice(0,80)
  }catch(error:any){
    info.errorName=String(error?.name||'Error')
    info.errorMessage=String(error?.message||error||'Unknown error').slice(0,800)
    info.cause=String(error?.cause?.message||error?.cause||'').slice(0,500)
  }
  return Response.json(info,{headers:{'Cache-Control':'no-store'}})
}
