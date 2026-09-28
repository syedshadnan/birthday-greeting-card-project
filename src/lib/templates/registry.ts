export type AnimationPreset = 'fade'|'slide'|'scale'|'bounce'|'spring'|'typewriter'|'floating'|'confetti'|'photoReveal'|'cardFlip'|'pageTurn'|'stagger'
export type TemplateDefinition = { id:string; slug:string; name:string; description:string; category:'cute'|'minimal'|'party'|'friend'|'elegant'|'romantic'|'cinematic'|'cartoon'; isPremium:boolean; price:number; previewImage?:string; animationPreset:AnimationPreset }
export const templateRegistry:TemplateDefinition[]=[
 {id:'cute',slug:'cute',name:'Cute',description:'A sweet little celebration.',category:'cute',isPremium:false,price:0,animationPreset:'bounce'},
 {id:'minimal',slug:'minimal',name:'Minimal',description:'Simply lovely wishes.',category:'minimal',isPremium:false,price:0,animationPreset:'fade'},
 {id:'party',slug:'party',name:'Birthday Party',description:'Big energy, bright confetti.',category:'party',isPremium:false,price:0,animationPreset:'confetti'},
 {id:'friend',slug:'best-friend',name:'Best Friend',description:'For your favourite human.',category:'friend',isPremium:false,price:0,animationPreset:'photoReveal'},
 {id:'elegant',slug:'elegant',name:'Elegant',description:'Timeless wishes.',category:'elegant',isPremium:false,price:0,animationPreset:'slide'},
 {id:'romantic',slug:'romantic',name:'Romantic',description:'A heartfelt story in motion.',category:'romantic',isPremium:false,price:0,animationPreset:'cardFlip'},
 {id:'cinematic',slug:'cinematic',name:'Cinematic',description:'A main-character birthday moment.',category:'cinematic',isPremium:false,price:0,animationPreset:'pageTurn'},
 {id:'cartoon',slug:'cartoon',name:'Storybook',description:'An original illustrated birthday scene.',category:'cartoon',isPremium:false,price:0,animationPreset:'stagger'},
]
export const findTemplate=(slug:string)=>templateRegistry.find(template=>template.slug===slug)
