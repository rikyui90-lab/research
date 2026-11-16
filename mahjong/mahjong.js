{
const $=id=>document.getElementById(id)||document.createElement('div');
const MAN='〇一二三四五六七八九',HON=['','東','南','西','北','白','發','中'],HC=['','e','e','e','e','w','g','r'];
// 筒子・索子の図柄（viewBox 30×40）
const CB='#1f4fa0',CG='#13804f',CR='#c8102e',IV='#f7f2e2';
const dot=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r*.58}" fill="${IV}"/><circle cx="${x}" cy="${y}" r="${r*.3}" fill="${c}"/>`;
const PIN={1:[[15,20,11,CR]],2:[[15,11,6,CG],[15,29,6,CB]],3:[[8,9,5,CB],[15,20,5,CR],[22,31,5,CG]],
 4:[[9,11,5,CB],[21,11,5,CG],[9,29,5,CG],[21,29,5,CB]],5:[[8,9,4.5,CB],[22,9,4.5,CG],[15,20,4.5,CR],[8,31,4.5,CG],[22,31,4.5,CB]],
 6:[[9,7,4.2,CG],[21,7,4.2,CG],[9,22,4.2,CR],[21,22,4.2,CR],[9,33,4.2,CR],[21,33,4.2,CR]],
 7:[[7,5,3.6,CG],[15,9,3.6,CG],[23,13,3.6,CG],[9,24,3.6,CR],[21,24,3.6,CR],[9,34,3.6,CR],[21,34,3.6,CR]],
 8:[6,15,24,33].flatMap(y=>[[9,y,4,CB],[21,y,4,CB]]),
 9:[[8,CB],[20,CR],[32,CG]].flatMap(([y,c])=>[7,15,23].map(x=>[x,y,3.7,c]))};
const stick=(x,y,h,c,a=0)=>`<g${a?` transform="rotate(${a} ${x} ${y})"`:''}><rect x="${x-1.8}" y="${y-h/2}" width="3.6" height="${h}" rx="1.6" fill="${c}"/><rect x="${x-1.8}" y="${y-.5}" width="3.6" height="1" fill="${IV}"/></g>`;
const SOU={2:[[15,11,CG],[15,29,CG]],3:[[15,11,CG],[9,29,CG],[21,29,CG]],4:[[9,11,CG],[21,11,CG],[9,29,CG],[21,29,CG]],
 5:[[8,11,CG],[22,11,CG],[15,20,CR],[8,29,CG],[22,29,CG]],6:[11,29].flatMap(y=>[7,15,23].map(x=>[x,y,CG])),
 7:[[15,7,CR,9]].concat([21,33].flatMap(y=>[7,15,23].map(x=>[x,y,CG,9]))),
 8:[[4.5,11,CG,13,0],[11.3,11,CG,13,-22],[18.7,11,CG,13,22],[25.5,11,CG,13,0],[4.5,29,CG,13,0],[11.3,29,CG,13,22],[18.7,29,CG,13,-22],[25.5,29,CG,13,0]],
 9:[7,20,33].flatMap(y=>[7,15,23].map(x=>[x,y,x===15?CR:CG,10]))};
const BIRD=`<ellipse cx="14" cy="23" rx="7" ry="9" fill="${CG}"/><path d="M8 28 L3 37 L11 31 Z M12 31 L10 39 L16 31 Z" fill="${CB}"/><circle cx="19" cy="11" r="4.5" fill="${CR}"/><path d="M23 10 L28 12 L23 13 Z" fill="#e2a300"/><circle cx="20" cy="10" r="1" fill="${IV}"/><path d="M11 19 Q15 24 12 30" stroke="${IV}" stroke-width="1.2" fill="none"/>`;
const PIC={};
const pic=(n,s)=>PIC[n+s]||(PIC[n+s]=`<svg viewBox="0 0 30 40" aria-hidden="true">${s==='p'?PIN[n].map(([x,y,r,c])=>dot(x,y,r,c)).join(''):n===1?BIRD:SOU[n].map(([x,y,c,h,a])=>stick(x,y,h||13,c,a)).join('')}</svg>`);
const tile=(n,s)=>{
 if(s==='z')return `<span class="t z ${HC[n]}" aria-label="${HON[n]}"><b>${n===5?'':HON[n]}</b></span>`;
 if(s==='m')return `<span class="t m" aria-label="${n}マン"><b>${MAN[n]}</b><i>萬</i></span>`;
 return `<span class="t ${s}" aria-label="${n}${s==='p'?'ピン':'ソー'}">${pic(n,s)}</span>`;
};
const parse=str=>{const out=[];let buf=[];for(const c of str.replace(/\s/g,'')){if(/\d/.test(c))buf.push(+c);else{buf.forEach(n=>out.push([n,c]));buf=[]}}return out};
const tiles=str=>str.split(' ').map(g=>`<span class="tiles">${parse(g).map(([n,s])=>tile(n,s)).join('')}</span>`).join('<span style="width:6px"></span>');

$('heroHand').innerHTML=[['234m','順子'],['567m','順子'],['345p','順子'],['678s','順子'],['99s','雀頭']]
 .map(([g,l])=>`<div class="grp"><div class="tiles">${parse(g).map(([n,s])=>tile(n,s)).join('')}</div><small>${l}</small></div>`).join('');
$('allTiles').innerHTML=[['123456789m','萬子（マンズ）'],['123456789p','筒子（ピンズ）'],['123456789s','索子（ソーズ）'],['1234567z','字牌（風牌・三元牌）']]
 .map(([g,l])=>`<div><div class="note">${l}</div><div class="tiles">${parse(g).map(([n,s])=>tile(n,s)).join('')}</div></div>`).join('');

// h: 門前の翻, o: 鳴いた時の翻 (0=門前限定), 13=役満
const Y=[
['立直','リーチ',1,0,'門前でテンパイしたら1000点を出して宣言。以後は手を変えられません。',null],
['一発','イッパツ',1,0,'リーチ後、1巡以内（間に鳴きが入らず）にアガる。',null],
['門前清自摸和','メンゼンツモ',1,0,'門前の状態で、ツモでアガる。',null],
['平和','ピンフ',1,0,'4面子すべて順子、雀頭が役牌でない、両面待ち。符がつかない形。','234m 567m 345p 678s 99s'],
['断么九','タンヤオ',1,1,'2〜8の数牌だけで作る。鳴いてもOK（喰いタン）のルールが一般的。','234m 456m 678p 345s 55s'],
['一盃口','イーペーコー',1,0,'同じ種類・同じ並びの順子を2組。','112233m 456p 789s 55s'],
['役牌','ヤクハイ',1,1,'三元牌（白發中）、場風、自風の刻子。1組につき1翻。','555z 123m 456p 789s 11p'],
['嶺上開花','リンシャンカイホー',1,1,'カンした後の補充牌（嶺上牌）でアガる。',null],
['槍槓','チャンカン',1,1,'他家が加槓した牌でロンする。',null],
['海底摸月','ハイテイ',1,1,'最後の牌をツモってアガる。',null],
['河底撈魚','ホウテイ',1,1,'最後の捨て牌でロンする。',null],
['ダブル立直','ダブリー',2,0,'最初のツモ番（鳴きが入る前）でリーチ。',null],
['七対子','チートイツ',2,0,'対子を7組。同じ牌4枚は2組と数えない。符は25符固定。','11m 33m 55p 77p 22s 66s 77z'],
['三色同順','サンショク',2,1,'萬子・筒子・索子で同じ数字の順子。','123m 123p 123s 678s 99p'],
['一気通貫','イッツー',2,1,'同じ種類で123・456・789。','123m 456m 789m 345p 22s'],
['混全帯么九','チャンタ',2,1,'すべての面子と雀頭に么九牌（1・9・字牌）を含む。','123m 789p 789s 111z 99s'],
['対々和','トイトイ',2,2,'4面子すべて刻子（槓子）。','222m 555p 888s 333z 77p'],
['三暗刻','サンアンコー',2,2,'暗刻を3組。鳴いた面子があってもOK。','222m 555p 888s 345s 77p'],
['三色同刻','サンショクドーコー',2,2,'萬子・筒子・索子で同じ数字の刻子。','333m 333p 333s 456s 88m'],
['三槓子','サンカンツ',2,2,'槓子を3組。',null],
['小三元','ショウサンゲン',2,2,'三元牌のうち2つが刻子、1つが雀頭。役牌2翻も付くので実質4翻。','555z 666z 77z 123m 456p'],
['混老頭','ホンロートー',2,2,'1・9・字牌だけで作る。対々和か七対子と複合。','111m 999p 111z 222z 99s'],
['二盃口','リャンペーコー',3,0,'一盃口を2組。七対子とは複合しない。','112233m 445566p 77s'],
['純全帯么九','ジュンチャン',3,2,'すべての面子と雀頭に1か9を含む（字牌なし）。','123m 789m 123p 999s 11s'],
['混一色','ホンイツ',3,2,'1種類の数牌と字牌だけで作る。','123m 345m 777m 222z 99m'],
['清一色','チンイツ',6,5,'1種類の数牌だけで作る。','123s 234s 456s 789s 55s'],
['国士無双','コクシムソウ',13,0,'13種類の么九牌を1枚ずつ＋そのうち1つを対子。','19m 19p 19s 1234567z 1m'],
['四暗刻','スーアンコー',13,0,'暗刻を4組。ロンで刻子が完成するとトイトイ三暗刻になる点に注意。','222m 555p 888s 333z 77p'],
['大三元','ダイサンゲン',13,13,'白・發・中すべてを刻子に。','555z 666z 777z 123m 99p'],
['字一色','ツーイーソー',13,13,'字牌だけで作る。','111z 222z 333z 555z 77z'],
['小四喜','ショウスーシー',13,13,'風牌のうち3つが刻子、1つが雀頭。','111z 222z 333z 44z 123m'],
['大四喜','ダイスーシー',13,13,'東南西北すべてを刻子に（ダブル役満のルールも）。','111z 222z 333z 444z 55m'],
['緑一色','リューイーソー',13,13,'索子の2・3・4・6・8と發だけで作る。','234s 234s 666s 888s 66z'],
['清老頭','チンロートー',13,13,'1と9の数牌だけで作る。','111m 999m 111p 999s 11s'],
['九蓮宝燈','チューレンポートー',13,0,'1種類で1112345678999＋同じ種類の牌1枚。','1112345678999m 5m'],
['四槓子','スーカンツ',13,13,'槓子を4組。',null],
['天和','テンホー',13,0,'親が配牌の時点でアガっている。',null],
['地和','チーホー',13,0,'子が最初のツモ（鳴きが入る前）でアガる。',null]];
const RD={};Y.forEach(y=>RD[y[0]]=y[1]);
Object.assign(RD,{'門前清自摸和':'メンゼンツモ','役牌':'ヤクハイ','場風':'バカゼ','自風':'ジカゼ','白':'ハク','發':'ハツ','中':'チュン','東':'トン','南':'ナン','西':'シャー','北':'ペー',
 '裏ドラ':'ウラドラ','ダブ東':'ダブトン','満貫':'マンガン','跳満':'ハネマン','倍満':'バイマン','三倍満':'サンバイマン','役満':'ヤクマン','数え役満':'カゾエヤクマン','海底摸月':'ハイテイツモ','河底撈魚':'ホウテイロン'});
const rb=nm=>{const m=nm.match(/^(.+?)(（.*）)?$/),base=m[1],tail=m[2]||'';
 const one=w=>RD[w]?`<ruby>${w}<rt>${RD[w]}</rt></ruby>`:w;
 return base.split(' ').map(one).join(' ')+tail};
let hf='all',oo=false,q='';
const HF=[['all','すべて'],[1,'1翻'],[2,'2翻'],[3,'3翻'],[6,'6翻'],[13,'役満']];
$('hanFilter').innerHTML=HF.map(([v,l])=>`<button data-v="${v}" aria-pressed="${v==='all'}">${l}</button>`).join('');
const renderY=()=>{
 const list=Y.filter(y=>(hf==='all'||y[2]==hf)&&(!oo||y[3]>0)&&(!q||(y[0]+y[1]).includes(q)));
 $('yakuList').innerHTML=list.map(([n,r,h,o,d,ex])=>{
  const ym=h===13,badge=ym?'役満':h+'翻';
  const nk=o===0?'門前限定':o===h?'鳴いてもOK':`鳴き −1翻（${o}翻）`;
  return `<article class="card"><div class="hd"><h3>${rb(n)}</h3><span class="han${ym?' ym':''}">${badge}</span></div>
  <div class="tag">${nk}</div><p>${d}</p>${ex?`<div class="tiles" style="gap:2px 0">${tiles(ex)}</div>`:'<div class="note">状況で成立する役（牌の形は問わない）</div>'}</article>`}).join('')||'<p>該当する役がありません。</p>';
 $('yakuCount').textContent=`${list.length}件を表示中`;
};
$('hanFilter').onclick=e=>{const b=e.target.closest('button');if(!b)return;hf=b.dataset.v==='all'?'all':+b.dataset.v;
 [...$('hanFilter').children].forEach(x=>x.setAttribute('aria-pressed',x===b));renderY()};
$('openOnly').onclick=e=>{oo=!oo;e.target.setAttribute('aria-pressed',oo);renderY()};
$('q').oninput=e=>{q=e.target.value.trim();renderY()};
renderY();

// segmented control helper
const seg=(el,opts,val,cb)=>{const box=$(el);
 box.innerHTML=opts.map(([v,l])=>`<button data-v="${v}" aria-pressed="${v==val}">${l}</button>`).join('');
 box.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
  [...box.children].forEach(x=>x.setAttribute('aria-pressed',x===b));cb(isNaN(b.dataset.v)?b.dataset.v:+b.dataset.v)};
 return v=>[...box.children].forEach(x=>x.setAttribute('aria-pressed',x.dataset.v==v));};

// 符計算
const SETS=[[0,'順子 0符'],[2,'明刻・中張 2符'],[4,'明刻・么九 4符'],[4.1,'暗刻・中張 4符'],[8,'暗刻・么九 8符'],[8.1,'明槓・中張 8符'],[16,'明槓・么九 16符'],[16.1,'暗槓・中張 16符'],[32,'暗槓・么九 32符']];
const F={win:'ron',men:'men',sets:[0,0,0,0],pair:0,wait:0,chi:false};
seg('fuWin',[['ron','ロン'],['tsumo','ツモ']],'ron',v=>{F.win=v;calcFu()});
seg('fuMen',[['men','門前'],['open','鳴きあり'],['chi','七対子']],'men',v=>{F.men=v;calcFu()});
$('fuSets').innerHTML=[0,1,2,3].map(i=>`<div class="row"><select data-i="${i}" aria-label="面子${i+1}">${SETS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>`).join('');
$('fuPair').innerHTML=`<div class="row"><select id="pairSel" aria-label="雀頭"><option value="0">数牌・客風牌 0符</option><option value="2">役牌（三元牌・場風・自風）2符</option><option value="4">連風牌（場風かつ自風）4符</option></select></div>`;
$('fuWait').innerHTML=`<div class="row"><select id="waitSel" aria-label="待ち"><option value="0">両面・シャンポン 0符</option><option value="2">カンチャン・ペンチャン・単騎 2符</option></select></div>`;
$('fuSets').onchange=e=>{F.sets[+e.target.dataset.i]=Math.floor(+e.target.value);calcFu()};
$('pairSel').onchange=e=>{F.pair=+e.target.value;calcFu()};
$('waitSel').onchange=e=>{F.wait=+e.target.value;calcFu()};
let fuNow=30;
const calcFu=()=>{
 const st=[],ts=F.win==='tsumo';let f,note='';
 const dis=F.men==='chi';[...document.querySelectorAll('#fuSets select,#pairSel,#waitSel')].forEach(s=>s.disabled=dis);
 if(dis){f=25;st.push('七対子は25符固定（切り上げなし）');note='七対子';}
 else{
  const men=F.men==='men',ex=F.sets.reduce((a,b)=>a+b,0)+F.pair+F.wait;
  f=20;st.push('副底 20符');
  if(men&&!ts){f+=10;st.push('門前ロン +10符')}
  if(ts&&!(men&&ex===0)){f+=2;st.push('ツモ +2符')}
  F.sets.forEach((v,i)=>v&&st.push(`面子${i+1} +${v}符`));
  if(F.pair)st.push(`雀頭 +${F.pair}符`);if(F.wait)st.push(`待ち +${F.wait}符`);
  f+=ex;const raw=f;f=Math.ceil(f/10)*10;
  if(men&&ex===0){note=ts?'ピンフ・ツモ形（ツモ符なしで20符）':'ピンフ・ロン形';}
  if(!men&&!ts&&raw===20){f=30;note='鳴いてロンで符がない形は30符とします';}
  st.push(raw===f?`合計 ${f}符`:`合計 ${raw}符 → 切り上げて ${f}符`);
 }
 fuNow=f;$('fuBig').textContent=f+'符';$('fuNote').textContent=note;$('fuSteps').innerHTML=st.map(s=>`<li>${s}</li>`).join('');
};
calcFu();

// 点数
const LIM=b=>b>=8000?'役満':b>=6000?'三倍満':b>=4000?'倍満':b>=3000?'跳満':b>=2000?'満貫':'';
const base=(h,f)=>h>=13?8000:h>=11?6000:h>=8?4000:h>=6?3000:h>=5?2000:Math.min(2000,f*2**(h+2));
const up=x=>Math.ceil(x/100)*100,n=x=>x.toLocaleString('ja-JP');
const score=(h,f,oya,ts)=>{const b=base(h,f);
 if(!ts){const t=up(b*(oya?6:4));return{b,t,s:n(t)+'点'}}
 if(oya){const e=up(b*2);return{b,t:e*3,s:n(e)+'オール',e}}
 const k=up(b),o=up(b*2);return{b,t:k*2+o,s:n(k)+' / '+n(o),k,o}};
const valid=(h,f,ts)=>h>=5||!((f===20&&!ts)||(f===25&&h<2));
const P={h:3,f:30,oya:0,ts:0};
const FUS=[20,25,30,40,50,60,70,80,90,100,110];
seg('pHan',[...Array(13)].map((_,i)=>[i+1,(i+1)+'翻']),3,v=>{P.h=v;calcP()});
const setFu=seg('pFu',FUS.map(f=>[f,f+'符']),30,v=>{P.f=v;calcP()});
seg('pOya',[[0,'子'],[1,'親']],0,v=>{P.oya=v;calcP()});
seg('pWin',[[0,'ロン'],[1,'ツモ']],0,v=>{P.ts=v;calcP()});
const calcP=()=>{
 [...$('pFu').children].forEach(b=>b.disabled=P.h>=5);
 const who=(P.oya?'親':'子')+'の'+(P.ts?'ツモ':'ロン');
 $('pHead').textContent=`${who}・${P.h}翻${P.h<5?' '+P.f+'符':''}`;
 if(!valid(P.h,P.f,P.ts)){$('pBig').textContent='—';$('pPay').textContent='';
  $('pSteps').innerHTML=`<li>${P.f===20?'20符のロンはありません（ピンフのロンは30符）。':'25符（七対子）は2翻以上です。'}</li>`;return}
 const r=score(P.h,P.f,P.oya,P.ts),lim=LIM(r.b),st=[];
 if(P.h<5){const raw=P.f*2**(P.h+2);st.push(`基本点 = ${P.f}符 × 2<sup>${P.h}+2</sup> = ${n(raw)}`);if(raw>2000)st.push('2,000を超えたので満貫（基本点2,000）')}
 else st.push(`${P.h}翻は${lim}：基本点 ${n(r.b)}`);
 if(!P.ts)st.push(`${n(r.b)} × ${P.oya?6:4} = ${n(r.b*(P.oya?6:4))} → 100点単位に切り上げ`);
 else if(P.oya)st.push(`子3人がそれぞれ ${n(r.b)} × 2 = ${n(r.b*2)} → 切り上げて ${n(r.e)}点`);
 else st.push(`子2人が ${n(r.b)} → ${n(r.k)}点、親が ${n(r.b)} × 2 → ${n(r.o)}点`);
 $('pBig').textContent=P.ts?r.s:n(r.t)+'点';
 $('pPay').textContent=(lim?lim+'　':'')+(P.ts?`合計 ${n(r.t)}点`:'放銃者が支払い');
 $('pSteps').innerHTML=st.map(s=>`<li>${s}</li>`).join('');
};
calcP();
$('fuSend').onclick=()=>{location.href='points.html?fu='+fuNow};
{const f=+new URLSearchParams(location.search).get('fu');if(FUS.includes(f)){P.f=f;setFu(f);calcP()}}
$('limits').innerHTML=[['5翻','満貫',5],['6〜7翻','跳満',6],['8〜10翻','倍満',8],['11〜12翻','三倍満',11],['13翻以上','数え役満',13]]
 .map(([h,l,v])=>`<tr><td style="text-align:center">${h}</td><td style="text-align:center">${rb(l)}</td><td>${n(score(v,30,0,0).t)}</td><td>${n(score(v,30,1,0).t)}</td></tr>`).join('');

// 早見表
const T={oya:0,ts:0};
const drawT=()=>{
 const rows=FUS.map(f=>`<tr><th>${f}符</th>${[1,2,3,4].map(h=>{
  if(!valid(h,f,T.ts))return '<td class="na">—</td>';
  const r=score(h,f,T.oya,T.ts);return `<td class="${r.b>=2000?'lim':''}">${T.ts?r.s:n(r.t)}${r.b>=2000?'<br><small>満貫</small>':''}</td>`}).join('')}</tr>`).join('');
 $('tbl').innerHTML=`<thead><tr><th></th><th>1翻</th><th>2翻</th><th>3翻</th><th>4翻</th></tr></thead><tbody>${rows}</tbody>`;
};
seg('tOya',[[0,'子'],[1,'親']],0,v=>{T.oya=v;drawT()});
seg('tWin',[[0,'ロン'],[1,'ツモ']],0,v=>{T.ts=v;drawT()});
drawT();

// クイズ
let qs=0,qa=0,cur=null;
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const pick=(oya,ts)=>{for(;;){const h=rnd([1,2,2,3,3,4]),f=rnd([20,25,30,30,40,40,50,60,70]);if(valid(h,f,ts)&&base(h,f)<2000)return[h,f]}};
const newQ=()=>{
 const oya=Math.random()<.4?1:0,ts=Math.random()<.4?1:0,[h,f]=pick(oya,ts),ans=score(h,f,oya,ts).s;
 const set=new Set([ans]);let guard=0;
 while(set.size<4&&guard++<200){const[h2,f2]=pick(oya,ts);set.add(score(h2,f2,oya,ts).s)}
 const opts=[...set].sort(()=>Math.random()-.5);
 cur={h,f,oya,ts,ans,done:false};
 $('qQ').textContent=`${oya?'親':'子'}・${ts?'ツモ':'ロン'}・${h}翻${f}符`;
 $('qOpts').innerHTML=opts.map(o=>`<button>${o}</button>`).join('');$('qExp').textContent='';
};
$('qOpts').onclick=e=>{const b=e.target.closest('button');if(!b||cur.done)return;cur.done=true;qa++;
 const ok=b.textContent===cur.ans;if(ok)qs++;
 [...$('qOpts').children].forEach(x=>{if(x.textContent===cur.ans){x.classList.add('ok');x.textContent='✓ '+x.textContent}else if(x===b){x.classList.add('ng');x.textContent='✗ '+x.textContent}});
 const raw=cur.f*2**(cur.h+2);
 $('qExp').innerHTML=`${ok?'正解！':'不正解。'}基本点は ${cur.f}×2<sup>${cur.h+2}</sup> = ${n(raw)}。${cur.ts?(cur.oya?'子3人が×2ずつ':'子が×1、親が×2'):(cur.oya?'×6':'×4')}して100点単位に切り上げると <b>${cur.ans}</b>。`;
 $('qScore').textContent=`${qs} / ${qa} 問正解`};
$('qNext').onclick=newQ;
newQ();

// ===== 牌効率エンジン（向聴数・受け入れ）=====
const NM=i=>i<27?(i%9+1)+['マン','ピン','ソー'][Math.floor(i/9)]:HON[i-26];
const tileI=(i,cls='',tag='span',attr='')=>{const s=i<27?'mps'[Math.floor(i/9)]:'z',num=i<27?i%9+1:i-26;
 const h=tile(num,s);return h.replace('<span class="t',`<${tag} ${attr} class="t ${cls}`).replace(/<\/span>$/,`</${tag}>`)};
const toIdx=str=>parse(str).map(([n,s])=>({m:0,p:9,s:18,z:27}[s]+n-1));
const cnt=a=>{const c=Array(34).fill(0);a.forEach(i=>c[i]++);return c};
const normalSh=(c,K=0)=>{const dfs=(i,m,t)=>{while(i<34&&!c[i])i++;if(i>=34)return 2*m+Math.min(t,4-K-m);let r=0;
  if(c[i]>=3){c[i]-=3;r=Math.max(r,dfs(i,m+1,t));c[i]+=3}
  if(i<27&&i%9<=6&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;r=Math.max(r,dfs(i,m+1,t));c[i]++;c[i+1]++;c[i+2]++}
  if(c[i]>=2){c[i]-=2;r=Math.max(r,dfs(i,m,t+1));c[i]+=2}
  if(i<27&&i%9<=7&&c[i+1]){c[i]--;c[i+1]--;r=Math.max(r,dfs(i,m,t+1));c[i]++;c[i+1]++}
  if(i<27&&i%9<=6&&c[i+2]){c[i]--;c[i+2]--;r=Math.max(r,dfs(i,m,t+1));c[i]++;c[i+2]++}
  c[i]--;r=Math.max(r,dfs(i,m,t));c[i]++;return r};
 let b=8-2*K-dfs(0,0,0);for(let i=0;i<34;i++)if(c[i]>=2){c[i]-=2;b=Math.min(b,7-2*K-dfs(0,0,0));c[i]+=2}return b};
const chiiSh=c=>{let p=0,k=0;c.forEach(x=>{if(x)k++;if(x>=2)p++});return 6-p+Math.max(0,7-k)};
const YAO=[0,8,9,17,18,26,27,28,29,30,31,32,33];
const kokuSh=c=>{let k=0,p=0;YAO.forEach(i=>{if(c[i])k++;if(c[i]>=2)p=1});return 13-k-p};
const shan=(c,K=0)=>K?normalSh(c,K):Math.min(normalSh(c),chiiSh(c),kokuSh(c));
// 14枚から切る牌ごとの向聴数と受け入れ。seen: 見えている枚数（手牌以外）
const discards=(c,seen,K=0)=>{const out=[];
 for(let d=0;d<34;d++)if(c[d]){c[d]--;const sh=shan(c,K);let n=0;const ts=[];
  for(let t=0;t<34;t++){if(c[t]>=4)continue;c[t]++;if(shan(c,K)<sh){const r=4-(c[t]-1)-(t===d?1:0)-(seen?seen[t]:0);if(r>0){n+=r;ts.push(t)}}c[t]--}
  out.push({d,sh,n,ts});c[d]++}
 return out.sort((a,b)=>a.sh-b.sh||b.n-a.n)};
const shTxt=s=>s<0?'アガリ':s===0?'テンパイ':s+'向聴';

// ===== 何切る問題 =====
const NK=[
['待ちの良さ','134m456p234s789s55s','テンパイの取り方は2通りあります。どちらがアガりやすい？','1m','1マンを切ると34マンの両面待ち（2マン・5マン、8枚）。4マンを切ると13マンのカンチャン待ち（2マンだけ、4枚）。待ちが2種類ある両面待ちのほうが、アガれる牌が倍あります。'],
['3面待ち','23456m678p345s99s1p','つながりのない牌を探しましょう。','1p','1ピンはどこともつながっていない牌。1ピンを切ると23456マンの5枚つながった形が残り、1マン・4マン・7マンの3面待ち（11枚）になります。2マンや6マンを切ってもテンパイしません。'],
['ノベタン','1234m567p345s678s9p','テンパイの取り方は3通りあります。','9p','9ピンを切ると1234マンの「ノベタン」で、1マンか4マンでアガれます（6枚）。1マンや4マンを切ると9ピンの単騎待ち（3枚）。4枚つながった形は、両端どちらでもアガれます。'],
['5枚の連続形','13m45m78p234s99s456p','テンパイできる切り方は1つだけです。','1m','1マンを切ると3マン45マンが345マンの面子になり、ピンズは45678ピンの5枚つながった形。待ちは3ピン・6ピン・9ピンの3面待ち（11枚）です。'],
['6667の形','22m345m67p66p789s11z','ピンズの6667をよく見ましょう。','7p','7ピンを切ると666ピンが刻子になり、22マンと東東のシャンポン待ちでテンパイします（4枚）。ほかの牌を切るとテンパイになりません。同じ牌が3枚あるときは、刻子として見る目も持ちましょう。'],
['テンパイ取り','234m6m8m345p678s9p1z1z','テンパイできる牌があります。','9p','9ピンを切ると68マンのカンチャン（7マン待ち）でテンパイし、リーチをかけられます。8マンを切って良い形を待つほうが受け入れは多いですが、初心者のうちはまずテンパイを取るのが基本です。'],
['七対子','1133m55p77p2s22s6s9s1z','対子がたくさんあります。七対子を目指しましょう。','2s','七対子では同じ牌の3枚目は使えません。2ソーを切れば、6ソー・9ソー・東のどれかが重なればテンパイ（9枚）。ほかを切ると受け入れは6枚に減ります。'],
['孤立した字牌','12m456p345s78s99s6p3z','つながりのない牌は2枚。どちらを切る？','3z','西は同じ牌が来ないと使えません。6ピンは456ピンとくっついて、6ピンが重なれば雀頭、3ピンを引けば3456ピンのような形になり役に立ちます。西切りの受け入れ16枚に対して、6ピン切りは13枚です。'],
['使いにくい端の牌','2m45m789p345s567s9p1p','つながりの弱い牌を探しましょう。','1p','2マンは45マンとくっついて（3マン・6マンで形が良くなる）、9ピンは789ピンとくっついて雀頭の候補になります。1ピンだけがどことも関係のない牌です。1ピン切りの受け入れは20枚で、いちばん多くなります。']];
let nk=0;const nkDone=Array(NK.length).fill(null);
const nkRender=()=>{const [th,h,q,ans,ex]=NK[nk],idx=toIdx(h).sort((a,b)=>a-b),done=nkDone[nk];
 $('nkTitle').textContent=`第${nk+1}問　${th}`;$('nkQ').textContent=q;
 $('nkScore').textContent=`${nkDone.filter(x=>x===true).length} / ${nkDone.filter(x=>x!==null).length} 問正解`;
 $('nkHand').innerHTML=idx.map(i=>tileI(i,'','button',`data-i="${i}" aria-label="${NM(i)}を切る"`)).join('');
 $('nkPrev').disabled=nk===0;$('nkNext').textContent=nk===NK.length-1?'最初の問題へ':'次の問題';
 if(done===null){$('nkVerd').textContent='';$('nkExp').textContent='';$('nkTblWrap').hidden=true;return}
 const ai=toIdx(ans)[0];
 $('nkVerd').textContent=(done?'✓ 正解！':'✗ 残念')+`　答えは ${NM(ai)} 切り`;$('nkExp').textContent=ex;
 const r=discards(cnt(idx));$('nkTblWrap').hidden=false;
 $('nkTbl').innerHTML=r.map(x=>`<tr${x.d===ai?' style="font-weight:800"':''}><td style="text-align:left">${x.d===ai?'★ ':''}${NM(x.d)}</td><td>${shTxt(x.sh)}</td><td>${x.n}枚</td><td style="text-align:left;white-space:normal">${x.ts.map(NM).join(' ')}</td></tr>`).join('');
};
$('nkHand').onclick=e=>{const b=e.target.closest('button');if(!b||nkDone[nk]!==null)return;
 nkDone[nk]=+b.dataset.i===toIdx(NK[nk][3])[0];nkRender()};
$('nkPrev').onclick=()=>{if(nk>0){nk--;nkRender()}};
$('nkNext').onclick=()=>{nk=(nk+1)%NK.length;nkRender()};
nkRender();

// ===== 一人麻雀 =====
const G={};let hint=false;
const gNew=()=>{const w=[];for(let i=0;i<34;i++)for(let k=0;k<4;k++)w.push(i);
 for(let i=w.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[w[i],w[j]]=[w[j],w[i]]}
 G.wall=w.slice(14);G.hand=w.slice(0,13).sort((a,b)=>a-b);G.draw=null;G.river=[];G.turn=0;G.over=false;
 $('gVerd').textContent='';$('gRes').innerHTML='';gDraw()};
const gDraw=()=>{G.turn++;G.draw=G.wall.shift();
 const c=cnt([...G.hand,G.draw]);if(shan(c)===-1){gWin(c);return}gRender()};
const yaku=c=>{const L=[],has=f=>c.some((x,i)=>x&&f(i));
 if(kokuSh(c)===-1)return[['国士無双',13]];
 const norm=normalSh(c)===-1,chii=!norm&&chiiSh(c)===-1;
 const allKo=norm&&c.every(x=>x===0||x===2||x===3)&&c.filter(x=>x===2).length===1;
 const ym=[];if(allKo)ym.push(['四暗刻',13]);
 if([31,32,33].every(i=>c[i]>=3))ym.push(['大三元',13]);
 if(!has(i=>i<27))ym.push(['字一色',13]);
 if(ym.length)return ym;
 L.push(['門前清自摸和',1]);
 if(chii)L.push(['七対子',2]);
 if(!has(i=>YAO.includes(i)))L.push(['断么九',1]);
 if(norm){if(c[27]>=3)L.push(['ダブ東（場風・自風）',2]);[[31,'白'],[32,'發'],[33,'中']].forEach(([i,n])=>{if(c[i]>=3)L.push(['役牌 '+n,1])})}
 const suits=[0,1,2].filter(s=>c.slice(s*9,s*9+9).some(x=>x));
 if(suits.length===1)L.push(has(i=>i>=27)?['混一色',3]:['清一色',6]);
 return L};
const gWin=c=>{G.over=true;const y=yaku(c),h=y.reduce((a,b)=>a+b[1],0);
 $('gVerd').textContent=`ツモ！ ${G.turn}巡目でアガリました`;
 const lim=h>=13?'役満':h>=11?'三倍満':h>=8?'倍満':h>=6?'跳満':h>=5?'満貫':'';
 $('gRes').innerHTML=`<ul>${y.map(([nm,v])=>`<li>${rb(nm)}　${v>=13?rb('役満'):v+'翻'}</li>`).join('')}</ul><p><b>合計 ${h>=13?rb('役満'):h+'翻'}</b>${lim?`（親の${rb(lim)}：${n(score(h,30,1,1).e)}オール）`:'。ドラは数えていません。符を数えて、上の「点数計算」で点数を出してみましょう。'}</p>`;
 gRender()};
const gRender=()=>{
 const all=G.draw===null?G.hand:[...G.hand,G.draw];const c=cnt(all);
 $('gTurn').textContent=`${Math.min(G.turn,18)} / 18 巡目`;$('gWall').textContent=`山 残り${G.wall.length}枚`;
 const cs=shan(c);$('gShan').textContent=G.draw===null?shTxt(cs):cs===-1?'アガリ':'切ると '+shTxt(discards(c)[0].sh);
 $('gHand').innerHTML=G.hand.map((i,k)=>tileI(i,'','button',`data-k="${k}" aria-label="${NM(i)}を切る"${G.over?' disabled':''}`)).join('')+
  (G.draw===null?'':tileI(G.draw,'drawn','button',`data-k="d" aria-label="ツモった${NM(G.draw)}を切る"${G.over?' disabled':''}`));
 $('gRiver').innerHTML=G.river.map(i=>tileI(i,'sm')).join('');
 const ht=$('gHintTxt');ht.hidden=!hint||G.over;
 if(hint&&!G.over){const seen=cnt(G.river),best=discards(c,seen)[0];ht.textContent=`おすすめ：${NM(best.d)}切り（${shTxt(best.sh)}・受け入れ${best.n}枚）`}
};
$('gHand').onclick=e=>{const b=e.target.closest('button');if(!b||G.over)return;
 let out;if(b.dataset.k==='d'){out=G.draw}else{out=G.hand.splice(+b.dataset.k,1)[0];G.hand.push(G.draw);G.hand.sort((a,b)=>a-b)}
 G.draw=null;G.river.push(out);
 if(G.turn>=18||!G.wall.length){G.over=true;const s=shan(cnt(G.hand));
  $('gVerd').textContent=s===0?'流局：テンパイでした（あと1枚！）':`流局：${s}向聴でした`;
  $('gRes').innerHTML='<p>ヒントを表示して、受け入れの多い切り方を見比べてみましょう。</p>';gRender();return}
 gDraw()};
$('gHint').onclick=e=>{hint=!hint;e.target.setAttribute('aria-pressed',hint);gRender()};
$('gNew').onclick=gNew;
gNew();


// ===== 役クイズ =====
const YQ={"平和": [1, ["平和"]], "断么九": [1, ["断么九", "平和"]], "一盃口": [0, ["平和", "一盃口"]], "役牌": [31, ["役牌 白"]], "七対子": [0, ["七対子"]], "三色同順": [0, ["平和", "三色同順"]], "一気通貫": [0, ["平和", "一気通貫"]], "混全帯么九": [0, ["場風 東", "混全帯么九"]], "対々和": [1, ["対々和", "三暗刻"]], "三暗刻": [20, ["断么九", "三暗刻"]], "三色同刻": [2, ["断么九", "三色同刻"]], "小三元": [31, ["役牌 白", "役牌 發", "小三元"]], "混老頭": [0, ["場風 東", "自風 南", "対々和", "三暗刻", "混老頭"]], "二盃口": [0, ["平和", "二盃口"]], "純全帯么九": [0, ["純全帯么九"]], "混一色": [0, ["混一色", "自風 南"]], "清一色": [18, ["清一色", "平和", "一気通貫"]], "国士無双": [0, ["国士無双"]], "四暗刻": [15, ["四暗刻"]], "大三元": [31, ["大三元"]], "字一色": [27, ["字一色"]], "小四喜": [27, ["小四喜"]], "大四喜": [27, ["大四喜"]], "緑一色": [19, ["緑一色"]], "清老頭": [0, ["清老頭"]], "九蓮宝燈": [0, ["九蓮宝燈"]]}; // 例の手のアガリ牌と、成り立つ役（ロン・門前・場風東・自風南で計算）
const YQB=nm=>/^(役牌|場風|自風) /.test(nm)?'役牌':nm;
const YQX={'三暗刻':['四暗刻'],'対々和':['四暗刻'],'二盃口':['一盃口'],'一盃口':['二盃口'],'純全帯么九':['混全帯么九'],'混全帯么九':['純全帯么九'],
 '清一色':['混一色'],'混一色':['清一色'],'混老頭':['混全帯么九','純全帯么九'],'小三元':['大三元'],'大三元':['小三元'],'小四喜':['大四喜'],'大四喜':['小四喜'],'四暗刻':['三暗刻','対々和']};
const YN=Object.fromEntries(Y.map(y=>[y[0],y]));
const HANS=['1翻','2翻','3翻','6翻','役満'],NAKI=['鳴いてもOK','鳴くと1翻下がる','門前限定（鳴くと不可）'];
const hanL=y=>y[2]===13?'役満':y[2]+'翻',nakiL=y=>y[3]===0?NAKI[2]:y[3]===y[2]?NAKI[0]:NAKI[1];
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
let yqMode='all',yq=null;
const yqGen=(type,used)=>{
 if(type==='hand'){const ks=shuf(Object.keys(YQ).filter(k=>!used.has('h'+k)));const k=ks[0];used.add('h'+k);
  const [w,ys]=YQ[k],pr=new Set(ys.map(YQB)),ex=YQX[k]||[];
  const pool=shuf(Y.filter(y=>y[5]&&y[0]!==k&&!pr.has(y[0])&&!ex.includes(y[0])).map(y=>y[0])).slice(0,3);
  return{type,key:k,w,ys,q:'この手で成り立っている役はどれ？',opts:shuf([k,...pool]),ans:k,ruby:true}}
 const y=shuf(Y.filter(y=>!used.has(type+y[0])))[0];used.add(type+y[0]);
 if(type==='han'){const a=hanL(y);return{type,key:y[0],q:`「${rb(y[0])}」は何翻の役？（門前のとき）`,opts:HANS.filter(x=>x===a||Math.random()<.75).slice(0,4).concat(HANS.length?[]:[]),ans:a}}
 if(type==='naki')return{type,key:y[0],q:`「${rb(y[0])}」は、ポンやチーをしても成り立つ？`,opts:NAKI.slice(),ans:nakiL(y)};
 const others=shuf(Y.filter(z=>z[1]!==y[1]).map(z=>z[1])).slice(0,3);
 return{type,key:y[0],q:`「${y[0]}」の読み方は？`,opts:shuf([y[1],...others]),ans:y[1]}};
const yqStart=()=>{const types=yqMode==='all'?['hand','han','naki','read']:[yqMode],used=new Set(),qs=[];
 for(let i=0;i<10;i++)qs.push(yqGen(types[yqMode==='all'?(i%4+Math.floor(Math.random()*4))%4:0],used));
 qs.forEach(q=>{if(q.type==='han'){let o=HANS.filter(x=>x!==q.ans);o=shuf(o).slice(0,3).concat(q.ans);q.opts=HANS.filter(x=>o.includes(x))}});
 yq={qs,i:0,ok:0,done:false};yqRender()};
const yqRender=()=>{const q=yq.qs[yq.i];
 if(yq.i>=yq.qs.length){$('yqNo').textContent='結果';$('yqQ').innerHTML=`10問中 ${yq.ok}問 正解！${yq.ok>=9?'役はばっちりです。':yq.ok>=6?'あと少し。役一覧で見直してみましょう。':'役一覧を見ながら、もう一度挑戦してみましょう。'}`;
  $('yqHand').innerHTML='';$('yqOpts').innerHTML='';$('yqExp').innerHTML='';$('yqNext').textContent='もう一度（新しい10問）';return}
 $('yqNo').textContent=`第${yq.i+1}問 / 10`;$('yqScore').textContent=`${yq.ok}問正解`;
 $('yqQ').innerHTML=q.q;
 if(q.type==='hand'){const a=toIdx(YN[q.key][5]).sort((x,y)=>x-y);a.splice(a.indexOf(q.w),1);
  $('yqHand').innerHTML=`<div class="tiles big-t" style="margin:6px 0">${a.map(t=>tileI(t)).join('')}<span style="width:10px"></span>${tileI(q.w,'win')}</div><p class="note">門前でロン。黄色い枠がアガリ牌です（場風は東、自風は南）。</p>`}
 else $('yqHand').innerHTML='';
 $('yqOpts').innerHTML=q.opts.map((o,i)=>`<button data-i="${i}">${q.ruby?rb(o):o}</button>`).join('');
 $('yqExp').innerHTML='';yq.done=false;$('yqNext').textContent=yq.i===9?'結果を見る':'次の問題';$('yqNext').disabled=true;
};
$('yqOpts').onclick=e=>{const b=e.target.closest('button');if(!b||yq.done)return;yq.done=true;
 const q=yq.qs[yq.i],pick=q.opts[+b.dataset.i],ok=pick===q.ans;if(ok)yq.ok++;
 [...$('yqOpts').children].forEach((x,i)=>{if(q.opts[i]===q.ans){x.classList.add('ok');x.insertAdjacentText('afterbegin','✓ ')}else if(x===b){x.classList.add('ng');x.insertAdjacentText('afterbegin','✗ ')}});
 const y=YN[q.key];
 let ex=`<p class="verd">${ok?'正解！':'残念！'}</p><p><b>${rb(y[0])}</b>　${hanL(y)}・${nakiL(y)}</p><p>${y[4]}</p>`;
 if(q.type==='hand'){const all=[...new Set(q.ys.map(n=>rb(n)))];ex+=`<p>この手で成り立つ役：${all.join('、')}</p>`}
 else if(y[5])ex+=`<div class="tiles" style="margin-top:6px">${tiles(y[5])}</div>`;
 $('yqExp').innerHTML=`<div class="yqx">${ex}</div>`;$('yqScore').textContent=`${yq.ok}問正解`;$('yqNext').disabled=false};
$('yqNext').onclick=()=>{if(yq.i>=yq.qs.length){yqStart();return}yq.i++;yqRender()};
seg('yqMode',[['all','すべてまぜる'],['hand','牌の並びから役'],['han','翻数'],['naki','鳴き'],['read','読み方']],'all',v=>{yqMode=v;yqStart()});
yqStart();
// 以前の1ページ版のリンク（index.html#yaku など）を新しいページへ
{const M={basics:'basics.html',rules:'basics.html#rules',yaku:'yaku.html',yquiz:'yaku-quiz.html',fu:'fu.html',points:'points.html',table:'points.html#table',quiz:'score-quiz.html',nanikiru:'nanikiru.html',game:'solo.html',match:'game.html'};
 const h=location.hash.slice(1);if(document.getElementById('menu')&&M[h])location.replace(M[h])}
}
