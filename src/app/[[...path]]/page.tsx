import type { Metadata } from 'next'
import App from '../../main'

const titles: Record<string, {title:string;description:string}> = {
  cute:{title:'Cute Birthday Cards — Create Free Animated Birthday Cards',description:'Make a sweet animated birthday card with your own photos, message, and music.'},
  romantic:{title:'Romantic Birthday Cards — Make a Meaningful Surprise',description:'Create an unforgettable romantic birthday card with photos and music.'},
  'best-friend':{title:'Birthday Cards for Best Friends',description:'Make your best friend smile with a personal animated birthday card.'},
  cartoon:{title:'Cartoon Birthday Cards — Original Animated Surprises',description:'Create an original cartoon-style birthday surprise, made personal.'},
}
export async function generateMetadata({params}:{params:Promise<{path?:string[]}>}):Promise<Metadata>{
 const {path=[]}=await params; const slug=path.at(-1) || ''; const item=titles[slug];
 if(item)return {title:item.title,description:item.description,alternates:{canonical:'/birthday-cards/'+slug},openGraph:{title:item.title,description:item.description}};
 if(path[0]==='templates') return {title:'Free Birthday Card Templates',description:'Choose from free animated birthday card designs.'};
 if(path[0]==='card') return {title:'A special birthday surprise',robots:{index:false,follow:false}};
 if(path[0]==='create'||path[0]==='share') return {robots:{index:false,follow:false}};
 return {};
}
export default async function CatchAllPage({params}:{params:Promise<{path?:string[]}>}) { const {path=[]}=await params; return <App initialPath={'/'+path.join('/')} /> }
