"use client"
import React, { useEffect, useRef, useState } from 'react'
import './styles.css'
import './card-polish.css'

type TemplateId='romantic'|'cute'|'friend'|'elegant'|'funny'|'minimal'|'cinematic'|'party'
type CardData={recipient:string;message:string;sender:string;photos:string[];music?:string;musicName?:string;template:TemplateId}
const templates:{id:TemplateId;name:string;tag:string;emoji:string;className:string;premium?:boolean;price?:number}[]=[
 {id:'romantic',name:'Romantic',tag:'for your person',emoji:'♥',className:'rose',premium:true,price:49}, {id:'cute',name:'Cute',tag:'extra sweet',emoji:'✿',className:'peach'},
 {id:'friend',name:'Best Friend',tag:'the real one',emoji:'✦',className:'sky'}, {id:'elegant',name:'Elegant',tag:'timeless wishes',emoji:'✧',className:'ink'},
 {id:'funny',name:'Funny',tag:'older, not wiser',emoji:'☻',className:'lime'}, {id:'minimal',name:'Minimal',tag:'simply lovely',emoji:'○',className:'sand'},
 {id:'cinematic',name:'Cinematic',tag:'main character day',emoji:'✺',className:'night',premium:true,price:49}, {id:'party',name:'Party',tag:'make some noise',emoji:'★',className:'party'}]
const sample:CardData={recipient:'Maya',message:'Here’s to a year full of bright little moments, brave choices, and reasons to laugh until it hurts.',sender:'With all my love, Rhea',photos:['https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=85','https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=700&q=85'],template:'romantic'}
const getTemplate=(id:TemplateId)=>templates.find(x=>x.id===id)!
function Brand(){return <a className="brand" href="/" onClick={e=>{e.preventDefault();navigate('/')}}><span>✦</span> wishwell</a>}
function navigate(path:string){history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))}
function Button({children,onClick,variant='dark',type='button',disabled=false}:{children:React.ReactNode;onClick?:()=>void;variant?:string;type?:'button'|'submit';disabled?:boolean}){return <button type={type} className={'button '+variant} onClick={onClick} disabled={disabled}>{children}</button>}
function Nav(){return <nav><Brand/><div className="navlinks"><a href="/#how">How it works</a><a href="/templates" onClick={e=>{e.preventDefault();navigate('/templates')}}>Templates</a></div><Button onClick={()=>navigate('/templates')}>Create a card <b>→</b></Button></nav>}
function MiniCard({t}: {t:typeof templates[number]}){return <div className={'mini-card '+t.className}>{t.premium&&<b className="premium-badge">PREMIUM</b>}<i>{t.emoji}</i><small>happy birthday</small><strong>for you</strong><em>made with love</em></div>}
function Landing(){return <><Nav/><main><section className="hero"><div className="eyebrow">A LITTLE MAGIC, MADE PERSONAL</div><h1>Make their birthday<br/><i>unforgettable.</i></h1><p>Create a beautiful, personal birthday card with photos, music and a message they’ll want to keep.</p><div className="hero-actions"><Button onClick={()=>navigate('/templates')}>Create a birthday card <b>→</b></Button><a href="#templates" className="text-link">Explore templates <b>↓</b></a></div><div className="hero-note"><span>✦</span> Free forever. No account needed.</div><div className="hero-card-wrap"><div className="sun"></div><div className="scribble one">made just<br/>for them ↘</div><div className="floating-star">✦</div><CardPreview data={sample} hero/></div></section>
<section className="template-section" id="templates"><div className="section-head"><div><span className="eyebrow">CHOOSE A FEELING</span><h2>There’s a card for<br/><i>every kind of love.</i></h2></div><Button variant="outline" onClick={()=>navigate('/templates')}>See all templates <b>→</b></Button></div><div className="template-grid">{templates.slice(0,4).map(t=><button className="template-tile" key={t.id} onClick={()=>navigate('/create/'+t.id)}><MiniCard t={t}/><span><strong>{t.name}</strong><small>{t.tag}</small></span></button>)}</div></section>
<section className="how" id="how"><span className="eyebrow">EASY AS 1, 2, 3</span><h2>A little love goes<br/>a <i>long</i> way.</h2><div className="steps"><article><b>01</b><span>✦</span><h3>Pick a feeling</h3><p>Choose a design that sounds like you two.</p></article><article><b>02</b><span>♡</span><h3>Make it personal</h3><p>Add your words, favorite photos, and a song.</p></article><article><b>03</b><span>↗</span><h3>Send some joy</h3><p>Share one special link. No app required.</p></article></div></section>
<section className="closing"><p>THE BEST GIFTS ARE THE ONES THAT FEEL LIKE YOU.</p><h2>Ready to make<br/>someone <i>smile?</i></h2><Button onClick={()=>navigate('/templates')}>Start creating <b>→</b></Button></section></main><footer><Brand/><span>Made for sweet moments.</span><span>© Wishwell</span></footer></>}
function CardPreview({data,hero=false,open=true}:{data:CardData;hero?:boolean;open?:boolean}){const t=getTemplate(data.template);return <div className={'card-preview '+t.className+(hero?' hero-preview':'')+(open?'':' closed')}><div className="card-decor d1">{t.emoji}</div><div className="card-decor d2">✦</div>{data.photos[0]&&<img className="card-photo main-photo" src={data.photos[0]} alt="Birthday memory"/>}{data.photos[1]&&<img className="card-photo second-photo" src={data.photos[1]} alt="Birthday memory"/>}<div className="card-content"><span>happy birthday</span><h3>{data.recipient||'Your favorite human'}</h3><p>{data.message||'A little note to make your day brighter.'}</p><small>{data.sender||'With love'}</small></div></div>}
function Templates(){return <><Nav/><main className="gallery"><div className="gallery-title"><span className="eyebrow">PICK YOUR MOOD</span><h1>Start with a<br/><i>feeling.</i></h1><p>Every design has its own little personality. Choose the one that feels most like them.</p></div><div className="all-templates">{templates.map(t=><button className="template-tile big" key={t.id} onClick={()=>navigate('/create/'+t.id)}><MiniCard t={t}/><span><strong>{t.name}</strong><small>{t.tag}</small><b>Create this card →</b></span></button>)}</div></main></>}
function Editor({template}:{template:TemplateId}){
const [data,setData]=useState<CardData>({...sample,template,photos:[]});
const [photoFiles,setPhotoFiles]=useState<File[]>([]);
const [music,setMusic]=useState<File>();
const [saving,setSaving]=useState(false);
const [error,setError]=useState('');
const photoRef=useRef<HTMLInputElement>(null);
const musicRef=useRef<HTMLInputElement>(null);
const update=(key:keyof CardData,value:string)=>setData(d=>({...d,[key]:value}));
const addPhotos=(files:FileList|null)=>{
 if(!files)return;
 const remaining=5-data.photos.length;
 const accepted=Array.from(files).filter(file=>file.type.match(/^image\/(jpeg|png|webp)$/)&&file.size<=5_000_000).slice(0,remaining);
 setPhotoFiles(current=>[...current,...accepted]);
 setData(current=>({...current,photos:[...current.photos,...accepted.map(file=>URL.createObjectURL(file))]}));
};
const create=async()=>{
 if(saving)return;
 if(!data.recipient.trim()){setError('Add the birthday person’s name first.');return}
 const chosen=getTemplate(template);
 setSaving(true);
 setError('');
 try{
  const form=new FormData();
  form.set('template',template);
  form.set('recipient',data.recipient);
  form.set('message',data.message);
  form.set('sender',data.sender);
  photoFiles.forEach(file=>form.append('photos',file));
  if(music)form.set('music',music);
  const response=await fetch('/api/cards',{method:'POST',body:form});
  const result: {id?:string;premium?:boolean;error?:string}=await response.json();
  if(!response.ok||!result.id)throw new Error(result.error||'We could not save your card. Please try again.');
  if(result.premium){window.location.assign('/payment/'+template+'?card='+encodeURIComponent(result.id));return}
  navigate('/share/'+result.id);
 }catch(cause){
  setError(cause instanceof Error?cause.message:'We could not save your card. Please try again.');
 }finally{
  setSaving(false);
 }
};
const removePhoto=(index:number)=>{
 setPhotoFiles(current=>current.filter((_,i)=>i!==index));
 setData(current=>({...current,photos:current.photos.filter((_,i)=>i!==index)}));
};
return <><Nav/><main className="editor"><section className="edit-panel"><button className="back" onClick={()=>navigate('/templates')}>← Back to templates</button><div className="chosen"><MiniCard t={getTemplate(template)}/><div><small>YOUR TEMPLATE</small><strong>{getTemplate(template).name}{getTemplate(template).premium?' · ৳49':''}</strong><button onClick={()=>navigate('/templates')}>Change</button></div></div><h1>Make it <i>theirs.</i></h1><p className="sub">The little details are what they’ll remember.</p><label>THE BIRTHDAY PERSON<input value={data.recipient} onChange={e=>update('recipient',e.target.value)} placeholder="e.g. Maya" maxLength={32}/></label><label>YOUR MESSAGE<textarea value={data.message} onChange={e=>update('message',e.target.value)} placeholder="Write something from the heart..." maxLength={300}/><small>{data.message.length}/300</small></label><label>FROM<input value={data.sender} onChange={e=>update('sender',e.target.value)} placeholder="Your name" maxLength={60}/></label><div className="upload-block"><div><label>PHOTOS <small>UP TO 5</small></label><button className="upload" onClick={()=>photoRef.current?.click()}>＋ Add photos</button><input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>{addPhotos(e.target.files);e.target.value=''}}/></div>{data.photos.length>0&&<div className="thumbs">{data.photos.map((photo,index)=><div key={photo}><img src={photo} alt={`Photo ${index+1}`}/><button aria-label={`Remove photo ${index+1}`} onClick={()=>removePhoto(index)}>×</button></div>)}</div>}</div><div className="upload-block"><div><label>MUSIC <small>OPTIONAL</small></label><button className="upload" onClick={()=>musicRef.current?.click()}>♫ Add a song</button><input ref={musicRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" hidden onChange={e=>{const file=e.target.files?.[0];if(file&&file.size<=10_000_000){setMusic(file);setData(d=>({...d,music:URL.createObjectURL(file)}))}else setError('Use an MP3, WAV, or M4A under 10 MB.');e.target.value=''}}/></div>{music&&<div className="music-file">♫ {music.name}<button aria-label="Remove song" onClick={()=>{setMusic(undefined);setData(d=>({...d,music:undefined}))}}>×</button></div>}</div>{error&&<p className="form-error" role="alert">{error}</p>}<Button onClick={create}>{saving?'Saving your card…':getTemplate(template).premium?'Continue to payment':'Create my birthday card'} <b>→</b></Button></section><aside className="preview-panel"><div className="preview-top"><span>LIVE PREVIEW</span><span>⋯</span></div><CardPreview data={data}/><small className="preview-foot">This is exactly what they’ll see ✦</small></aside></main></>}
function useRemoteCard(id:string){
 const [data,setData]=useState<CardData|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/cards/'+encodeURIComponent(id),{signal:controller.signal})
   .then(async response=>{
    const result:{error?:string}&Partial<CardData>=await response.json();
    if(!response.ok)throw new Error(result.error||'We could not load this card. Please try again later.');
    if(!result.recipient||!result.template||!Array.isArray(result.photos))throw new Error('This birthday card could not be loaded.');
    setData(result as CardData);
   })
   .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'We could not load this card. Please try again later.')});
  return ()=>controller.abort();
 },[id]);
 return {data,error};
}
function CardLoadMessage({error}:{error:string}){return <main className="expired"><span>✦</span><h1>{error?'This card needs a little help.':'Getting your card ready…'}</h1><p>{error||'Just a moment while we find your birthday surprise.'}</p><Button onClick={()=>navigate('/')}>Back to Wishwell →</Button></main>}
function Share({id}:{id:string}){
 const {data,error}=useRemoteCard(id);
 const url=(typeof window==='undefined'?'https://wishwell.cards':location.origin)+'/card/'+id;
 const [copyState,setCopyState]=useState('');
 const copy=async()=>{
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
   else{
    const field=document.createElement('textarea');
    field.value=url;field.style.position='fixed';field.style.opacity='0';
    document.body.appendChild(field);field.select();
    const copied=document.execCommand('copy');field.remove();
    if(!copied)throw new Error('Copy is unavailable in this browser. Select and copy the link instead.');
   }
   setCopyState('Link copied!');
  }catch(cause){setCopyState(cause instanceof Error?cause.message:'Could not copy the link.')}
 };
 if(!data)return <CardLoadMessage error={error}/>;
 return <><Nav/><main className="share-page"><div className="confetti">✦　●　✦　★　●</div><span className="eyebrow">IT’S READY!</span><h1>Your card is<br/><i>on its way.</i></h1><p>Share this little piece of birthday magic with {data.recipient}.</p><div className="share-content"><CardPreview data={data}/><div className="share-actions"><label>YOUR UNIQUE LINK</label><div className="url"><span>{url.replace(/^https?:\/\//,'')}</span><button onClick={copy}>Copy</button></div><Button onClick={copy}>Copy link <b>↗</b></Button><button className="share-native" onClick={()=>{if(navigator.share)void navigator.share({title:'A birthday card for '+data.recipient,url}).catch(()=>{});else void copy()}}>Share another way <b>↗</b></button><small role="status">{copyState||'Your card will be available for 30 days.'}</small></div></div></main></>
}
function PublicCard({id}:{id:string}){const raw=typeof window==='undefined'?null:localStorage.getItem('wishwell-'+id);const [opened,setOpened]=useState(false);const [playing,setPlaying]=useState(false);const audio=useRef<HTMLAudioElement>(null);if(!raw)return <main className="expired"><span>✦</span><h1>This birthday memory<br/><i>has expired.</i></h1><p>It may have danced its last dance, but the love behind it remains.</p><Button onClick={()=>navigate('/')}>Make a new card →</Button></main>;const stored=JSON.parse(raw);if(Date.now()-stored.createdAt>30*864e5)return <main className="expired"><span>✦</span><h1>This birthday memory<br/><i>has expired.</i></h1></main>;const data:CardData=stored;return <main className={'public-card '+(opened?'opened':'')}><div className="public-bg">✦　♥　✦</div>{!opened?<div className="envelope"><span>✦</span><p>A special birthday message<br/>is waiting for you.</p><Button onClick={()=>setOpened(true)}>Open card <b>♡</b></Button><small>made with wishwell</small></div>:<><CardPreview data={data}/><div className="public-bottom"><button onClick={()=>{if(!audio.current)return;if(playing)audio.current.pause();else audio.current.play();setPlaying(!playing)}}>{playing?'Ⅱ Pause music':'♫ Play their song'}</button><span>made with ✦ wishwell</span></div>{data.music&&<audio ref={audio} src={data.music}/>}</>}</main>}
function PremiumUnavailable(){return <><Nav/><main className="payment-page"><span className="eyebrow">A QUICK NOTE</span><h1>Premium cards are<br/><i>coming soon.</i></h1><p className="sub">Premium checkout is not set up yet, so no payment will be taken. All free templates are ready to personalize and share.</p><Button onClick={()=>navigate('/templates')}>Choose a free card <b>→</b></Button></main></>}
function NotFound(){return <main className="expired"><span>✦</span><h1>This page took<br/><i>a wrong turn.</i></h1><p>That page isn’t here, but a lovely birthday card is still just a few clicks away.</p><Button onClick={()=>navigate('/')}>Back to Wishwell →</Button></main>}
export default function App({initialPath='/' }:{initialPath?:string}){const [path,setPath]=useState(initialPath);useEffect(()=>{const f=()=>setPath(location.pathname);setPath(location.pathname);addEventListener('popstate',f);return()=>removeEventListener('popstate',f)},[]);if(path==='/templates'||path.startsWith('/templates/')||path.startsWith('/birthday-cards'))return <Templates/>;if(path.startsWith('/create/')){const id=path.split('/').pop() as TemplateId;return <Editor template={getTemplate(id)?id:'romantic'}/>};if(path.startsWith('/payment/'))return <PremiumUnavailable/>;if(path.startsWith('/share/'))return <Share id={path.split('/').pop()!}/>;if(path.startsWith('/card/'))return <StoryCard id={path.split('/').pop()!}/>;if(path==='/')return <Landing/>;return <NotFound/>}
function Payment({template}:{template:TemplateId}){const t=getTemplate(template);const [submitted,setSubmitted]=useState(false);const [name,setName]=useState('');const [number,setNumber]=useState('');const [transaction,setTransaction]=useState('');const submit=(e:React.FormEvent)=>{e.preventDefault();if(!/^01\d{9}$/.test(number.replace(/[\s-]/g,''))||!/^\w{8,20}$/.test(transaction)||name.trim().length<2){alert('Please check the payment details.');return}localStorage.setItem('wishwell-payment-'+template,JSON.stringify({name,number,transaction,status:'pending',createdAt:Date.now()}));setSubmitted(true)};if(submitted)return <><Nav/><main className="payment-page success"><span>✦</span><h1>Payment <i>submitted.</i></h1><p>We’re checking your payment. Your card draft is safely saved; we’ll unlock this premium design once it’s verified.</p><Button onClick={()=>navigate('/create/'+template)}>Back to my card <b>→</b></Button></main></>;return <><Nav/><main className="payment-page"><button className="back" onClick={()=>navigate('/create/'+template)}>← Back to my card</button><span className="eyebrow">ONE-TIME PREMIUM ACCESS</span><h1>Make it extra <i>special.</i></h1><p className="sub">You’re choosing the {t.name} template. It includes the full animated birthday experience.</p><div className="payment-box"><div className="payment-price"><span>{t.name} template</span><strong>৳{t.price||49}</strong></div><p>Send <b>৳{t.price||49}</b> to the personal bKash number below, then enter the details from your payment.</p><div className="bkash-number"><small>bKash Personal Number</small><strong>01XXXXXXXXX</strong><button onClick={()=>navigator.clipboard?.writeText('01XXXXXXXXX')}>Copy number</button></div><form onSubmit={submit}><label>YOUR NAME<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label><label>YOUR bKash NUMBER<input value={number} onChange={e=>setNumber(e.target.value)} inputMode="numeric" placeholder="01XXXXXXXXX"/></label><label>TRANSACTION ID<input value={transaction} onChange={e=>setTransaction(e.target.value)} placeholder="e.g. 8N7A6BC5"/></label><p className="help">After paying, enter the transaction ID and number you paid from. We’ll verify it before unlocking this template.</p><Button type="submit">Submit payment <b>→</b></Button></form></div></main></>}
function illustratedMemory(background:string,accent:string){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 430"><rect width="350" height="430" fill="${background}"/><circle cx="280" cy="76" r="38" fill="#fff5dc"/><path d="M0 340Q85 285 172 340T350 328V430H0Z" fill="#fff5dc" opacity=".65"/><path d="M65 430c18-102 68-148 111-148s94 46 109 148" fill="${accent}"/><circle cx="176" cy="177" r="73" fill="#fff0d5"/><path d="M144 180h1m60 0h1" stroke="#38364a" stroke-width="12" stroke-linecap="round"/><path d="M153 205q23 24 46 0" fill="none" stroke="#cf7059" stroke-width="7" stroke-linecap="round"/><path d="m75 110 8 17 18 2-13 12 4 18-17-9-16 9 3-18-13-12 18-2Z" fill="#fff5dc"/></svg>`
 return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
const storyIllustrations=[illustratedMemory('#f1c494','#cf765d'),illustratedMemory('#a9c9c8','#627f83')]
function StoryCardLegacy({id}:{id:string}){const raw=typeof window==='undefined'?null:localStorage.getItem('wishwell-'+id);const [scene,setScene]=useState(0);const [playing,setPlaying]=useState(false);const audio=useRef<HTMLAudioElement>(null);if(!raw)return <main className="expired"><span>✦</span><h1>This birthday memory<br/><i>has expired.</i></h1><p>It may have danced its last dance, but the love behind it remains.</p><Button onClick={()=>navigate('/')}>Make a new card →</Button></main>;const stored=JSON.parse(raw);if(Date.now()-stored.createdAt>30*864e5)return <main className="expired"><span>✦</span><h1>This birthday memory<br/><i>has expired.</i></h1></main>;const data:CardData=stored;const next=()=>{if(scene===0&&audio.current){audio.current.play().then(()=>setPlaying(true)).catch(()=>{})}setScene(s=>Math.min(s+1,3))};const back=()=>setScene(s=>Math.max(s-1,0));const photo=data.photos[0]||sample.photos[0];const photo2=data.photos[1]||sample.photos[1];return <main className={'story-card story-'+data.template+' scene-'+scene}><div className="story-grain"></div><div className="story-orbit orbit-a">✦</div><div className="story-orbit orbit-b">♥</div>{scene>0&&<header className="story-header"><button aria-label="Previous page" onClick={back}>←</button><div className="story-progress" aria-label={'Page '+scene+' of 3'}><i className={scene>=1?'active':''}></i><i className={scene>=2?'active':''}></i><i className={scene>=3?'active':''}></i></div><button aria-label="Play or pause music" onClick={()=>{if(!audio.current)return;playing?audio.current.pause():audio.current.play();setPlaying(!playing)}}>{playing?'Ⅱ':'♫'}</button></header>}<section className="story-stage">{scene===0&&<div className="story-intro"><div className="intro-seal">✦</div><p>Someone made a little<br/>birthday story for you</p><h1>For <i>{data.recipient}</i></h1><button className="open-story" onClick={next}>Open your surprise <span>→</span></button><small>tap to begin</small></div>}{scene===1&&<div className="story-memory"><span className="scene-kicker">CHAPTER ONE</span><h2>A few moments<br/>worth <i>keeping.</i></h2><div className="memory-photos"><img src={photo} alt="A birthday memory"/><img src={photo2} alt="A birthday memory"/></div><p>Because the best years are made of ordinary days with extraordinary people.</p><button className="story-next" onClick={next}>Keep going <span>→</span></button></div>}{scene===2&&<div className="story-note"><span className="scene-kicker">CHAPTER TWO</span><div className="note-paper"><span>dear {data.recipient},</span><p>{data.message}</p><small>{data.sender}</small></div><button className="story-next" onClick={next}>One last thing <span>→</span></button></div>}{scene===3&&<div className="story-final"><div className="celebrate-burst">✦　★　✦<br/>　♥　✦　</div><span className="scene-kicker">THE FINALE</span><h2>Happy birthday,<br/><i>{data.recipient}.</i></h2><p>May this next year surprise you in all the best ways.</p><button className="replay" onClick={()=>setScene(0)}>↻ Replay your story</button><small>made with love · wishwell</small></div>}</section>{data.music&&<audio ref={audio} src={data.music}/>}</main>}
function StoryCard({id}:{id:string}){
 const {data,error}=useRemoteCard(id);
 useEffect(()=>{
  if(data){
   const photos=data.photos.length===0?[...storyIllustrations]:data.photos.length===1?[data.photos[0],storyIllustrations[0]]:data.photos;
   localStorage.setItem('wishwell-'+id,JSON.stringify({...data,photos,createdAt:Date.now()}));
  }
 },[data,id]);
 if(!data)return <CardLoadMessage error={error}/>;
 return <StoryCardLegacy id={id}/>;
}
