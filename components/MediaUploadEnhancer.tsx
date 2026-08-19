'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type MediaRow = {
  id:string
  storage_path:string
  caption:string|null
  created_at:string
}

function safeName(name:string){
  const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
  const base = name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48) || 'image'
  return `${base}${ext.toLowerCase()}`
}

export default function MediaUploadEnhancer(){
  useEffect(()=>{
    const supabase = createClient()
    let currentSelect: HTMLSelectElement | null = null
    let disposed = false

    const getTopicId = () => {
      const select = document.querySelector('.workflowBar select') as HTMLSelectElement | null
      return select?.value || ''
    }

    const setStatus = (box:HTMLElement, text:string, tone:'normal'|'busy'|'error'='normal') => {
      let status = box.querySelector('.uploadLiveStatus') as HTMLElement | null
      if(!status){
        status = document.createElement('small')
        status.className = 'uploadLiveStatus'
        box.appendChild(status)
      }
      status.textContent = text
      status.dataset.tone = tone
    }

    const renderMedia = async (box:HTMLElement, topicId:string) => {
      const panel = box.closest('.mediaPanel') as HTMLElement | null
      if(!panel || !topicId) return
      let grid = panel.querySelector('.mediaUploadGrid') as HTMLElement | null
      if(!grid){
        grid = document.createElement('div')
        grid.className = 'mediaUploadGrid'
        box.insertAdjacentElement('afterend', grid)
      }
      grid.innerHTML = '<div class="mediaLoading">正在读取云端图片…</div>'

      const {data:rows,error} = await supabase.from('materials')
        .select('id,storage_path,caption,created_at')
        .contains('tags',[`topic:${topicId}`])
        .order('created_at',{ascending:true})

      if(error){
        grid.innerHTML = ''
        return
      }
      const media = (rows || []) as MediaRow[]
      if(!media.length){
        grid.innerHTML = ''
        return
      }

      const cards:string[] = []
      for(let i=0;i<media.length;i++){
        const row = media[i]
        const {data:signed} = await supabase.storage.from('travel-media').createSignedUrl(row.storage_path, 60*60*24*7)
        if(signed?.signedUrl){
          cards.push(`<div class="mediaThumb"><img src="${signed.signedUrl}" alt="旅行素材 ${i+1}"><span>${String(i+1).padStart(2,'0')}</span></div>`)
        }
      }
      grid.innerHTML = cards.join('')
    }

    const uploadFiles = async (box:HTMLElement, files:FileList|File[]) => {
      const list = Array.from(files).filter(f=>f.type.startsWith('image/'))
      if(!list.length) return
      const topicId = getTopicId()
      if(!topicId){
        setStatus(box,'请先在右上方选择一篇内容。','error')
        return
      }
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){
        setStatus(box,'请先登录后再上传。','error')
        return
      }

      const {data:topic,error:topicError} = await supabase.from('topics').select('id,destination,title').eq('id',topicId).single()
      if(topicError || !topic){
        setStatus(box,'没有找到当前选题，请刷新后重试。','error')
        return
      }
      const {data:destination} = await supabase.from('destinations').select('id').eq('name',topic.destination).limit(1).maybeSingle()

      box.classList.add('uploading')
      setStatus(box,`正在上传 0 / ${list.length}…`,'busy')
      let success = 0

      for(let i=0;i<list.length;i++){
        const file = list[i]
        if(file.size > 25 * 1024 * 1024){
          setStatus(box,`${file.name} 超过 25MB，已跳过。`,'error')
          continue
        }
        const path = `${user.id}/${topicId}/${Date.now()}-${i}-${safeName(file.name)}`
        const {error:uploadError} = await supabase.storage.from('travel-media').upload(path,file,{
          cacheControl:'3600', upsert:false, contentType:file.type
        })
        if(uploadError){
          box.classList.remove('uploading')
          const bucketMissing = /bucket/i.test(uploadError.message) && /not found|does not exist/i.test(uploadError.message)
          setStatus(box,bucketMissing?'图片存储空间还没初始化，需要先创建 travel-media。':`上传失败：${uploadError.message}`,'error')
          return
        }
        const {error:dbError} = await supabase.from('materials').insert({
          user_id:user.id,
          destination_id:destination?.id || null,
          storage_path:path,
          media_type:'image',
          tags:[`topic:${topicId}`,topic.destination],
          caption:file.name
        })
        if(dbError){
          await supabase.storage.from('travel-media').remove([path])
          setStatus(box,`保存图片记录失败：${dbError.message}`,'error')
          box.classList.remove('uploading')
          return
        }
        success++
        setStatus(box,`正在上传 ${success} / ${list.length}…`,'busy')
      }

      box.classList.remove('uploading')
      setStatus(box,`已上传 ${success} 张 · 已保存云端，手机电脑同步`,'normal')
      await renderMedia(box,topicId)
    }

    const enhance = () => {
      if(disposed) return
      const box = document.querySelector('.uploadBox') as HTMLElement | null
      if(!box) return
      if(box.dataset.smartUpload !== '1'){
        box.dataset.smartUpload = '1'
        box.classList.add('smartUpload')
        box.setAttribute('role','button')
        box.setAttribute('tabindex','0')
        const title = box.querySelector('b')
        const subtitle = box.querySelector('span')
        if(title) title.textContent = '点击上传旅行素材'
        if(subtitle) subtitle.textContent = '支持多选 / 拖拽上传 · 自动保存云端'

        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = true
        input.className = 'smartUploadInput'
        box.appendChild(input)

        const openPicker = (event?:Event) => {
          if(event) event.preventDefault()
          if(box.classList.contains('uploading')) return
          input.click()
        }
        box.addEventListener('click',openPicker)
        box.addEventListener('keydown',(e:KeyboardEvent)=>{
          if(e.key==='Enter' || e.key===' ') openPicker(e)
        })
        input.addEventListener('click',e=>e.stopPropagation())
        input.addEventListener('change',async()=>{
          if(input.files?.length) await uploadFiles(box,input.files)
          input.value=''
        })
        box.addEventListener('dragover',e=>{e.preventDefault();box.classList.add('dragging')})
        box.addEventListener('dragleave',()=>box.classList.remove('dragging'))
        box.addEventListener('drop',async e=>{
          e.preventDefault();box.classList.remove('dragging')
          if(e.dataTransfer?.files?.length) await uploadFiles(box,e.dataTransfer.files)
        })
        setStatus(box,'选择当前内容后，图片会自动归档到对应目的地。')
      }

      const select = document.querySelector('.workflowBar select') as HTMLSelectElement | null
      if(select && select !== currentSelect){
        if(currentSelect) currentSelect.removeEventListener('change',onTopicChange)
        currentSelect = select
        currentSelect.addEventListener('change',onTopicChange)
      }
      const topicId = getTopicId()
      if(topicId) renderMedia(box,topicId)
    }

    const onTopicChange = () => {
      const box = document.querySelector('.uploadBox') as HTMLElement | null
      if(box) {
        setTimeout(()=>renderMedia(box,getTopicId()),50)
        setStatus(box,'已切换内容，上传图片会自动归档到当前选题。')
      }
    }

    const observer = new MutationObserver(()=>enhance())
    observer.observe(document.body,{childList:true,subtree:true})
    enhance()

    return ()=>{
      disposed = true
      observer.disconnect()
      if(currentSelect) currentSelect.removeEventListener('change',onTopicChange)
    }
  },[])

  return null
}
