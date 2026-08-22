'use client'

import { Cloud, ShieldCheck } from 'lucide-react'

export default function PrivateMobileStatus(){
  return <>
    <div className="h17MobilePrivateStatus" role="status" aria-label="私人工作区连接状态">
      <div className="h17MobilePrivateIcon"><ShieldCheck size={16}/></div>
      <div className="h17MobilePrivateCopy">
        <b>私人模式已开启</b>
        <span><Cloud size={12}/> 此设备已授权 · 手机 / 电脑同步正常</span>
      </div>
    </div>
    <style>{`
      .h17MobilePrivateStatus{display:none}
      @media(max-width:720px){
        .h17PrivateReady>.h17PrivateBadge{display:none!important}
        .h17MobilePrivateStatus{
          display:flex;align-items:center;gap:10px;position:relative;z-index:35;
          margin:0;padding:10px 16px 11px;background:#edf7f4;border-bottom:1px solid #d5e6e0;
          font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
          color:#285f5b;
        }
        .h17MobilePrivateIcon{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#dff0eb;flex:0 0 auto}
        .h17MobilePrivateCopy{min-width:0;display:grid;gap:2px}
        .h17MobilePrivateCopy b{font-size:12px;line-height:1.25;font-weight:800}
        .h17MobilePrivateCopy span{display:flex;align-items:center;gap:5px;font-size:10px;line-height:1.3;color:#66807a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      }
    `}</style>
  </>
}
