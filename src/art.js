export function initArt({window:w=window,document:d=document}={}){
 const toggle=d.getElementById('motion-toggle'),root=d.documentElement,body=d.body;
 const reduced=w.matchMedia?.('(prefers-reduced-motion: reduce)');
 let off=!!reduced?.matches;try{off=off||w.localStorage.getItem('recallscope.motion')==='off'}catch{}
 function apply(){body.classList.toggle('motion-off',off);toggle?.setAttribute('aria-pressed',String(off));if(toggle)toggle.textContent=off?'Motion off ○':'Motion on ◉'}apply();
 toggle?.addEventListener('click',()=>{off=!off;apply();try{w.localStorage.setItem('recallscope.motion',off?'off':'on')}catch{}});
 reduced?.addEventListener?.('change',e=>{if(e.matches){off=true;apply()}});
 const art=d.querySelector('.visual'),cursor=d.querySelector('.cursor-study');let scheduled=false,x=0,y=0;
 const raf=w.requestAnimationFrame?.bind(w);
 function draw(){scheduled=false;if(off)return;if(cursor){cursor.style.opacity='1';cursor.style.transform=`translate(${x-22}px,${y-22}px)`;}if(art){const rect=art.getBoundingClientRect(),dx=(x-(rect.left+rect.width/2))/Math.max(w.innerWidth,1),dy=(y-(rect.top+rect.height/2))/Math.max(w.innerHeight,1);art.style.setProperty('--art-x',`${dx*9}px`);art.style.setProperty('--art-y',`${dy*7}px`);art.style.setProperty('--art-r',`${dx*1.2}deg`)}}
 if(raf&&!w.matchMedia?.('(pointer: coarse)').matches){w.addEventListener('pointermove',e=>{if(off)return;x=e.clientX;y=e.clientY;if(!scheduled){scheduled=true;raf(draw)}},{passive:true});d.addEventListener('pointerleave',()=>{if(cursor)cursor.style.opacity='0'});w.addEventListener('blur',()=>{if(cursor)cursor.style.opacity='0'})}
 function progress(){const max=root.scrollHeight-w.innerHeight;root.style.setProperty('--read-progress',String(max>0?Math.max(0,Math.min(1,w.scrollY/max)):0))}w.addEventListener('scroll',progress,{passive:true});progress();
 if(w.IntersectionObserver){const observer=new w.IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('revealed');observer.unobserve(e.target)}},{threshold:.08});for(const e of d.querySelectorAll('.section-head,.cards article,#how>h2')){e.classList.add('reveal-ready');observer.observe(e)}}
}
