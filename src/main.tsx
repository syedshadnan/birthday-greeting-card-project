"use client"
import React, { useEffect, useRef, useState } from 'react'
import './styles.css'
import CardBuilder from './components/card-builder'
import CardExperience from './components/card-experience'
import type { CardTheme } from './lib/cards/themes'

type TemplateId='romantic'|'cute'|'friend'|'elegant'|'funny'|'minimal'|'cinematic'|'party'
type CardData={recipient:string;message:string;sender:string;photos:string[];music?:string;musicName?:string;template:TemplateId}
const templates:{id:TemplateId;name:string;tag:string;emoji:string;className:string}[]=[
 {id:'romantic',name:'Romantic',tag:'for your person',emoji:'♥',className:'rose'}, {id:'cute',name:'Cute',tag:'extra sweet',emoji:'✿',className:'peach'},
 {id:'friend',name:'Best Friend',tag:'the real one',emoji:'✦',className:'sky'}, {id:'elegant',name:'Elegant',tag:'timeless wishes',emoji:'✧',className:'ink'},
 {id:'funny',name:'Funny',tag:'older, not wiser',emoji:'☻',className:'lime'}, {id:'minimal',name:'Minimal',tag:'simply lovely',emoji:'○',className:'sand'},
 {id:'cinematic',name:'Cinematic',tag:'main character day',emoji:'✺',className:'night'}, {id:'party',name:'Party',tag:'make some noise',emoji:'★',className:'party'}]
const sample:CardData={recipient:'Maya',message:'Here’s to a year full of bright little moments, brave choices, and reasons to laugh until it hurts.',sender:'With all my love, Rhea',photos:['https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=700&q=85','https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=700&q=85'],template:'romantic'}
const getTemplate=(id:TemplateId)=>templates.find(x=>x.id===id)!
const themeForTemplate=(id:string):CardTheme=>id==='romantic'?'rose-romantic':id==='cinematic'?'midnight-galaxy':id==='elegant'?'royal-gold':'pastel-cute'
function Brand(){return <a className="brand" href="/" onClick={e=>{e.preventDefault();navigate('/')}}><span>✦</span> wishwell</a>}
function navigate(path:string){history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))}
function Button({children,onClick,variant='dark',type='button',disabled=false}:{children:React.ReactNode;onClick?:()=>void;variant?:string;type?:'button'|'submit';disabled?:boolean}){return <button type={type} className={'button '+variant} onClick={onClick} disabled={disabled}>{children}</button>}
function Nav(){return <nav><Brand/><div className="navlinks"><a href="/#how">How it works</a><a href="/templates" onClick={e=>{e.preventDefault();navigate('/templates')}}>Templates</a></div><Button onClick={()=>navigate('/templates')}>Create a card <b>→</b></Button></nav>}
function MiniCard({t}: {t:typeof templates[number]}){return <div className={'mini-card '+t.className}><i>{t.emoji}</i><small>happy birthday</small><strong>for you</strong><em>made with love</em></div>}
function TinyJoy(){const [message,setMessage]=useState('');const joys=['You make someone’s world brighter just by being in it. ✨','A little kindness has a way of coming back around. 🌼','Somewhere, someone is smiling because of you. 💛','Today is a good day to make a small happy memory. 🎈'];const shareJoy=()=>{let next=Math.floor(Math.random()*joys.length);if(joys.length>1&&joys[next]===message)next=(next+1)%joys.length;setMessage(joys[next])};return <div className="tiny-joy"><span>Need a tiny smile?</span><button type="button" onClick={shareJoy}>Pick a little joy <b aria-hidden="true">✿</b></button><p aria-live="polite">{message}</p></div>}
function Landing(){return <><Nav/><main className="landing-page"><section className="hero"><div className="eyebrow">A LITTLE MAGIC, MADE PERSONAL</div><h1>Make their birthday<br/><i>unforgettable.</i></h1><p>Create a beautiful, personal birthday card with photos, music and a message they’ll want to keep.</p><div className="hero-actions"><Button onClick={()=>navigate('/templates')}>Create a birthday card <b>→</b></Button><a href="#templates" className="text-link">Explore templates <b>↓</b></a></div><div className="hero-note"><span>✦</span> Free forever. No account needed.</div><TinyJoy/><div className="hero-card-wrap"><div className="sun"></div><div className="scribble one">made just<br/>for them ↘</div><div className="floating-star">✦</div><CardPreview data={sample} hero/></div></section>
<section className="template-section" id="templates" data-reveal><div className="section-head"><div><span className="eyebrow">CHOOSE A FEELING</span><h2>There’s a card for<br/><i>every kind of love.</i></h2></div><Button variant="outline" onClick={()=>navigate('/templates')}>See all templates <b>→</b></Button></div><div className="template-grid">{templates.slice(0,4).map(t=><button className="template-tile" data-reveal key={t.id} onClick={()=>navigate('/create/'+t.id)}><MiniCard t={t}/><span><strong>{t.name}</strong><small>{t.tag}</small></span></button>)}</div></section>
<section className="how" id="how" data-reveal><span className="eyebrow">EASY AS 1, 2, 3</span><h2>A little love goes<br/>a <i>long</i> way.</h2><div className="steps">{['Pick a feeling','Make it personal','Send some joy'].map((title,index)=><article data-reveal key={title}><b>0{index+1}</b><span>{['✦','♡','↗'][index]}</span><h3>{title}</h3><p>{['Choose a design that sounds like you two.','Add your words, favorite photos, and a song.','Share one special link. No app required.'][index]}</p></article>)}</div></section>
<section className="closing" data-reveal><p>THE BEST GIFTS ARE THE ONES THAT FEEL LIKE YOU.</p><h2>Ready to make<br/>someone <i>smile?</i></h2><Button onClick={()=>navigate('/templates')}>Start creating <b>→</b></Button></section></main><footer className="site-footer"><Brand/><span className="footer-note">Made for sweet moments.</span><nav className="footer-socials" aria-label="Creator links"><a href="https://www.linkedin.com/in/shadnancodes/" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a><a href="https://github.com/syedshadnan" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a></nav><span className="footer-copyright">© Wishwell</span></footer></>}
function CardPreview({data,hero=false,open=true}:{data:CardData;hero?:boolean;open?:boolean}){const t=getTemplate(data.template);return <div className={'card-preview '+t.className+(hero?' hero-preview':'')+(open?'':' closed')}><div className="card-decor d1">{t.emoji}</div><div className="card-decor d2">✦</div>{data.photos[0]&&<img className="card-photo main-photo" src={data.photos[0]} alt="Birthday memory"/>}{data.photos[1]&&<img className="card-photo second-photo" src={data.photos[1]} alt="Birthday memory"/>}<div className="card-content"><span>happy birthday</span><h3>{data.recipient||'Your favorite human'}</h3><p>{data.message||'A little note to make your day brighter.'}</p><small>{data.sender||'With love'}</small></div></div>}
function Templates(){return <><Nav/><main className="gallery"><div className="gallery-title" data-reveal><span className="eyebrow">PICK YOUR MOOD</span><h1>Start with a<br/><i>feeling.</i></h1><p>Every design has its own little personality. Choose the one that feels most like them.</p></div><div className="all-templates">{templates.map(t=><button className="template-tile big" data-reveal key={t.id} onClick={()=>navigate('/create?theme='+themeForTemplate(t.id))}><MiniCard t={t}/><span><strong>{t.name}</strong><small>{t.tag}</small><b>Make this yours →</b></span></button>)}</div><section className="story-template-feature" data-reveal><div className="story-template-art" aria-hidden="true"><span>✦</span><div>🎁</div><i>happy birthday</i><strong>for you</strong><em>made with love</em></div><div className="story-template-copy"><span className="eyebrow">A CARD WITH A LITTLE SURPRISE</span><h2>One little link.<br/><i>Nine lovely scenes.</i></h2><p>Make this bilingual birthday story your own with a name, a personal letter, up to six photos, and optional music. Unfold a note, pick a birthday wish, and share the whole story for free.</p><div className="story-template-actions"><Button variant="story-card-create" onClick={()=>navigate('/create?theme=rose-romantic')}>Create this card <b>→</b></Button><Button variant="story-card-demo" onClick={()=>navigate('/card/demo')}>Preview the demo <b>↗</b></Button></div></div></section></main></>}
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
  const result: {id?:string;error?:string}=await response.json();
  if(!response.ok||!result.id)throw new Error(result.error||'We could not save your card. Please try again.');
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
return <><Nav/><main className="editor"><section className="edit-panel"><button className="back" onClick={()=>navigate('/templates')}>← Back to templates</button><div className="chosen"><MiniCard t={getTemplate(template)}/><div><small>YOUR TEMPLATE</small><strong>{getTemplate(template).name} · Free</strong><button onClick={()=>navigate('/templates')}>Change</button></div></div><h1>Make it <i>theirs.</i></h1><p className="sub">The little details are what they’ll remember.</p><label>THE BIRTHDAY PERSON<input value={data.recipient} onChange={e=>update('recipient',e.target.value)} placeholder="e.g. Maya" maxLength={32}/></label><label>YOUR MESSAGE<textarea value={data.message} onChange={e=>update('message',e.target.value)} placeholder="Write something from the heart..." maxLength={300}/><small>{data.message.length}/300</small></label><label>FROM<input value={data.sender} onChange={e=>update('sender',e.target.value)} placeholder="Your name" maxLength={60}/></label><div className="upload-block"><div><label>PHOTOS <small>UP TO 5</small></label><button className="upload" onClick={()=>photoRef.current?.click()}>＋ Add photos</button><input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>{addPhotos(e.target.files);e.target.value=''}}/></div>{data.photos.length>0&&<div className="thumbs">{data.photos.map((photo,index)=><div key={photo}><img src={photo} alt={`Photo ${index+1}`}/><button aria-label={`Remove photo ${index+1}`} onClick={()=>removePhoto(index)}>×</button></div>)}</div>}</div><div className="upload-block"><div><label>MUSIC <small>OPTIONAL</small></label><button className="upload" onClick={()=>musicRef.current?.click()}>♫ Add a song</button><input ref={musicRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" hidden onChange={e=>{const file=e.target.files?.[0];if(file&&file.size<=10_000_000){setMusic(file);setData(d=>({...d,music:URL.createObjectURL(file)}))}else setError('Use an MP3, WAV, or M4A under 10 MB.');e.target.value=''}}/></div>{music&&<div className="music-file">♫ {music.name}<button aria-label="Remove song" onClick={()=>{setMusic(undefined);setData(d=>({...d,music:undefined}))}}>×</button></div>}</div>{error&&<p className="form-error" role="alert">{error}</p>}<Button onClick={create}>{saving?'Saving your card…':'Create my free birthday card'} <b>→</b></Button></section><aside className="preview-panel"><div className="preview-top"><span>LIVE PREVIEW</span><span>⋯</span></div><CardPreview data={data}/><small className="preview-foot">This is exactly what they’ll see ✦</small></aside></main></>}
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
function PremiumUnavailable(){return <><Nav/><main className="payment-page"><span className="eyebrow">ALL CARDS ARE FREE</span><h1>Every story is<br/><i>yours to share.</i></h1><p className="sub">All themes and all nine scenes are free. No payment is needed.</p><Button onClick={()=>navigate('/create')}>Create a free card <b>→</b></Button></main></>}
function NotFound(){return <main className="expired"><span>✦</span><h1>This page took<br/><i>a wrong turn.</i></h1><p>That page isn’t here, but a lovely birthday card is still just a few clicks away.</p><Button onClick={()=>navigate('/')}>Back to Wishwell →</Button></main>}
export default function App({initialPath='/' }:{initialPath?:string}){const [path,setPath]=useState(initialPath);useEffect(()=>{const f=()=>setPath(location.pathname+location.search);setPath(location.pathname+location.search);addEventListener('popstate',f);return()=>removeEventListener('popstate',f)},[]);useEffect(()=>{document.documentElement.classList.add('has-scroll-reveal');const items=document.querySelectorAll<HTMLElement>('[data-reveal]');if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window)){items.forEach(item=>{item.classList.add('is-visible');item.inert=false});return}const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){const item=entry.target as HTMLElement;item.classList.add('is-visible');item.inert=false;observer.unobserve(item)}}),{threshold:0.12,rootMargin:'0px 0px -36px 0px'});items.forEach(item=>{item.inert=true;observer.observe(item)});return()=>observer.disconnect()},[path]);if(path==='/templates'||path.startsWith('/templates/')||path.startsWith('/birthday-cards'))return <Templates/>;if(path==='/create'||path.startsWith('/create?')){const query=path.split('?')[1]||'';const requested=new URLSearchParams(query).get('theme');const selected=(Object.keys({ 'royal-gold':1,'rose-romantic':1,'midnight-galaxy':1,'pastel-cute':1 }) as CardTheme[]).includes(requested as CardTheme)?requested as CardTheme:'pastel-cute';return <CardBuilder initialTheme={selected}/>};if(path.startsWith('/create/')){const id=path.split('/').pop() as TemplateId;return <CardBuilder initialTheme={themeForTemplate(getTemplate(id)?id:'cute')}/>};if(path.startsWith('/payment/'))return <PremiumUnavailable/>;if(path.startsWith('/share/'))return <Share id={path.split('/').pop()!}/>;if(path.startsWith('/card/'))return <CardExperience slug={path.split('/').pop()!}/>;if(path==='/')return <Landing/>;return <NotFound/>}
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
