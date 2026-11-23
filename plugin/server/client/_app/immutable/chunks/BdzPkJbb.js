import{A as e,B as t,C as n,D as r,E as i,F as a,G as o,H as s,I as c,J as l,K as u,L as d,M as f,N as p,O as m,P as h,R as g,S as _,T as v,U as y,V as b,W as x,X as S,Y as C,Z as w,_ as T,a as E,b as ee,c as D,d as O,f as k,g as A,h as te,i as j,j as M,k as N,l as ne,m as P,n as re,o as F,p as I,q as ie,r as L,s as R,t as ae,u as z,v as oe,w as se,x as B,y as ce,z as le}from"./BpEvp0Wl.js";var ue=e=>e!=null,de=e=>e.filter(ue);function fe(e){return(...t)=>{for(let n of e)n&&n(...t)}}var V=e=>typeof e==`function`&&!e.length?e():e,pe=e=>Array.isArray(e)?e:e?[e]:[];function me(e,...t){return typeof e==`function`?e(...t):e}var he=n;function ge(e,t,n,r){let i=e.length,a=t.length,o=0;if(!a){for(;o<i;o++)n(e[o]);return}if(!i){for(;o<a;o++)r(t[o]);return}for(;o<a&&t[o]===e[o];o++);let s,c;t=t.slice(o),e=e.slice(o);for(s of t)e.includes(s)||r(s);for(c of e)t.includes(c)||n(c)}function _e(e){let[t,r]=o(),i=e?.throw?(e,t)=>{throw r(e instanceof Error?e:Error(t)),e}:(e,t)=>{r(e instanceof Error?e:Error(t))},a=e?.api?Array.isArray(e.api)?e.api:[e.api]:[globalThis.localStorage].filter(Boolean),c=e?.prefix?`${e.prefix}.`:``,l=new Map,u=new Proxy({},{get(t,n){let r=l.get(n);r||(r=o(void 0,{equals:!1}),l.set(n,r)),r[0]();let s=a.reduce((e,t)=>{if(e!==null||!t)return e;try{return t.getItem(`${c}${n}`)}catch(e){return i(e,`Error reading ${c}${n} from ${t.name}`),null}},null);return s!==null&&e?.deserializer?e.deserializer(s,n,e.options):s}});return e?.sync!==!1&&s(()=>{let e=e=>{let t=!1;a.forEach(n=>{try{n!==e.storageArea&&e.key&&e.newValue!==n.getItem(e.key)&&(e.newValue?n.setItem(e.key,e.newValue):n.removeItem(e.key),t=!0)}catch(t){i(t,`Error synching api ${n.name} from storage event (${e.key}=${e.newValue})`)}}),t&&e.key&&l.get(e.key)?.[1]()};`addEventListener`in globalThis?(globalThis.addEventListener(`storage`,e),n(()=>globalThis.removeEventListener(`storage`,e))):(a.forEach(t=>t.addEventListener?.(`storage`,e)),n(()=>a.forEach(t=>t.removeEventListener?.(`storage`,e))))}),[u,(t,n,r)=>{let o=e?.serializer?e.serializer(n,t,r??e.options):n,s=`${c}${t}`;a.forEach(e=>{try{e.getItem(s)!==o&&e.setItem(s,o)}catch(n){i(n,`Error setting ${c}${t} to ${o} in ${e.name}`)}});let u=l.get(t);u&&u[1]()},{clear:()=>a.forEach(e=>{try{e.clear()}catch(t){i(t,`Error clearing ${e.name}`)}}),error:t,remove:e=>a.forEach(t=>{try{t.removeItem(`${c}${e}`)}catch(n){i(n,`Error removing ${c}${e} from ${t.name}`)}}),toJSON:()=>{let t={},n=(n,r)=>{if(!t.hasOwnProperty(n)){let i=r&&e?.deserializer?e.deserializer(r,n,e.options):r;i&&(t[n]=i)}};return a.forEach(e=>{if(typeof e.getAll==`function`){let t;try{t=e.getAll()}catch(t){i(t,`Error getting all values from in ${e.name}`)}for(let e of t)n(e,t[e])}else{let r=0,a;try{for(;a=e.key(r++);)t.hasOwnProperty(a)||n(a,e.getItem(a))}catch(t){i(t,`Error getting all values from ${e.name}`)}}}),t}}]}var ve=_e,ye=e=>(typeof e.clear==`function`||(e.clear=()=>{let t;for(;t=e.key(0);)e.removeItem(t)}),e),be=e=>{if(!e)return``;let t=``;for(let n in e){if(!e.hasOwnProperty(n))continue;let r=e[n];t+=r instanceof Date?`; ${n}=${r.toUTCString()}`:typeof r==`boolean`?`; ${n}`:`; ${n}=${r}`}return t},xe=ye({_cookies:[globalThis.document,`cookie`],getItem:e=>xe._cookies[0][xe._cookies[1]].match(`(^|;)\\s*`+e+`\\s*=\\s*([^;]+)`)?.pop()??null,setItem:(e,t,n)=>{let r=xe.getItem(e);xe._cookies[0][xe._cookies[1]]=`${e}=${t}${be(n)}`;let i=Object.assign(new Event(`storage`),{key:e,oldValue:r,newValue:t,url:globalThis.document.URL,storageArea:xe});window.dispatchEvent(i)},removeItem:e=>{xe._cookies[0][xe._cookies[1]]=`${e}=deleted${be({expires:new Date(0)})}`},key:e=>{let t=null,n=0;return xe._cookies[0][xe._cookies[1]].replace(/(?:^|;)\s*(.+?)\s*=\s*[^;]+/g,(r,i)=>(!t&&i&&n++===e&&(t=i),``)),t},get length(){let e=0;return xe._cookies[0][xe._cookies[1]].replace(/(?:^|;)\s*.+?\s*=\s*[^;]+/g,t=>(e+=+!!t,``)),e}}),Se=F({client:void 0,onlineManager:void 0,queryFlavor:``,version:``,shadowDOMTarget:void 0});function H(){return c(Se)}var Ce=F();function we(){let e=c(Ce);if(!e)throw Error(`Missing DevtoolsOfflineProvider`);return e}function Te(e){let[t,r]=o(!1),i=H();l(()=>{let e=i.onlineManager;r(!e.isOnline());let t=e.subscribe(e=>r(!e));n(t)});let a={offline:t,toggleOffline:()=>{let e=i.onlineManager;e.setOnline(!e.isOnline())}};return T(Ce.Provider,{value:a,get children(){return e.children}})}function Ee(){let e=new Map;function t(t,r,i=()=>!0){let a=Symbol();e.set(a,{shouldUpdate:i,update:e=>r(t(e))}),n(()=>e.delete(a))}function r(t,n,r=e=>e()){for(let[i,a]of e)a.shouldUpdate(n)&&r(()=>{e.has(i)&&a.update(t)})}return{register:t,notify:r}}var De=F();function Oe(){let e=c(De);if(!e)throw Error(`Missing DevtoolsSubscriptionsProvider`);return e}function ke(e){let t={queryCacheSubscriptions:Ee(),mutationCacheSubscriptions:Ee()};return T(De.Provider,{value:t,get children(){return e.children}})}var Ae=F();function je(){let e=c(Ae);if(!e)throw Error(`Missing DevtoolsStateProvider`);return e}function Me(e){let[t,n]=o(null),[r,i]=o(null),[a,s]=o(0),c={selectedQueryHash:t,setSelectedQueryHash:n,selectedMutationId:r,setSelectedMutationId:i,panelWidth:a,setPanelWidth:s};return T(Ae.Provider,{value:c,get children(){return e.children}})}var Ne={À:`A`,Á:`A`,Â:`A`,Ã:`A`,Ä:`A`,Å:`A`,Ấ:`A`,Ắ:`A`,Ẳ:`A`,Ẵ:`A`,Ặ:`A`,Æ:`AE`,Ầ:`A`,Ằ:`A`,Ȃ:`A`,Ç:`C`,Ḉ:`C`,È:`E`,É:`E`,Ê:`E`,Ë:`E`,Ế:`E`,Ḗ:`E`,Ề:`E`,Ḕ:`E`,Ḝ:`E`,Ȇ:`E`,Ì:`I`,Í:`I`,Î:`I`,Ï:`I`,Ḯ:`I`,Ȋ:`I`,Ð:`D`,Ñ:`N`,Ò:`O`,Ó:`O`,Ô:`O`,Õ:`O`,Ö:`O`,Ø:`O`,Ố:`O`,Ṍ:`O`,Ṓ:`O`,Ȏ:`O`,Ù:`U`,Ú:`U`,Û:`U`,Ü:`U`,Ý:`Y`,à:`a`,á:`a`,â:`a`,ã:`a`,ä:`a`,å:`a`,ấ:`a`,ắ:`a`,ẳ:`a`,ẵ:`a`,ặ:`a`,æ:`ae`,ầ:`a`,ằ:`a`,ȃ:`a`,ç:`c`,ḉ:`c`,è:`e`,é:`e`,ê:`e`,ë:`e`,ế:`e`,ḗ:`e`,ề:`e`,ḕ:`e`,ḝ:`e`,ȇ:`e`,ì:`i`,í:`i`,î:`i`,ï:`i`,ḯ:`i`,ȋ:`i`,ð:`d`,ñ:`n`,ò:`o`,ó:`o`,ô:`o`,õ:`o`,ö:`o`,ø:`o`,ố:`o`,ṍ:`o`,ṓ:`o`,ȏ:`o`,ù:`u`,ú:`u`,û:`u`,ü:`u`,ý:`y`,ÿ:`y`,Ā:`A`,ā:`a`,Ă:`A`,ă:`a`,Ą:`A`,ą:`a`,Ć:`C`,ć:`c`,Ĉ:`C`,ĉ:`c`,Ċ:`C`,ċ:`c`,Č:`C`,č:`c`,C̆:`C`,c̆:`c`,Ď:`D`,ď:`d`,Đ:`D`,đ:`d`,Ē:`E`,ē:`e`,Ĕ:`E`,ĕ:`e`,Ė:`E`,ė:`e`,Ę:`E`,ę:`e`,Ě:`E`,ě:`e`,Ĝ:`G`,Ǵ:`G`,ĝ:`g`,ǵ:`g`,Ğ:`G`,ğ:`g`,Ġ:`G`,ġ:`g`,Ģ:`G`,ģ:`g`,Ĥ:`H`,ĥ:`h`,Ħ:`H`,ħ:`h`,Ḫ:`H`,ḫ:`h`,Ĩ:`I`,ĩ:`i`,Ī:`I`,ī:`i`,Ĭ:`I`,ĭ:`i`,Į:`I`,į:`i`,İ:`I`,ı:`i`,Ĳ:`IJ`,ĳ:`ij`,Ĵ:`J`,ĵ:`j`,Ķ:`K`,ķ:`k`,Ḱ:`K`,ḱ:`k`,K̆:`K`,k̆:`k`,Ĺ:`L`,ĺ:`l`,Ļ:`L`,ļ:`l`,Ľ:`L`,ľ:`l`,Ŀ:`L`,ŀ:`l`,Ł:`l`,ł:`l`,Ḿ:`M`,ḿ:`m`,M̆:`M`,m̆:`m`,Ń:`N`,ń:`n`,Ņ:`N`,ņ:`n`,Ň:`N`,ň:`n`,ŉ:`n`,N̆:`N`,n̆:`n`,Ō:`O`,ō:`o`,Ŏ:`O`,ŏ:`o`,Ő:`O`,ő:`o`,Œ:`OE`,œ:`oe`,P̆:`P`,p̆:`p`,Ŕ:`R`,ŕ:`r`,Ŗ:`R`,ŗ:`r`,Ř:`R`,ř:`r`,R̆:`R`,r̆:`r`,Ȓ:`R`,ȓ:`r`,Ś:`S`,ś:`s`,Ŝ:`S`,ŝ:`s`,Ş:`S`,Ș:`S`,ș:`s`,ş:`s`,Š:`S`,š:`s`,Ţ:`T`,ţ:`t`,ț:`t`,Ț:`T`,Ť:`T`,ť:`t`,Ŧ:`T`,ŧ:`t`,T̆:`T`,t̆:`t`,Ũ:`U`,ũ:`u`,Ū:`U`,ū:`u`,Ŭ:`U`,ŭ:`u`,Ů:`U`,ů:`u`,Ű:`U`,ű:`u`,Ų:`U`,ų:`u`,Ȗ:`U`,ȗ:`u`,V̆:`V`,v̆:`v`,Ŵ:`W`,ŵ:`w`,Ẃ:`W`,ẃ:`w`,X̆:`X`,x̆:`x`,Ŷ:`Y`,ŷ:`y`,Ÿ:`Y`,Y̆:`Y`,y̆:`y`,Ź:`Z`,ź:`z`,Ż:`Z`,ż:`z`,Ž:`Z`,ž:`z`,ſ:`s`,ƒ:`f`,Ơ:`O`,ơ:`o`,Ư:`U`,ư:`u`,Ǎ:`A`,ǎ:`a`,Ǐ:`I`,ǐ:`i`,Ǒ:`O`,ǒ:`o`,Ǔ:`U`,ǔ:`u`,Ǖ:`U`,ǖ:`u`,Ǘ:`U`,ǘ:`u`,Ǚ:`U`,ǚ:`u`,Ǜ:`U`,ǜ:`u`,Ứ:`U`,ứ:`u`,Ṹ:`U`,ṹ:`u`,Ǻ:`A`,ǻ:`a`,Ǽ:`AE`,ǽ:`ae`,Ǿ:`O`,ǿ:`o`,Þ:`TH`,þ:`th`,Ṕ:`P`,ṕ:`p`,Ṥ:`S`,ṥ:`s`,X́:`X`,x́:`x`,Ѓ:`Г`,ѓ:`г`,Ќ:`К`,ќ:`к`,A̋:`A`,a̋:`a`,E̋:`E`,e̋:`e`,I̋:`I`,i̋:`i`,Ǹ:`N`,ǹ:`n`,Ồ:`O`,ồ:`o`,Ṑ:`O`,ṑ:`o`,Ừ:`U`,ừ:`u`,Ẁ:`W`,ẁ:`w`,Ỳ:`Y`,ỳ:`y`,Ȁ:`A`,ȁ:`a`,Ȅ:`E`,ȅ:`e`,Ȉ:`I`,ȉ:`i`,Ȍ:`O`,ȍ:`o`,Ȑ:`R`,ȑ:`r`,Ȕ:`U`,ȕ:`u`,B̌:`B`,b̌:`b`,Č̣:`C`,č̣:`c`,Ê̌:`E`,ê̌:`e`,F̌:`F`,f̌:`f`,Ǧ:`G`,ǧ:`g`,Ȟ:`H`,ȟ:`h`,J̌:`J`,ǰ:`j`,Ǩ:`K`,ǩ:`k`,M̌:`M`,m̌:`m`,P̌:`P`,p̌:`p`,Q̌:`Q`,q̌:`q`,Ř̩:`R`,ř̩:`r`,Ṧ:`S`,ṧ:`s`,V̌:`V`,v̌:`v`,W̌:`W`,w̌:`w`,X̌:`X`,x̌:`x`,Y̌:`Y`,y̌:`y`,A̧:`A`,a̧:`a`,B̧:`B`,b̧:`b`,Ḑ:`D`,ḑ:`d`,Ȩ:`E`,ȩ:`e`,Ɛ̧:`E`,ɛ̧:`e`,Ḩ:`H`,ḩ:`h`,I̧:`I`,i̧:`i`,Ɨ̧:`I`,ɨ̧:`i`,M̧:`M`,m̧:`m`,O̧:`O`,o̧:`o`,Q̧:`Q`,q̧:`q`,U̧:`U`,u̧:`u`,X̧:`X`,x̧:`x`,Z̧:`Z`,z̧:`z`},Pe=Object.keys(Ne).join(`|`),Fe=new RegExp(Pe,`g`);function Ie(e){return e.replace(Fe,e=>Ne[e])}var Le={CASE_SENSITIVE_EQUAL:7,EQUAL:6,STARTS_WITH:5,WORD_STARTS_WITH:4,CONTAINS:3,ACRONYM:2,MATCHES:1,NO_MATCH:0};function Re(e,t,n){if(n||={},n.threshold=n.threshold??Le.MATCHES,!n.accessors){let r=ze(e,t,n);return{rankedValue:e,rank:r,accessorIndex:-1,accessorThreshold:n.threshold,passed:r>=n.threshold}}let r=We(e,n.accessors),i={rankedValue:e,rank:Le.NO_MATCH,accessorIndex:-1,accessorThreshold:n.threshold,passed:!1};for(let e=0;e<r.length;e++){let a=r[e],o=ze(a.itemValue,t,n),{minRanking:s,maxRanking:c,threshold:l=n.threshold}=a.attributes;o<s&&o>=Le.MATCHES?o=s:o>c&&(o=c),o=Math.min(o,c),o>=l&&o>i.rank&&(i.rank=o,i.passed=!0,i.accessorIndex=e,i.accessorThreshold=l,i.rankedValue=a.itemValue)}return i}function ze(e,t,n){return e=He(e,n),t=He(t,n),t.length>e.length?Le.NO_MATCH:e===t?Le.CASE_SENSITIVE_EQUAL:(e=e.toLowerCase(),t=t.toLowerCase(),e===t?Le.EQUAL:e.startsWith(t)?Le.STARTS_WITH:e.includes(` ${t}`)?Le.WORD_STARTS_WITH:e.includes(t)?Le.CONTAINS:t.length===1?Le.NO_MATCH:Be(e).includes(t)?Le.ACRONYM:Ve(e,t))}function Be(e){let t=``;return e.split(` `).forEach(e=>{e.split(`-`).forEach(e=>{t+=e.substr(0,1)})}),t}function Ve(e,t){let n=0,r=0;function i(e,t,r){for(let i=r,a=t.length;i<a;i++)if(t[i]===e)return n+=1,i+1;return-1}function a(e){let r=1/e,i=n/t.length;return Le.MATCHES+i*r}let o=i(t[0],e,0);if(o<0)return Le.NO_MATCH;r=o;for(let n=1,a=t.length;n<a;n++){let a=t[n];if(r=i(a,e,r),!(r>-1))return Le.NO_MATCH}return a(r-o)}function He(e,{keepDiacritics:t}){return e=`${e}`,t||(e=Ie(e)),e}function Ue(e,t){let n=t;typeof t==`object`&&(n=t.accessor);let r=n(e);return r==null?[]:Array.isArray(r)?r:[String(r)]}function We(e,t){let n=[];for(let r=0,i=t.length;r<i;r++){let i=t[r],a=Ke(i),o=Ue(e,i);for(let e=0,t=o.length;e<t;e++)n.push({itemValue:o[e],attributes:a})}return n}var Ge={maxRanking:1/0,minRanking:-1/0};function Ke(e){return typeof e==`function`?Ge:{...Ge,...e}}var qe={data:``},Je=e=>{if(typeof window==`object`){let t=(e?e.querySelector(`#_goober`):window._goober)||Object.assign(document.createElement(`style`),{innerHTML:` `,id:`_goober`});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||qe},Ye=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,Xe=/\/\*[^]*?\*\/|  +/g,Ze=/\n+/g,Qe=(e,t)=>{let n=``,r=``,i=``;for(let a in e){let o=e[a];a[0]==`@`?a[1]==`i`?n=a+` `+o+`;`:r+=a[1]==`f`?Qe(o,a):a+`{`+Qe(o,a[1]==`k`?``:t)+`}`:typeof o==`object`?r+=Qe(o,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+` `+t:t)):a):o!=null&&(a=a[1]==`-`?a:a.replace(/[A-Z]/g,`-$&`).toLowerCase(),i+=Qe.p?Qe.p(a,o):a+`:`+o+`;`)}return n+(t&&i?t+`{`+i+`}`:i)+r},$e={},et=e=>{if(typeof e==`object`){let t=``;for(let n in e)t+=n+et(e[n]);return t}return e},tt=(e,t,n,r,i)=>{let a=et(e),o=$e[a]||($e[a]=(e=>{let t=0,n=11;for(;t<e.length;)n=101*n+e.charCodeAt(t++)>>>0;return`go`+n})(a));if(!$e[o]){let t=a===e?(e=>{let t,n,r=[{}];for(;t=Ye.exec(e.replace(Xe,``));)t[4]?r.shift():t[3]?(n=t[3].replace(Ze,` `).trim(),r.unshift(r[0][n]=r[0][n]||{})):r[0][t[1]]=t[2].replace(Ze,` `).trim();return r[0]})(e):e;$e[o]=Qe(i?{[`@keyframes `+o]:t}:t,n?``:`.`+o)}let s=n&&$e.g;return n&&($e.g=$e[o]),((e,t,n,r)=>{r?t.data=t.data.replace(r,e):t.data.indexOf(e)===-1&&(t.data=n?e+t.data:t.data+e)})($e[o],t,r,s),o},nt=(e,t,n)=>e.reduce((e,r,i)=>{let a=t[i];if(a&&a.call){let e=a(n),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?`.`+t:e&&typeof e==`object`?e.props?``:Qe(e,``):!1===e?``:e}return e+r+(a??``)},``);function U(e){let t=this||{},n=e.call?e(t.p):e;return tt(n.unshift?n.raw?nt(n,[].slice.call(arguments,1),t.p):n.reduce((e,n)=>Object.assign(e,n&&n.call?n(t.p):n),{}):n,Je(t.target),t.g,t.o,t.k)}U.bind({g:1}),U.bind({k:1});function rt(e){var t,n,r=``;if(typeof e==`string`||typeof e==`number`)r+=e;else if(typeof e==`object`){if(Array.isArray(e)){var i=e.length;for(t=0;t<i;t++)e[t]&&(n=rt(e[t]))&&(r&&(r+=` `),r+=n)}else for(n in e)e[n]&&(r&&(r+=` `),r+=n)}return r}function W(){for(var e,t,n=0,r=``,i=arguments.length;n<i;n++)(e=arguments[n])&&(t=rt(e))&&(r&&(r+=` `),r+=t);return r}var it=()=>{};function at(e,n){let r=u(e),{onChange:i}=n,a=new Set(n.appear?void 0:r),s=new WeakSet,[c,l]=o([],{equals:!1}),[d]=M(),f=n.exitMethod===`remove`?it:e=>{l(t=>(t.push.apply(t,e),t));for(let t of e)s.delete(t)},p=n.exitMethod===`remove`?it:n.exitMethod===`keep-index`?(e,t,n)=>e.splice(n,0,t):(e,t)=>e.push(t);return B(n=>{let r=c(),o=e();if(o[t],u(d))return d(),n;if(r.length){let e=n.filter(e=>!r.includes(e));return r.length=0,i({list:e,added:[],removed:[],unchanged:e,finishRemoved:f}),e}return u(()=>{let e=new Set(o),t=o.slice(),r=[],c=[],l=[];for(let e of o)(a.has(e)?l:r).push(e);let u=!r.length;for(let r=0;r<n.length;r++){let i=n[r];e.has(i)||(s.has(i)||(c.push(i),s.add(i)),p(t,i,r)),u&&i!==t[r]&&(u=!1)}return!c.length&&u?n:(i({list:t,added:r,removed:c,unchanged:l,finishRemoved:f}),a=e,t)})},n.appear?[]:r.slice())}function ot(...e){return fe(e)}var st=e=>e instanceof Element;function ct(e,t){if(t(e))return e;if(typeof e==`function`&&!e.length)return ct(e(),t);if(Array.isArray(e)){let n=[];for(let r of e){let e=ct(r,t);e&&(Array.isArray(e)?n.push.apply(n,e):n.push(e))}return n.length?n:null}return null}function lt(e,t=st,n=st){let r=B(e),i=B(()=>ct(r(),t));return i.toArray=()=>{let e=i();return Array.isArray(e)?e:e?[e]:[]},i}function ut(e){return B(()=>{let t=e.name||`s`;return{enterActive:(e.enterActiveClass||t+`-enter-active`).split(` `),enter:(e.enterClass||t+`-enter`).split(` `),enterTo:(e.enterToClass||t+`-enter-to`).split(` `),exitActive:(e.exitActiveClass||t+`-exit-active`).split(` `),exit:(e.exitClass||t+`-exit`).split(` `),exitTo:(e.exitToClass||t+`-exit-to`).split(` `),move:(e.moveClass||t+`-move`).split(` `)}})}function dt(e){requestAnimationFrame(()=>requestAnimationFrame(e))}function ft(e,t,n,r){let{onBeforeEnter:i,onEnter:a,onAfterEnter:o}=t;i?.(n),n.classList.add(...e.enter),n.classList.add(...e.enterActive),queueMicrotask(()=>{if(!n.parentNode)return r?.();a?.(n,()=>s())}),dt(()=>{n.classList.remove(...e.enter),n.classList.add(...e.enterTo),(!a||a.length<2)&&(n.addEventListener(`transitionend`,s),n.addEventListener(`animationend`,s))});function s(t){t&&t.target!==n||(r?.(),n.removeEventListener(`transitionend`,s),n.removeEventListener(`animationend`,s),n.classList.remove(...e.enterActive),n.classList.remove(...e.enterTo),o?.(n))}}function pt(e,t,n,r){let{onBeforeExit:i,onExit:a,onAfterExit:o}=t;if(!n.parentNode)return r?.();i?.(n),n.classList.add(...e.exit),n.classList.add(...e.exitActive),a?.(n,()=>s()),dt(()=>{n.classList.remove(...e.exit),n.classList.add(...e.exitTo),(!a||a.length<2)&&(n.addEventListener(`transitionend`,s),n.addEventListener(`animationend`,s))});function s(t){t&&t.target!==n||(r?.(),n.removeEventListener(`transitionend`,s),n.removeEventListener(`animationend`,s),n.classList.remove(...e.exitActive),n.classList.remove(...e.exitTo),o?.(n))}}var mt=e=>{let t=ut(e);return at(lt(()=>e.children).toArray,{appear:e.appear,exitMethod:`keep-index`,onChange({added:n,removed:r,finishRemoved:i,list:a}){let o=t();for(let t of n)ft(o,e,t);let s=[];for(let e of a)e.isConnected&&(e instanceof HTMLElement||e instanceof SVGElement)&&s.push({el:e,rect:e.getBoundingClientRect()});queueMicrotask(()=>{let e=[];for(let{el:t,rect:n}of s)if(t.isConnected){let r=t.getBoundingClientRect(),i=n.left-r.left,a=n.top-r.top;(i||a)&&(t.style.transform=`translate(${i}px, ${a}px)`,t.style.transitionDuration=`0s`,e.push(t))}document.body.offsetHeight;for(let t of e){let e=function(n){(n.target===t||/transform$/.test(n.propertyName))&&(t.removeEventListener(`transitionend`,e),t.classList.remove(...o.move))};t.classList.add(...o.move),t.style.transform=t.style.transitionDuration=``,t.addEventListener(`transitionend`,e)}});for(let t of r)pt(o,e,t,()=>i([t]))}})},ht=Symbol(`fallback`);function gt(e){for(let t of e)t.dispose()}function _t(e,r,i,a={}){let s=new Map;return n(()=>gt(s.values())),()=>{let n=e()||[];return n[t],u(()=>{if(!n.length)return gt(s.values()),s.clear(),a.fallback?[m(e=>(s.set(ht,{dispose:e}),a.fallback()))]:[];let e=Array(n.length),t=s.get(ht);if(!s.size||t){t?.dispose(),s.delete(ht);for(let t=0;t<n.length;t++){let i=n[t],a=r(i,t);c(e,i,t,a)}return e}let i=new Set(s.keys());for(let t=0;t<n.length;t++){let a=n[t],o=r(a,t);i.delete(o);let l=s.get(o);l?(e[t]=l.mapped,l.setIndex?.(t),l.setItem(()=>a)):c(e,a,t,o)}for(let e of i)s.get(e)?.dispose(),s.delete(e);return e})};function c(e,t,n,r){m(a=>{let[c,l]=o(t),u={setItem:l,dispose:a};if(i.length>1){let[e,t]=o(n);u.setIndex=t,u.mapped=i(c,e)}else u.mapped=i(c);s.set(r,u),e[n]=u.mapped})}}function vt(e){let{by:t}=e;return B(_t(()=>e.each,typeof t==`function`?t:e=>e[t],e.children,`fallback`in e?{fallback:()=>e.fallback}:void 0))}function yt(e,t,n,r){return e.addEventListener(t,n,r),he(e.removeEventListener.bind(e,t,n,r))}function bt(t,n,r,i){let a=()=>{pe(V(t)).forEach(e=>{e&&pe(V(n)).forEach(t=>yt(e,t,r,i))})};typeof t==`function`?l(a):e(a)}function xt(e,t){let r=new ResizeObserver(e);return n(r.disconnect.bind(r)),{observe:e=>r.observe(e,t),unobserve:r.unobserve.bind(r)}}function St(e,t,n){let r=new WeakMap,{observe:i,unobserve:a}=xt(e=>{for(let n of e){let{contentRect:e,target:i}=n,a=Math.round(e.width),o=Math.round(e.height),s=r.get(i);s&&s.width===a&&s.height===o||(t(e,i,n),r.set(i,{width:a,height:o}))}},n);l(t=>{let n=de(pe(V(e)));return ge(n,t,i,a),n},[])}var Ct=/((?:--)?(?:\w+-?)+)\s*:\s*([^;]*)/g;function wt(e){let t={},n;for(;n=Ct.exec(e);)t[n[1]]=n[2];return t}function Tt(e,t){if(typeof e==`string`){if(typeof t==`string`)return`${e};${t}`;e=wt(e)}else typeof t==`string`&&(t=wt(t));return{...e,...t}}function Et(e,t,n=-1){return n in e?[...e.slice(0,n),t,...e.slice(n)]:[...e,t]}function Dt(e,t){let n=[...e],r=n.indexOf(t);return r!==-1&&n.splice(r,1),n}function Ot(e){return typeof e==`number`}function kt(e){return Object.prototype.toString.call(e)===`[object String]`}function At(e){return typeof e==`function`}function jt(e){return t=>`${e()}-${t}`}function Mt(e,t){return e?e===t||e.contains(t):!1}function Nt(e,t=!1){let{activeElement:n}=Ft(e);if(!n?.nodeName)return null;if(It(n)&&n.contentDocument)return Nt(n.contentDocument.body,t);if(t){let e=n.getAttribute(`aria-activedescendant`);if(e){let t=Ft(n).getElementById(e);if(t)return t}}return n}function Pt(e){return Ft(e).defaultView||window}function Ft(e){return e?e.ownerDocument||e:document}function It(e){return e.tagName===`IFRAME`}var Lt=(e=>(e.Escape=`Escape`,e.Enter=`Enter`,e.Tab=`Tab`,e.Space=` `,e.ArrowDown=`ArrowDown`,e.ArrowLeft=`ArrowLeft`,e.ArrowRight=`ArrowRight`,e.ArrowUp=`ArrowUp`,e.End=`End`,e.Home=`Home`,e.PageDown=`PageDown`,e.PageUp=`PageUp`,e))(Lt||{});function Rt(e){return typeof window<`u`&&window.navigator!=null&&e.test(window.navigator.userAgentData?.platform||window.navigator.platform)}function zt(){return Rt(/^Mac/i)}function Bt(){return Rt(/^iPhone/i)}function Vt(){return Rt(/^iPad/i)||zt()&&navigator.maxTouchPoints>1}function Ht(){return Bt()||Vt()}function Ut(){return zt()||Ht()}function G(e,t){return t&&(At(t)?t(e):t[0](t[1],e)),e?.defaultPrevented}function K(e){return t=>{for(let n of e)G(t,n)}}function Wt(e){return zt()?e.metaKey&&!e.ctrlKey:e.ctrlKey&&!e.metaKey}function Gt(e){if(e){if(qt())e.focus({preventScroll:!0});else{let t=Jt(e);e.focus(),Yt(t)}}}var Kt=null;function qt(){if(Kt==null){Kt=!1;try{document.createElement(`div`).focus({get preventScroll(){return Kt=!0,!0}})}catch{}}return Kt}function Jt(e){let t=e.parentNode,n=[],r=document.scrollingElement||document.documentElement;for(;t instanceof HTMLElement&&t!==r;)(t.offsetHeight<t.scrollHeight||t.offsetWidth<t.scrollWidth)&&n.push({element:t,scrollTop:t.scrollTop,scrollLeft:t.scrollLeft}),t=t.parentNode;return r instanceof HTMLElement&&n.push({element:r,scrollTop:r.scrollTop,scrollLeft:r.scrollLeft}),n}function Yt(e){for(let{element:t,scrollTop:n,scrollLeft:r}of e)t.scrollTop=n,t.scrollLeft=r}var Xt=[`input:not([type='hidden']):not([disabled])`,`select:not([disabled])`,`textarea:not([disabled])`,`button:not([disabled])`,`a[href]`,`area[href]`,`[tabindex]`,`iframe`,`object`,`embed`,`audio[controls]`,`video[controls]`,`[contenteditable]:not([contenteditable='false'])`],Zt=[...Xt,`[tabindex]:not([tabindex="-1"]):not([disabled])`],Qt=`${Xt.join(`:not([hidden]),`)},[tabindex]:not([disabled]):not([hidden])`,$t=Zt.join(`:not([hidden]):not([tabindex="-1"]),`);function en(e,t){let n=Array.from(e.querySelectorAll(Qt)).filter(tn);return t&&tn(e)&&n.unshift(e),n.forEach((e,t)=>{if(It(e)&&e.contentDocument){let r=e.contentDocument.body,i=en(r,!1);n.splice(t,1,...i)}}),n}function tn(e){return nn(e)&&!rn(e)}function nn(e){return e.matches(Qt)&&an(e)}function rn(e){return Number.parseInt(e.getAttribute(`tabindex`)||`0`,10)<0}function an(e,t){return e.nodeName!==`#comment`&&on(e)&&sn(e,t)&&(!e.parentElement||an(e.parentElement,e))}function on(e){if(!(e instanceof HTMLElement)&&!(e instanceof SVGElement))return!1;let{display:t,visibility:n}=e.style,r=t!==`none`&&n!==`hidden`&&n!==`collapse`;if(r){if(!e.ownerDocument.defaultView)return r;let{getComputedStyle:t}=e.ownerDocument.defaultView,{display:n,visibility:i}=t(e);r=n!==`none`&&i!==`hidden`&&i!==`collapse`}return r}function sn(e,t){return!e.hasAttribute(`hidden`)&&(e.nodeName===`DETAILS`&&t&&t.nodeName!==`SUMMARY`?e.hasAttribute(`open`):!0)}function cn(e,t){return t.some(t=>t.contains(e))}function ln(e,t,n){let r=t?.tabbable?$t:Qt,i=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode(e){return t?.from?.contains(e)?NodeFilter.FILTER_REJECT:e.matches(r)&&an(e)&&(!n||cn(e,n))&&(!t?.accept||t.accept(e))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}});return t?.from&&(i.currentNode=t.from),i}function un(e){let t=e;for(;t&&!dn(t);)t=t.parentElement;return t||document.scrollingElement||document.documentElement}function dn(e){let t=window.getComputedStyle(e);return/(auto|scroll)/.test(t.overflow+t.overflowX+t.overflowY)}function fn(){}function pn(e,t){let[n,r]=e,i=!1,a=t.length;for(let e=a,o=0,s=e-1;o<e;s=o++){let[a,c]=t[o],[l,u]=t[s],[,d]=t[s===0?e-1:s-1]||[0,0],f=(c-u)*(n-a)-(a-l)*(r-c);if(u<c){if(r>=u&&r<c){if(f===0)return!0;f>0&&(r===u?r>d&&(i=!i):i=!i)}}else if(c<u){if(r>c&&r<=u){if(f===0)return!0;f<0&&(r===u?r<d&&(i=!i):i=!i)}}else if(r===c&&(n>=l&&n<=a||n>=a&&n<=l))return!0}return i}function q(e,t){return P(e,t)}var mn=new Map,hn=new Set;function gn(){if(typeof window>`u`||document.body===null)return;let e=e=>{if(!e.target)return;let n=mn.get(e.target);n||(n=new Set,mn.set(e.target,n),e.target.addEventListener(`transitioncancel`,t)),n.add(e.propertyName)},t=e=>{if(!e.target)return;let n=mn.get(e.target);if(n&&(n.delete(e.propertyName),n.size===0&&(e.target.removeEventListener(`transitioncancel`,t),mn.delete(e.target)),mn.size===0)){for(let e of hn)e();hn.clear()}};document.body.addEventListener(`transitionrun`,e),document.body.addEventListener(`transitionend`,t)}typeof document<`u`&&(document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,gn):gn());function _n(e,t){let n=vn(e,t,`left`),r=vn(e,t,`top`),i=t.offsetWidth,a=t.offsetHeight,o=e.scrollLeft,s=e.scrollTop,c=o+e.offsetWidth,l=s+e.offsetHeight;n<=o?o=n:n+i>c&&(o+=n+i-c),r<=s?s=r:r+a>l&&(s+=r+a-l),e.scrollLeft=o,e.scrollTop=s}function vn(e,t,n){let r=n===`left`?`offsetLeft`:`offsetTop`,i=0;for(;t.offsetParent&&(i+=t[r],t.offsetParent!==e);){if(t.offsetParent.contains(e)){i-=e[r];break}t=t.offsetParent}return i}function yn(e,t){if(document.contains(e)){let n=document.scrollingElement||document.documentElement;if(window.getComputedStyle(n).overflow!==`hidden`){let{left:n,top:r}=e.getBoundingClientRect();e?.scrollIntoView?.({block:`nearest`});let{left:i,top:a}=e.getBoundingClientRect();(Math.abs(n-i)>1||Math.abs(r-a)>1)&&(t?.containingElement?.scrollIntoView?.({block:`center`,inline:`center`}),e.scrollIntoView?.({block:`nearest`}))}else{let t=un(e);for(;e&&t&&e!==n&&t!==n;)_n(t,e),e=t,t=un(e)}}}var bn={border:`0`,clip:`rect(0 0 0 0)`,"clip-path":`inset(50%)`,height:`1px`,margin:`0 -1px -1px 0`,overflow:`hidden`,padding:`0`,position:`absolute`,width:`1px`,"white-space":`nowrap`};function xn(e){let t=e.startIndex??0,n=e.startLevel??0,r=[],i=t=>{if(t==null)return``;let n=e.getKey??`key`,r=kt(n)?t[n]:n(t);return r==null?``:String(r)},a=t=>{if(t==null)return``;let n=e.getTextValue??`textValue`,r=kt(n)?t[n]:n(t);return r==null?``:String(r)},o=t=>{if(t==null)return!1;let n=e.getDisabled??`disabled`;return(kt(n)?t[n]:n(t))??!1},s=t=>{if(t!=null)return kt(e.getSectionChildren)?t[e.getSectionChildren]:e.getSectionChildren?.(t)};for(let c of e.dataSource)if(kt(c)||Ot(c))r.push({type:`item`,rawValue:c,key:String(c),textValue:String(c),disabled:o(c),level:n,index:t}),t++;else if(s(c)!=null){r.push({type:`section`,rawValue:c,key:``,textValue:``,disabled:!1,level:n,index:t}),t++;let i=s(c)??[];if(i.length>0){let a=xn({dataSource:i,getKey:e.getKey,getTextValue:e.getTextValue,getDisabled:e.getDisabled,getSectionChildren:e.getSectionChildren,startIndex:t,startLevel:n+1});r.push(...a),t+=a.length}}else r.push({type:`item`,rawValue:c,key:i(c),textValue:a(c),disabled:o(c),level:n,index:t}),t++;return r}function Sn(e,t=[]){return B(()=>{let n=xn({dataSource:V(e.dataSource),getKey:V(e.getKey),getTextValue:V(e.getTextValue),getDisabled:V(e.getDisabled),getSectionChildren:V(e.getSectionChildren)});for(let e=0;e<t.length;e++)t[e]();return e.factory(n)})}var Cn=new Set([`Avst`,`Arab`,`Armi`,`Syrc`,`Samr`,`Mand`,`Thaa`,`Mend`,`Nkoo`,`Adlm`,`Rohg`,`Hebr`]),wn=new Set([`ae`,`ar`,`arc`,`bcc`,`bqi`,`ckb`,`dv`,`fa`,`glk`,`he`,`ku`,`mzn`,`nqo`,`pnb`,`ps`,`sd`,`ug`,`ur`,`yi`]);function Tn(e){if(Intl.Locale){let t=new Intl.Locale(e).maximize().script??``;return Cn.has(t)}let t=e.split(`-`)[0];return wn.has(t)}function En(e){return Tn(e)?`rtl`:`ltr`}function Dn(){let e=typeof navigator<`u`&&(navigator.language||navigator.userLanguage)||`en-US`;return{locale:e,direction:En(e)}}var On=Dn(),kn=new Set;function An(){On=Dn();for(let e of kn)e(On)}function jn(){let[e,t]=o(On),r=B(()=>e());return s(()=>{kn.size===0&&window.addEventListener(`languagechange`,An),kn.add(t),n(()=>{kn.delete(t),kn.size===0&&window.removeEventListener(`languagechange`,An)})}),{locale:()=>r().locale,direction:()=>r().direction}}var Mn=F();function Nn(){let e=jn();return c(Mn)||e}var Pn=new Map;function Fn(e){let{locale:t}=Nn(),n=B(()=>t()+(e?Object.entries(e).sort((e,t)=>e[0]<t[0]?-1:1).join():``));return B(()=>{let r=n(),i;return Pn.has(r)&&(i=Pn.get(r)),i||(i=new Intl.Collator(t(),e),Pn.set(r,i)),i})}function In(e){let[t,n]=o(e.defaultValue?.()),r=B(()=>e.value?.()!==void 0),i=B(()=>r()?e.value?.():t());return[i,t=>{u(()=>{let a=me(t,i());return Object.is(a,i())||(r()||n(a),e.onChange?.(a)),a})}]}function Ln(e){let[t,n]=In(e);return[()=>t()??!1,n]}function Rn(e){let[t,n]=In(e);return[()=>t()??[],n]}var zn=class e extends Set{anchorKey;currentKey;constructor(t,n,r){super(t),t instanceof e?(this.anchorKey=n||t.anchorKey,this.currentKey=r||t.currentKey):(this.anchorKey=n,this.currentKey=r)}};function Bn(e){let[t,n]=In(e);return[()=>t()??new zn,n]}function Vn(e){return Ut()?e.altKey:e.ctrlKey}function Hn(e){return zt()?e.metaKey:e.ctrlKey}function Un(e){return new zn(e)}function Wn(e,t){if(e.size!==t.size)return!1;for(let n of e)if(!t.has(n))return!1;return!0}function Gn(e){let t=q({selectionMode:`none`,selectionBehavior:`toggle`},e),[n,r]=o(!1),[i,a]=o(),[s,c]=Bn({value:B(()=>{let e=V(t.selectedKeys);return e==null?e:Un(e)}),defaultValue:B(()=>{let e=V(t.defaultSelectedKeys);return e==null?new zn:Un(e)}),onChange:e=>t.onSelectionChange?.(e)}),[u,d]=o(V(t.selectionBehavior));return l(()=>{let e=s();V(t.selectionBehavior)===`replace`&&u()===`toggle`&&typeof e==`object`&&e.size===0&&d(`replace`)}),l(()=>{d(V(t.selectionBehavior)??`toggle`)}),{selectionMode:()=>V(t.selectionMode),disallowEmptySelection:()=>V(t.disallowEmptySelection)??!1,selectionBehavior:u,setSelectionBehavior:d,isFocused:n,setFocused:r,focusedKey:i,setFocusedKey:a,selectedKeys:s,setSelectedKeys:e=>{(V(t.allowDuplicateSelectionEvents)||!Wn(e,s()))&&c(e)}}}function Kn(e){let[t,n]=o(``),[r,i]=o(-1);return{typeSelectHandlers:{onKeyDown:a=>{if(V(e.isDisabled))return;let o=V(e.keyboardDelegate),s=V(e.selectionManager);if(!o.getKeyForSearch)return;let c=qn(a.key);if(!c||a.ctrlKey||a.metaKey)return;c===` `&&t().trim().length>0&&(a.preventDefault(),a.stopPropagation());let l=n(e=>e+c),u=o.getKeyForSearch(l,s.focusedKey())??o.getKeyForSearch(l);u==null&&Jn(l)&&(l=l[0],u=o.getKeyForSearch(l,s.focusedKey())??o.getKeyForSearch(l)),u!=null&&(s.setFocusedKey(u),e.onTypeSelect?.(u)),clearTimeout(r()),i(window.setTimeout(()=>n(``),500))}}}}function qn(e){return e.length===1||!/^[A-Z]/i.test(e)?e:``}function Jn(e){return e.split(``).every(t=>t===e[0])}function Yn(e,t,n){let r=P({selectOnFocus:()=>V(e.selectionManager).selectionBehavior()===`replace`},e),i=()=>n?.()??t(),{direction:a}=Nn(),o={top:0,left:0};bt(()=>V(r.isVirtualized)?void 0:i(),`scroll`,()=>{let e=i();e&&(o={top:e.scrollTop,left:e.scrollLeft})});let{typeSelectHandlers:c}=Kn({isDisabled:()=>V(r.disallowTypeAhead),keyboardDelegate:()=>V(r.keyboardDelegate),selectionManager:()=>V(r.selectionManager)}),u=()=>V(r.orientation)??`vertical`,d=e=>{G(e,c.onKeyDown),e.altKey&&e.key===`Tab`&&e.preventDefault();let n=t();if(!n?.contains(e.target))return;let i=V(r.selectionManager),o=V(r.selectOnFocus),s=t=>{t!=null&&(i.setFocusedKey(t),e.shiftKey&&i.selectionMode()===`multiple`?i.extendSelection(t):o&&!Vn(e)&&i.replaceSelection(t))},l=V(r.keyboardDelegate),d=V(r.shouldFocusWrap),f=i.focusedKey();switch(e.key){case u()===`vertical`?`ArrowDown`:`ArrowRight`:if(l.getKeyBelow){e.preventDefault();let t;t=f==null?l.getFirstKey?.():l.getKeyBelow(f),t==null&&d&&(t=l.getFirstKey?.(f)),s(t)}break;case u()===`vertical`?`ArrowUp`:`ArrowLeft`:if(l.getKeyAbove){e.preventDefault();let t;t=f==null?l.getLastKey?.():l.getKeyAbove(f),t==null&&d&&(t=l.getLastKey?.(f)),s(t)}break;case u()===`vertical`?`ArrowLeft`:`ArrowUp`:if(l.getKeyLeftOf){e.preventDefault();let t=a()===`rtl`,n;n=f==null?t?l.getFirstKey?.():l.getLastKey?.():l.getKeyLeftOf(f),s(n)}break;case u()===`vertical`?`ArrowRight`:`ArrowDown`:if(l.getKeyRightOf){e.preventDefault();let t=a()===`rtl`,n;n=f==null?t?l.getLastKey?.():l.getFirstKey?.():l.getKeyRightOf(f),s(n)}break;case`Home`:if(l.getFirstKey){e.preventDefault();let t=l.getFirstKey(f,Hn(e));t!=null&&(i.setFocusedKey(t),Hn(e)&&e.shiftKey&&i.selectionMode()===`multiple`?i.extendSelection(t):o&&i.replaceSelection(t))}break;case`End`:if(l.getLastKey){e.preventDefault();let t=l.getLastKey(f,Hn(e));t!=null&&(i.setFocusedKey(t),Hn(e)&&e.shiftKey&&i.selectionMode()===`multiple`?i.extendSelection(t):o&&i.replaceSelection(t))}break;case`PageDown`:l.getKeyPageBelow&&f!=null&&(e.preventDefault(),s(l.getKeyPageBelow(f)));break;case`PageUp`:l.getKeyPageAbove&&f!=null&&(e.preventDefault(),s(l.getKeyPageAbove(f)));break;case`a`:Hn(e)&&i.selectionMode()===`multiple`&&V(r.disallowSelectAll)!==!0&&(e.preventDefault(),i.selectAll());break;case`Escape`:!e.defaultPrevented&&!V(r.disallowEmptySelection)&&(e.preventDefault(),i.clearSelection());break;case`Tab`:if(!V(r.allowsTabNavigation)){if(e.shiftKey)n.focus();else{let e=ln(n,{tabbable:!0}),t,r;do r=e.lastChild(),r&&(t=r);while(r);t&&!t.contains(document.activeElement)&&Gt(t)}break}}},f=e=>{let t=V(r.selectionManager),n=V(r.keyboardDelegate),a=V(r.selectOnFocus);if(t.isFocused())e.currentTarget.contains(e.target)||t.setFocused(!1);else if(e.currentTarget.contains(e.target)){if(t.setFocused(!0),t.focusedKey()==null){let r=e=>{e!=null&&(t.setFocusedKey(e),a&&t.replaceSelection(e))},i=e.relatedTarget;i&&e.currentTarget.compareDocumentPosition(i)&Node.DOCUMENT_POSITION_FOLLOWING?r(t.lastSelectedKey()??n.getLastKey?.()):r(t.firstSelectedKey()??n.getFirstKey?.())}else if(!V(r.isVirtualized)){let e=i();if(e){e.scrollTop=o.top,e.scrollLeft=o.left;let n=e.querySelector(`[data-key="${t.focusedKey()}"]`);n&&(Gt(n),_n(e,n))}}}},p=e=>{let t=V(r.selectionManager);e.currentTarget.contains(e.relatedTarget)||t.setFocused(!1)},m=e=>{i()===e.target&&e.preventDefault()},h=()=>{let e=V(r.autoFocus);if(!e)return;let n=V(r.selectionManager),i=V(r.keyboardDelegate),a;e===`first`&&(a=i.getFirstKey?.()),e===`last`&&(a=i.getLastKey?.());let o=n.selectedKeys();o.size&&(a=o.values().next().value),n.setFocused(!0),n.setFocusedKey(a);let s=t();s&&a==null&&!V(r.shouldUseVirtualFocus)&&Gt(s)};return s(()=>{r.deferAutoFocus?setTimeout(h,0):h()}),l(g([i,()=>V(r.isVirtualized),()=>V(r.selectionManager).focusedKey()],e=>{let[t,n,i]=e;if(n)i&&r.scrollToKey?.(i);else if(i&&t){let e=t.querySelector(`[data-key="${i}"]`);e&&_n(t,e)}})),{tabIndex:B(()=>{if(!V(r.shouldUseVirtualFocus))return V(r.selectionManager).focusedKey()==null?0:-1}),onKeyDown:d,onMouseDown:m,onFocusIn:f,onFocusOut:p}}function Xn(e,t){let n=()=>V(e.selectionManager),r=()=>V(e.key),i=()=>V(e.shouldUseVirtualFocus),a=e=>{n().selectionMode()!==`none`&&(n().selectionMode()===`single`?n().isSelected(r())&&!n().disallowEmptySelection()?n().toggleSelection(r()):n().replaceSelection(r()):e?.shiftKey?n().extendSelection(r()):n().selectionBehavior()===`toggle`||Hn(e)||`pointerType`in e&&e.pointerType===`touch`?n().toggleSelection(r()):n().replaceSelection(r()))},o=()=>n().isSelected(r()),s=()=>V(e.disabled)||n().isDisabled(r()),c=()=>!s()&&n().canSelectItem(r()),u=null,d=t=>{c()&&(u=t.pointerType,t.pointerType===`mouse`&&t.button===0&&!V(e.shouldSelectOnPressUp)&&a(t))},f=t=>{c()&&t.pointerType===`mouse`&&t.button===0&&V(e.shouldSelectOnPressUp)&&V(e.allowsDifferentPressOrigin)&&a(t)},p=t=>{c()&&(V(e.shouldSelectOnPressUp)&&!V(e.allowsDifferentPressOrigin)||u!==`mouse`)&&a(t)},m=e=>{c()&&[`Enter`,` `].includes(e.key)&&(Vn(e)?n().toggleSelection(r()):a(e))},h=e=>{s()&&e.preventDefault()},_=e=>{let a=t();i()||s()||!a||e.target===a&&n().setFocusedKey(r())},v=B(()=>{if(!(i()||s()))return r()===n().focusedKey()?0:-1}),y=B(()=>V(e.virtualized)?void 0:r());return l(g([t,r,i,()=>n().focusedKey(),()=>n().isFocused()],([t,n,r,i,a])=>{t&&n===i&&a&&!r&&document.activeElement!==t&&(e.focus?e.focus():Gt(t))})),{isSelected:o,isDisabled:s,allowsSelection:c,tabIndex:v,dataKey:y,onPointerDown:d,onPointerUp:f,onClick:p,onKeyDown:m,onMouseDown:h,onFocus:_}}var Zn=class{collection;state;constructor(e,t){this.collection=e,this.state=t}selectionMode(){return this.state.selectionMode()}disallowEmptySelection(){return this.state.disallowEmptySelection()}selectionBehavior(){return this.state.selectionBehavior()}setSelectionBehavior(e){this.state.setSelectionBehavior(e)}isFocused(){return this.state.isFocused()}setFocused(e){this.state.setFocused(e)}focusedKey(){return this.state.focusedKey()}setFocusedKey(e){(e==null||this.collection().getItem(e))&&this.state.setFocusedKey(e)}selectedKeys(){return this.state.selectedKeys()}isSelected(e){if(this.state.selectionMode()===`none`)return!1;let t=this.getKey(e);return t!=null&&this.state.selectedKeys().has(t)}isEmpty(){return this.state.selectedKeys().size===0}isSelectAll(){if(this.isEmpty())return!1;let e=this.state.selectedKeys();return this.getAllSelectableKeys().every(t=>e.has(t))}firstSelectedKey(){let e;for(let t of this.state.selectedKeys()){let n=this.collection().getItem(t),r=n?.index!=null&&e?.index!=null&&n.index<e.index;(!e||r)&&(e=n)}return e?.key}lastSelectedKey(){let e;for(let t of this.state.selectedKeys()){let n=this.collection().getItem(t),r=n?.index!=null&&e?.index!=null&&n.index>e.index;(!e||r)&&(e=n)}return e?.key}extendSelection(e){if(this.selectionMode()===`none`)return;if(this.selectionMode()===`single`){this.replaceSelection(e);return}let t=this.getKey(e);if(t==null)return;let n=this.state.selectedKeys(),r=n.anchorKey||t,i=new zn(n,r,t);for(let e of this.getKeyRange(r,n.currentKey||t))i.delete(e);for(let e of this.getKeyRange(t,r))this.canSelectItem(e)&&i.add(e);this.state.setSelectedKeys(i)}getKeyRange(e,t){let n=this.collection().getItem(e),r=this.collection().getItem(t);return n&&r?n.index!=null&&r.index!=null&&n.index<=r.index?this.getKeyRangeInternal(e,t):this.getKeyRangeInternal(t,e):[]}getKeyRangeInternal(e,t){let n=[],r=e;for(;r!=null;){let e=this.collection().getItem(r);if(e&&e.type===`item`&&n.push(r),r===t)return n;r=this.collection().getKeyAfter(r)}return[]}getKey(e){let t=this.collection().getItem(e);return t?!t||t.type!==`item`?null:t.key:e}toggleSelection(e){if(this.selectionMode()===`none`)return;if(this.selectionMode()===`single`&&!this.isSelected(e)){this.replaceSelection(e);return}let t=this.getKey(e);if(t==null)return;let n=new zn(this.state.selectedKeys());n.has(t)?n.delete(t):this.canSelectItem(t)&&(n.add(t),n.anchorKey=t,n.currentKey=t),!(this.disallowEmptySelection()&&n.size===0)&&this.state.setSelectedKeys(n)}replaceSelection(e){if(this.selectionMode()===`none`)return;let t=this.getKey(e);if(t==null)return;let n=this.canSelectItem(t)?new zn([t],t,t):new zn;this.state.setSelectedKeys(n)}setSelectedKeys(e){if(this.selectionMode()===`none`)return;let t=new zn;for(let n of e){let e=this.getKey(n);if(e!=null&&(t.add(e),this.selectionMode()===`single`))break}this.state.setSelectedKeys(t)}selectAll(){this.selectionMode()===`multiple`&&this.state.setSelectedKeys(new Set(this.getAllSelectableKeys()))}clearSelection(){let e=this.state.selectedKeys();!this.disallowEmptySelection()&&e.size>0&&this.state.setSelectedKeys(new zn)}toggleSelectAll(){this.isSelectAll()?this.clearSelection():this.selectAll()}select(e,t){this.selectionMode()!==`none`&&(this.selectionMode()===`single`?this.isSelected(e)&&!this.disallowEmptySelection()?this.toggleSelection(e):this.replaceSelection(e):this.selectionBehavior()===`toggle`||t&&t.pointerType===`touch`?this.toggleSelection(e):this.replaceSelection(e))}isSelectionEqual(e){if(e===this.state.selectedKeys())return!0;let t=this.selectedKeys();if(e.size!==t.size)return!1;for(let n of e)if(!t.has(n))return!1;for(let n of t)if(!e.has(n))return!1;return!0}canSelectItem(e){if(this.state.selectionMode()===`none`)return!1;let t=this.collection().getItem(e);return t!=null&&!t.disabled}isDisabled(e){let t=this.collection().getItem(e);return!t||t.disabled}getAllSelectableKeys(){let e=[];return(t=>{for(;t!=null;){if(this.canSelectItem(t)){let n=this.collection().getItem(t);if(!n)continue;n.type===`item`&&e.push(t)}t=this.collection().getKeyAfter(t)}})(this.collection().getFirstKey()),e}},Qn=class{keyMap=new Map;iterable;firstKey;lastKey;constructor(e){this.iterable=e;for(let t of e)this.keyMap.set(t.key,t);if(this.keyMap.size===0)return;let t,n=0;for(let[e,r]of this.keyMap)t?(t.nextKey=e,r.prevKey=t.key):(this.firstKey=e,r.prevKey=void 0),r.type===`item`&&(r.index=n++),t=r,t.nextKey=void 0;this.lastKey=t.key}*[Symbol.iterator](){yield*this.iterable}getSize(){return this.keyMap.size}getKeys(){return this.keyMap.keys()}getKeyBefore(e){return this.keyMap.get(e)?.prevKey}getKeyAfter(e){return this.keyMap.get(e)?.nextKey}getFirstKey(){return this.firstKey}getLastKey(){return this.lastKey}getItem(e){return this.keyMap.get(e)}at(e){let t=[...this.getKeys()];return this.getItem(t[e])}};function $n(e){let t=Gn(e),n=Sn({dataSource:()=>V(e.dataSource),getKey:()=>V(e.getKey),getTextValue:()=>V(e.getTextValue),getDisabled:()=>V(e.getDisabled),getSectionChildren:()=>V(e.getSectionChildren),factory:t=>e.filter?new Qn(e.filter(t)):new Qn(t)},[()=>e.filter]),r=new Zn(n,t);return C(()=>{let e=t.focusedKey();e!=null&&!n().getItem(e)&&t.setFocusedKey(void 0)}),{collection:n,selectionManager:()=>r}}var er=F();function tr(){return c(er)}function nr(){let e=tr();if(e===void 0)throw Error("[kobalte]: `useDomCollectionContext` must be used within a `DomCollectionProvider` component");return e}function rr(e,t){return!!(t.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING)}function ir(e,t){let n=t.ref();if(!n)return-1;let r=e.length;if(!r)return-1;for(;r--;){let t=e[r]?.ref();if(t&&rr(t,n))return r+1}return 0}function ar(e){let t=e.map((e,t)=>[t,e]),n=!1;return t.sort(([e,t],[r,i])=>{let a=t.ref(),o=i.ref();return a===o||!a||!o?0:rr(a,o)?(e>r&&(n=!0),-1):(e<r&&(n=!0),1)}),n?t.map(([e,t])=>t):e}function or(e,t){let n=ar(e);e!==n&&t(n)}function sr(e){let t=e[0],n=e[e.length-1]?.ref(),r=t?.ref()?.parentElement;for(;r;){if(n&&r.contains(n))return r;r=r.parentElement}return Ft(r).body}function cr(e,t){l(()=>{let r=setTimeout(()=>{or(e(),t)});n(()=>clearTimeout(r))})}function lr(e,t){if(typeof IntersectionObserver!=`function`){cr(e,t);return}let r=[];l(()=>{let i=()=>{let n=!!r.length;r=e(),n&&or(e(),t)},a=sr(e()),o=new IntersectionObserver(i,{root:a});for(let t of e()){let e=t.ref();e&&o.observe(e)}n(()=>o.disconnect())})}function ur(e={}){let[t,n]=Rn({value:()=>V(e.items),onChange:t=>e.onItemsChange?.(t)});lr(t,n);let r=e=>(n(t=>Et(t,e,ir(t,e))),()=>{n(t=>{let n=t.filter(t=>t.ref()!==e.ref());return t.length===n.length?t:n})});return{DomCollectionProvider:e=>T(er.Provider,{value:{registerItem:r},get children(){return e.children}})}}function dr(e){let t=nr(),r=q({shouldRegisterItem:!0},e);l(()=>{if(!r.shouldRegisterItem)return;let e=t.registerItem(r.getItem());n(e)})}function J(e){let[t,n]=A(e,[`as`]);if(!t.as)throw Error("[kobalte]: Polymorphic is missing the required `as` prop.");return T(ie,P(n,{get component(){return t.as}}))}var fr=Object.defineProperty,pr=(e,t)=>{for(var n in t)fr(e,n,{get:t[n],enumerable:!0})},Y=e=>typeof e==`function`?e():e,mr=e=>{let t=B(()=>{let t=Y(e.element);if(t)return getComputedStyle(t)}),r=()=>t()?.animationName??`none`,[i,a]=o(Y(e.show)?`present`:`hidden`),s=t=>{a(t),e.onStateChange?.(t)},c=`none`;return l(n=>{let i=Y(e.show);return u(()=>{if(n===i)return i;let e=c,a=r();i?s(`present`):a===`none`||t()?.display===`none`?s(`hidden`):s(n===!0&&e!==a?`hiding`:`hidden`)}),i},Y(e.show)),l(()=>{let t=Y(e.element);if(!t)return;let a=e=>{e.target===t&&(c=r())},o=e=>{let n=r().includes(e.animationName);e.target===t&&n&&i()===`hiding`&&s(`hidden`)};t.addEventListener(`animationstart`,a),t.addEventListener(`animationcancel`,o),t.addEventListener(`animationend`,o),n(()=>{t.removeEventListener(`animationstart`,a),t.removeEventListener(`animationcancel`,o),t.removeEventListener(`animationend`,o)})}),{present:()=>i()===`present`||i()===`hiding`,state:i}},hr=`data-kb-top-layer`,gr,_r=!1,vr=[];function yr(e){return vr.findIndex(t=>t.node===e)}function br(e){return vr[yr(e)]}function xr(e){return vr.length>0&&vr[vr.length-1].node===e}function Sr(){return vr.filter(e=>e.isPointerBlocking)}function Cr(){return[...Sr()].slice(-1)[0]}function wr(){return Sr().length>0}function Tr(e){let t=yr(Cr()?.node);return yr(e)<t}function Er(e){vr.push(e)}function Dr(e){let t=yr(e);t<0||vr.splice(t,1)}function Or(){for(let{node:e}of vr)e.style.pointerEvents=Tr(e)?`none`:`auto`}function kr(e){if(wr()&&!_r){let t=Ft(e);gr=document.body.style.pointerEvents,t.body.style.pointerEvents=`none`,_r=!0}}function Ar(e){if(wr())return;let t=Ft(e);t.body.style.pointerEvents=gr,t.body.style.length===0&&t.body.removeAttribute(`style`),_r=!1}var jr={layers:vr,isTopMostLayer:xr,hasPointerBlockingLayer:wr,isBelowPointerBlockingLayer:Tr,addLayer:Er,removeLayer:Dr,indexOf:yr,find:br,assignPointerEventToLayers:Or,disableBodyPointerEvents:kr,restoreBodyPointerEvents:Ar};function Mr(e,t){let[n,r]=o(Nr(t?.()));return l(()=>{r(e()?.tagName.toLowerCase()||Nr(t?.()))}),n}function Nr(e){return kt(e)?e:void 0}pr({},{Button:()=>Lr,Root:()=>Ir});var Pr=[`button`,`color`,`file`,`image`,`reset`,`submit`];function Fr(e){let t=e.tagName.toLowerCase();return t===`button`?!0:t===`input`&&e.type?Pr.indexOf(e.type)!==-1:!1}function Ir(e){let t,n=q({type:`button`},e),[r,i]=A(n,[`ref`,`type`,`disabled`]),a=Mr(()=>t,()=>`button`),o=B(()=>{let e=a();return e!=null&&Fr({tagName:e,type:r.type})}),s=B(()=>a()===`input`),c=B(()=>a()===`a`&&t?.getAttribute(`href`)!=null);return T(J,P({as:`button`,ref(e){let n=ot(e=>t=e,r.ref);typeof n==`function`&&n(e)},get type(){return o()||s()?r.type:void 0},get role(){return!o()&&!c()?`button`:void 0},get tabIndex(){return!o()&&!c()&&!r.disabled?0:void 0},get disabled(){return o()||s()?r.disabled:void 0},get"aria-disabled"(){return!o()&&!s()&&r.disabled?!0:void 0},get"data-disabled"(){return r.disabled?``:void 0}},i))}var Lr=Ir;function Rr(e){return t=>(e(t),()=>e(void 0))}function zr(e={}){let[t,n]=Ln({value:()=>V(e.isSelected),defaultValue:()=>!!V(e.defaultIsSelected),onChange:t=>e.onSelectedChange?.(t)});return{isSelected:t,setIsSelected:t=>{!V(e.isReadOnly)&&!V(e.isDisabled)&&n(t)},toggle:()=>{!V(e.isReadOnly)&&!V(e.isDisabled)&&n(!t())}}}var Br=[`top`,`right`,`bottom`,`left`],Vr=Math.min,Hr=Math.max,Ur=Math.round,Wr=Math.floor,Gr=e=>({x:e,y:e}),Kr={left:`right`,right:`left`,bottom:`top`,top:`bottom`};function qr(e,t,n){return Hr(e,Vr(t,n))}function Jr(e,t){return typeof e==`function`?e(t):e}function Yr(e){return e.split(`-`)[0]}function Xr(e){return e.split(`-`)[1]}function Zr(e){return e===`x`?`y`:`x`}function Qr(e){return e===`y`?`height`:`width`}function $r(e){let t=e[0];return t===`t`||t===`b`?`y`:`x`}function ei(e){return Zr($r(e))}function ti(e,t,n){n===void 0&&(n=!1);let r=Xr(e),i=ei(e),a=Qr(i),o=i===`x`?r===(n?`end`:`start`)?`right`:`left`:r===`start`?`bottom`:`top`;return t.reference[a]>t.floating[a]&&(o=ui(o)),[o,ui(o)]}function ni(e){let t=ui(e);return[ri(e),t,ri(t)]}function ri(e){return e.includes(`start`)?e.replace(`start`,`end`):e.replace(`end`,`start`)}var ii=[`left`,`right`],ai=[`right`,`left`],oi=[`top`,`bottom`],si=[`bottom`,`top`];function ci(e,t,n){switch(e){case`top`:case`bottom`:return n?t?ai:ii:t?ii:ai;case`left`:case`right`:return t?oi:si;default:return[]}}function li(e,t,n,r){let i=Xr(e),a=ci(Yr(e),n===`start`,r);return i&&(a=a.map(e=>e+`-`+i),t&&(a=a.concat(a.map(ri)))),a}function ui(e){let t=Yr(e);return Kr[t]+e.slice(t.length)}function di(e){return{top:0,right:0,bottom:0,left:0,...e}}function fi(e){return typeof e==`number`?{top:e,right:e,bottom:e,left:e}:di(e)}function pi(e){let{x:t,y:n,width:r,height:i}=e;return{width:r,height:i,top:n,left:t,right:t+r,bottom:n+i,x:t,y:n}}function mi(e,t,n){let{reference:r,floating:i}=e,a=$r(t),o=ei(t),s=Qr(o),c=Yr(t),l=a===`y`,u=r.x+r.width/2-i.width/2,d=r.y+r.height/2-i.height/2,f=r[s]/2-i[s]/2,p;switch(c){case`top`:p={x:u,y:r.y-i.height};break;case`bottom`:p={x:u,y:r.y+r.height};break;case`right`:p={x:r.x+r.width,y:d};break;case`left`:p={x:r.x-i.width,y:d};break;default:p={x:r.x,y:r.y}}switch(Xr(t)){case`start`:p[o]-=f*(n&&l?-1:1);break;case`end`:p[o]+=f*(n&&l?-1:1)}return p}async function hi(e,t){t===void 0&&(t={});let{x:n,y:r,platform:i,rects:a,elements:o,strategy:s}=e,{boundary:c=`clippingAncestors`,rootBoundary:l=`viewport`,elementContext:u=`floating`,altBoundary:d=!1,padding:f=0}=Jr(t,e),p=fi(f),m=o[d?u===`floating`?`reference`:`floating`:u],h=pi(await i.getClippingRect({element:await(i.isElement==null?void 0:i.isElement(m))??!0?m:m.contextElement||await(i.getDocumentElement==null?void 0:i.getDocumentElement(o.floating)),boundary:c,rootBoundary:l,strategy:s})),g=u===`floating`?{x:n,y:r,width:a.floating.width,height:a.floating.height}:a.reference,_=await(i.getOffsetParent==null?void 0:i.getOffsetParent(o.floating)),v=await(i.isElement==null?void 0:i.isElement(_))&&await(i.getScale==null?void 0:i.getScale(_))||{x:1,y:1},y=pi(i.convertOffsetParentRelativeRectToViewportRelativeRect?await i.convertOffsetParentRelativeRectToViewportRelativeRect({elements:o,rect:g,offsetParent:_,strategy:s}):g);return{top:(h.top-y.top+p.top)/v.y,bottom:(y.bottom-h.bottom+p.bottom)/v.y,left:(h.left-y.left+p.left)/v.x,right:(y.right-h.right+p.right)/v.x}}var gi=async(e,t,n)=>{let{placement:r=`bottom`,strategy:i=`absolute`,middleware:a=[],platform:o}=n,s=o.detectOverflow?o:{...o,detectOverflow:hi},c=await(o.isRTL==null?void 0:o.isRTL(t)),l=await o.getElementRects({reference:e,floating:t,strategy:i}),{x:u,y:d}=mi(l,r,c),f=r,p=0,m={};for(let n=0;n<a.length;n++){let h=a[n];if(!h)continue;let{name:g,fn:_}=h,{x:v,y,data:b,reset:x}=await _({x:u,y:d,initialPlacement:r,placement:f,strategy:i,middlewareData:m,rects:l,platform:s,elements:{reference:e,floating:t}});u=v??u,d=y??d,m[g]={...m[g],...b},x&&p<50&&(p++,typeof x==`object`&&(x.placement&&(f=x.placement),x.rects&&(l=x.rects===!0?await o.getElementRects({reference:e,floating:t,strategy:i}):x.rects),{x:u,y:d}=mi(l,f,c)),n=-1)}return{x:u,y:d,placement:f,strategy:i,middlewareData:m}},_i=e=>({name:`arrow`,options:e,async fn(t){let{x:n,y:r,placement:i,rects:a,platform:o,elements:s,middlewareData:c}=t,{element:l,padding:u=0}=Jr(e,t)||{};if(l==null)return{};let d=fi(u),f={x:n,y:r},p=ei(i),m=Qr(p),h=await o.getDimensions(l),g=p===`y`,_=g?`top`:`left`,v=g?`bottom`:`right`,y=g?`clientHeight`:`clientWidth`,b=a.reference[m]+a.reference[p]-f[p]-a.floating[m],x=f[p]-a.reference[p],S=await(o.getOffsetParent==null?void 0:o.getOffsetParent(l)),C=S?S[y]:0;C&&await(o.isElement==null?void 0:o.isElement(S))||(C=s.floating[y]||a.floating[m]);let w=b/2-x/2,T=C/2-h[m]/2-1,E=Vr(d[_],T),ee=Vr(d[v],T),D=E,O=C-h[m]-ee,k=C/2-h[m]/2+w,A=qr(D,k,O),te=!c.arrow&&Xr(i)!=null&&k!==A&&a.reference[m]/2-(k<D?E:ee)-h[m]/2<0,j=te?k<D?k-D:k-O:0;return{[p]:f[p]+j,data:{[p]:A,centerOffset:k-A-j,...te&&{alignmentOffset:j}},reset:te}}}),vi=function(e){return e===void 0&&(e={}),{name:`flip`,options:e,async fn(t){var n;let{placement:r,middlewareData:i,rects:a,initialPlacement:o,platform:s,elements:c}=t,{mainAxis:l=!0,crossAxis:u=!0,fallbackPlacements:d,fallbackStrategy:f=`bestFit`,fallbackAxisSideDirection:p=`none`,flipAlignment:m=!0,...h}=Jr(e,t);if((n=i.arrow)!=null&&n.alignmentOffset)return{};let g=Yr(r),_=$r(o),v=Yr(o)===o,y=await(s.isRTL==null?void 0:s.isRTL(c.floating)),b=d||(v||!m?[ui(o)]:ni(o)),x=p!==`none`;!d&&x&&b.push(...li(o,m,p,y));let S=[o,...b],C=await s.detectOverflow(t,h),w=[],T=i.flip?.overflows||[];if(l&&w.push(C[g]),u){let e=ti(r,a,y);w.push(C[e[0]],C[e[1]])}if(T=[...T,{placement:r,overflows:w}],!w.every(e=>e<=0)){let e=(i.flip?.index||0)+1,t=S[e];if(t&&(u!==`alignment`||_===$r(t)||T.every(e=>$r(e.placement)!==_||e.overflows[0]>0)))return{data:{index:e,overflows:T},reset:{placement:t}};let n=T.filter(e=>e.overflows[0]<=0).sort((e,t)=>e.overflows[1]-t.overflows[1])[0]?.placement;if(!n)switch(f){case`bestFit`:{let e=T.filter(e=>{if(x){let t=$r(e.placement);return t===_||t===`y`}return!0}).map(e=>[e.placement,e.overflows.filter(e=>e>0).reduce((e,t)=>e+t,0)]).sort((e,t)=>e[1]-t[1])[0]?.[0];e&&(n=e);break}case`initialPlacement`:n=o}if(r!==n)return{reset:{placement:n}}}return{}}}};function yi(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function bi(e){return Br.some(t=>e[t]>=0)}var xi=function(e){return e===void 0&&(e={}),{name:`hide`,options:e,async fn(t){let{rects:n,platform:r}=t,{strategy:i=`referenceHidden`,...a}=Jr(e,t);switch(i){case`referenceHidden`:{let e=yi(await r.detectOverflow(t,{...a,elementContext:`reference`}),n.reference);return{data:{referenceHiddenOffsets:e,referenceHidden:bi(e)}}}case`escaped`:{let e=yi(await r.detectOverflow(t,{...a,altBoundary:!0}),n.floating);return{data:{escapedOffsets:e,escaped:bi(e)}}}default:return{}}}}},Si=new Set([`left`,`top`]);async function Ci(e,t){let{placement:n,platform:r,elements:i}=e,a=await(r.isRTL==null?void 0:r.isRTL(i.floating)),o=Yr(n),s=Xr(n),c=$r(n)===`y`,l=Si.has(o)?-1:1,u=a&&c?-1:1,d=Jr(t,e),{mainAxis:f,crossAxis:p,alignmentAxis:m}=typeof d==`number`?{mainAxis:d,crossAxis:0,alignmentAxis:null}:{mainAxis:d.mainAxis||0,crossAxis:d.crossAxis||0,alignmentAxis:d.alignmentAxis};return s&&typeof m==`number`&&(p=s===`end`?m*-1:m),c?{x:p*u,y:f*l}:{x:f*l,y:p*u}}var wi=function(e){return e===void 0&&(e=0),{name:`offset`,options:e,async fn(t){var n;let{x:r,y:i,placement:a,middlewareData:o}=t,s=await Ci(t,e);return a===o.offset?.placement&&(n=o.arrow)!=null&&n.alignmentOffset?{}:{x:r+s.x,y:i+s.y,data:{...s,placement:a}}}}},Ti=function(e){return e===void 0&&(e={}),{name:`shift`,options:e,async fn(t){let{x:n,y:r,placement:i,platform:a}=t,{mainAxis:o=!0,crossAxis:s=!1,limiter:c={fn:e=>{let{x:t,y:n}=e;return{x:t,y:n}}},...l}=Jr(e,t),u={x:n,y:r},d=await a.detectOverflow(t,l),f=$r(Yr(i)),p=Zr(f),m=u[p],h=u[f];if(o){let e=p===`y`?`top`:`left`,t=p===`y`?`bottom`:`right`,n=m+d[e],r=m-d[t];m=qr(n,m,r)}if(s){let e=f===`y`?`top`:`left`,t=f===`y`?`bottom`:`right`,n=h+d[e],r=h-d[t];h=qr(n,h,r)}let g=c.fn({...t,[p]:m,[f]:h});return{...g,data:{x:g.x-n,y:g.y-r,enabled:{[p]:o,[f]:s}}}}}},Ei=function(e){return e===void 0&&(e={}),{name:`size`,options:e,async fn(t){var n,r;let{placement:i,rects:a,platform:o,elements:s}=t,{apply:c=()=>{},...l}=Jr(e,t),u=await o.detectOverflow(t,l),d=Yr(i),f=Xr(i),p=$r(i)===`y`,{width:m,height:h}=a.floating,g,_;d===`top`||d===`bottom`?(g=d,_=f===(await(o.isRTL==null?void 0:o.isRTL(s.floating))?`start`:`end`)?`left`:`right`):(_=d,g=f===`end`?`top`:`bottom`);let v=h-u.top-u.bottom,y=m-u.left-u.right,b=Vr(h-u[g],v),x=Vr(m-u[_],y),S=!t.middlewareData.shift,C=b,w=x;if((n=t.middlewareData.shift)!=null&&n.enabled.x&&(w=y),(r=t.middlewareData.shift)!=null&&r.enabled.y&&(C=v),S&&!f){let e=Hr(u.left,0),t=Hr(u.right,0),n=Hr(u.top,0),r=Hr(u.bottom,0);p?w=m-2*(e!==0||t!==0?e+t:Hr(u.left,u.right)):C=h-2*(n!==0||r!==0?n+r:Hr(u.top,u.bottom))}await c({...t,availableWidth:w,availableHeight:C});let T=await o.getDimensions(s.floating);return m!==T.width||h!==T.height?{reset:{rects:!0}}:{}}}};function Di(){return typeof window<`u`}function Oi(e){return ji(e)?(e.nodeName||``).toLowerCase():`#document`}function ki(e){var t;return(e==null||(t=e.ownerDocument)==null?void 0:t.defaultView)||window}function Ai(e){return((ji(e)?e.ownerDocument:e.document)||window.document)?.documentElement}function ji(e){return Di()?e instanceof Node||e instanceof ki(e).Node:!1}function Mi(e){return Di()?e instanceof Element||e instanceof ki(e).Element:!1}function Ni(e){return Di()?e instanceof HTMLElement||e instanceof ki(e).HTMLElement:!1}function Pi(e){return!Di()||typeof ShadowRoot>`u`?!1:e instanceof ShadowRoot||e instanceof ki(e).ShadowRoot}function Fi(e){let{overflow:t,overflowX:n,overflowY:r,display:i}=Ki(e);return/auto|scroll|overlay|hidden|clip/.test(t+r+n)&&i!==`inline`&&i!==`contents`}function Ii(e){return/^(table|td|th)$/.test(Oi(e))}function Li(e){try{if(e.matches(`:popover-open`))return!0}catch{}try{return e.matches(`:modal`)}catch{return!1}}var Ri=/transform|translate|scale|rotate|perspective|filter/,zi=/paint|layout|strict|content/,Bi=e=>!!e&&e!==`none`,Vi;function Hi(e){let t=Mi(e)?Ki(e):e;return Bi(t.transform)||Bi(t.translate)||Bi(t.scale)||Bi(t.rotate)||Bi(t.perspective)||!Wi()&&(Bi(t.backdropFilter)||Bi(t.filter))||Ri.test(t.willChange||``)||zi.test(t.contain||``)}function Ui(e){let t=Ji(e);for(;Ni(t)&&!Gi(t);){if(Hi(t))return t;if(Li(t))return null;t=Ji(t)}return null}function Wi(){return Vi??=typeof CSS<`u`&&CSS.supports&&CSS.supports(`-webkit-backdrop-filter`,`none`),Vi}function Gi(e){return/^(html|body|#document)$/.test(Oi(e))}function Ki(e){return ki(e).getComputedStyle(e)}function qi(e){return Mi(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function Ji(e){if(Oi(e)===`html`)return e;let t=e.assignedSlot||e.parentNode||Pi(e)&&e.host||Ai(e);return Pi(t)?t.host:t}function Yi(e){let t=Ji(e);return Gi(t)?e.ownerDocument?e.ownerDocument.body:e.body:Ni(t)&&Fi(t)?t:Yi(t)}function Xi(e,t,n){t===void 0&&(t=[]),n===void 0&&(n=!0);let r=Yi(e),i=r===e.ownerDocument?.body,a=ki(r);if(i){let e=Zi(a);return t.concat(a,a.visualViewport||[],Fi(r)?r:[],e&&n?Xi(e):[])}return t.concat(r,Xi(r,[],n))}function Zi(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function Qi(e){let t=Ki(e),n=parseFloat(t.width)||0,r=parseFloat(t.height)||0,i=Ni(e),a=i?e.offsetWidth:n,o=i?e.offsetHeight:r,s=Ur(n)!==a||Ur(r)!==o;return s&&(n=a,r=o),{width:n,height:r,$:s}}function $i(e){return Mi(e)?e:e.contextElement}function ea(e){let t=$i(e);if(!Ni(t))return Gr(1);let n=t.getBoundingClientRect(),{width:r,height:i,$:a}=Qi(t),o=(a?Ur(n.width):n.width)/r,s=(a?Ur(n.height):n.height)/i;return o&&Number.isFinite(o)||(o=1),s&&Number.isFinite(s)||(s=1),{x:o,y:s}}var ta=Gr(0);function na(e){let t=ki(e);return!Wi()||!t.visualViewport?ta:{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}}function ra(e,t,n){return t===void 0&&(t=!1),!n||t&&n!==ki(e)?!1:t}function ia(e,t,n,r){t===void 0&&(t=!1),n===void 0&&(n=!1);let i=e.getBoundingClientRect(),a=$i(e),o=Gr(1);t&&(r?Mi(r)&&(o=ea(r)):o=ea(e));let s=ra(a,n,r)?na(a):Gr(0),c=(i.left+s.x)/o.x,l=(i.top+s.y)/o.y,u=i.width/o.x,d=i.height/o.y;if(a){let e=ki(a),t=r&&Mi(r)?ki(r):r,n=e,i=Zi(n);for(;i&&r&&t!==n;){let e=ea(i),t=i.getBoundingClientRect(),r=Ki(i),a=t.left+(i.clientLeft+parseFloat(r.paddingLeft))*e.x,o=t.top+(i.clientTop+parseFloat(r.paddingTop))*e.y;c*=e.x,l*=e.y,u*=e.x,d*=e.y,c+=a,l+=o,n=ki(i),i=Zi(n)}}return pi({width:u,height:d,x:c,y:l})}function aa(e,t){let n=qi(e).scrollLeft;return t?t.left+n:ia(Ai(e)).left+n}function oa(e,t){let n=e.getBoundingClientRect();return{x:n.left+t.scrollLeft-aa(e,n),y:n.top+t.scrollTop}}function sa(e){let{elements:t,rect:n,offsetParent:r,strategy:i}=e,a=i===`fixed`,o=Ai(r),s=t?Li(t.floating):!1;if(r===o||s&&a)return n;let c={scrollLeft:0,scrollTop:0},l=Gr(1),u=Gr(0),d=Ni(r);if((d||!d&&!a)&&((Oi(r)!==`body`||Fi(o))&&(c=qi(r)),d)){let e=ia(r);l=ea(r),u.x=e.x+r.clientLeft,u.y=e.y+r.clientTop}let f=o&&!d&&!a?oa(o,c):Gr(0);return{width:n.width*l.x,height:n.height*l.y,x:n.x*l.x-c.scrollLeft*l.x+u.x+f.x,y:n.y*l.y-c.scrollTop*l.y+u.y+f.y}}function ca(e){return Array.from(e.getClientRects())}function la(e){let t=Ai(e),n=qi(e),r=e.ownerDocument.body,i=Hr(t.scrollWidth,t.clientWidth,r.scrollWidth,r.clientWidth),a=Hr(t.scrollHeight,t.clientHeight,r.scrollHeight,r.clientHeight),o=-n.scrollLeft+aa(e),s=-n.scrollTop;return Ki(r).direction===`rtl`&&(o+=Hr(t.clientWidth,r.clientWidth)-i),{width:i,height:a,x:o,y:s}}function ua(e,t){let n=ki(e),r=Ai(e),i=n.visualViewport,a=r.clientWidth,o=r.clientHeight,s=0,c=0;if(i){a=i.width,o=i.height;let e=Wi();(!e||e&&t===`fixed`)&&(s=i.offsetLeft,c=i.offsetTop)}let l=aa(r);if(l<=0){let e=r.ownerDocument,t=e.body,n=getComputedStyle(t),i=e.compatMode===`CSS1Compat`&&parseFloat(n.marginLeft)+parseFloat(n.marginRight)||0,o=Math.abs(r.clientWidth-t.clientWidth-i);o<=25&&(a-=o)}else l<=25&&(a+=l);return{width:a,height:o,x:s,y:c}}function da(e,t){let n=ia(e,!0,t===`fixed`),r=n.top+e.clientTop,i=n.left+e.clientLeft,a=Ni(e)?ea(e):Gr(1);return{width:e.clientWidth*a.x,height:e.clientHeight*a.y,x:i*a.x,y:r*a.y}}function fa(e,t,n){let r;if(t===`viewport`)r=ua(e,n);else if(t===`document`)r=la(Ai(e));else if(Mi(t))r=da(t,n);else{let n=na(e);r={x:t.x-n.x,y:t.y-n.y,width:t.width,height:t.height}}return pi(r)}function pa(e,t){let n=Ji(e);return n===t||!Mi(n)||Gi(n)?!1:Ki(n).position===`fixed`||pa(n,t)}function ma(e,t){let n=t.get(e);if(n)return n;let r=Xi(e,[],!1).filter(e=>Mi(e)&&Oi(e)!==`body`),i=null,a=Ki(e).position===`fixed`,o=a?Ji(e):e;for(;Mi(o)&&!Gi(o);){let t=Ki(o),n=Hi(o);!n&&t.position===`fixed`&&(i=null),(a?!n&&!i:!n&&t.position===`static`&&i&&(i.position===`absolute`||i.position===`fixed`)||Fi(o)&&!n&&pa(e,o))?r=r.filter(e=>e!==o):i=t,o=Ji(o)}return t.set(e,r),r}function ha(e){let{element:t,boundary:n,rootBoundary:r,strategy:i}=e,a=[...n===`clippingAncestors`?Li(t)?[]:ma(t,this._c):[].concat(n),r],o=fa(t,a[0],i),s=o.top,c=o.right,l=o.bottom,u=o.left;for(let e=1;e<a.length;e++){let n=fa(t,a[e],i);s=Hr(n.top,s),c=Vr(n.right,c),l=Vr(n.bottom,l),u=Hr(n.left,u)}return{width:c-u,height:l-s,x:u,y:s}}function ga(e){let{width:t,height:n}=Qi(e);return{width:t,height:n}}function _a(e,t,n){let r=Ni(t),i=Ai(t),a=n===`fixed`,o=ia(e,!0,a,t),s={scrollLeft:0,scrollTop:0},c=Gr(0);function l(){c.x=aa(i)}if(r||!r&&!a){if((Oi(t)!==`body`||Fi(i))&&(s=qi(t)),r){let e=ia(t,!0,a,t);c.x=e.x+t.clientLeft,c.y=e.y+t.clientTop}else i&&l()}a&&!r&&i&&l();let u=i&&!r&&!a?oa(i,s):Gr(0);return{x:o.left+s.scrollLeft-c.x-u.x,y:o.top+s.scrollTop-c.y-u.y,width:o.width,height:o.height}}function va(e){return Ki(e).position===`static`}function ya(e,t){if(!Ni(e)||Ki(e).position===`fixed`)return null;if(t)return t(e);let n=e.offsetParent;return Ai(e)===n&&(n=n.ownerDocument.body),n}function ba(e,t){let n=ki(e);if(Li(e))return n;if(!Ni(e)){let t=Ji(e);for(;t&&!Gi(t);){if(Mi(t)&&!va(t))return t;t=Ji(t)}return n}let r=ya(e,t);for(;r&&Ii(r)&&va(r);)r=ya(r,t);return r&&Gi(r)&&va(r)&&!Hi(r)?n:r||Ui(e)||n}var xa=async function(e){let t=this.getOffsetParent||ba,n=this.getDimensions,r=await n(e.floating);return{reference:_a(e.reference,await t(e.floating),e.strategy),floating:{x:0,y:0,width:r.width,height:r.height}}};function Sa(e){return Ki(e).direction===`rtl`}var Ca={convertOffsetParentRelativeRectToViewportRelativeRect:sa,getDocumentElement:Ai,getClippingRect:ha,getOffsetParent:ba,getElementRects:xa,getClientRects:ca,getDimensions:ga,getScale:ea,isElement:Mi,isRTL:Sa};function wa(e,t){return e.x===t.x&&e.y===t.y&&e.width===t.width&&e.height===t.height}function Ta(e,t){let n=null,r,i=Ai(e);function a(){var e;clearTimeout(r),(e=n)==null||e.disconnect(),n=null}function o(s,c){s===void 0&&(s=!1),c===void 0&&(c=1),a();let l=e.getBoundingClientRect(),{left:u,top:d,width:f,height:p}=l;if(s||t(),!f||!p)return;let m=Wr(d),h=Wr(i.clientWidth-(u+f)),g=Wr(i.clientHeight-(d+p)),_=Wr(u),v={rootMargin:-m+`px `+-h+`px `+-g+`px `+-_+`px`,threshold:Hr(0,Vr(1,c))||1},y=!0;function b(t){let n=t[0].intersectionRatio;if(n!==c){if(!y)return o();n?o(!1,n):r=setTimeout(()=>{o(!1,1e-7)},1e3)}n===1&&!wa(l,e.getBoundingClientRect())&&o(),y=!1}try{n=new IntersectionObserver(b,{...v,root:i.ownerDocument})}catch{n=new IntersectionObserver(b,v)}n.observe(e)}return o(!0),a}function Ea(e,t,n,r){r===void 0&&(r={});let{ancestorScroll:i=!0,ancestorResize:a=!0,elementResize:o=typeof ResizeObserver==`function`,layoutShift:s=typeof IntersectionObserver==`function`,animationFrame:c=!1}=r,l=$i(e),u=i||a?[...l?Xi(l):[],...t?Xi(t):[]]:[];u.forEach(e=>{i&&e.addEventListener(`scroll`,n,{passive:!0}),a&&e.addEventListener(`resize`,n)});let d=l&&s?Ta(l,n):null,f=-1,p=null;o&&(p=new ResizeObserver(e=>{let[r]=e;r&&r.target===l&&p&&t&&(p.unobserve(t),cancelAnimationFrame(f),f=requestAnimationFrame(()=>{var e;(e=p)==null||e.observe(t)})),n()}),l&&!c&&p.observe(l),t&&p.observe(t));let m,h=c?ia(e):null;c&&g();function g(){let t=ia(e);h&&!wa(h,t)&&n(),h=t,m=requestAnimationFrame(g)}return n(),()=>{var e;u.forEach(e=>{i&&e.removeEventListener(`scroll`,n),a&&e.removeEventListener(`resize`,n)}),d?.(),(e=p)==null||e.disconnect(),p=null,c&&cancelAnimationFrame(m)}}var Da=wi,Oa=Ti,ka=vi,Aa=Ei,ja=xi,Ma=_i,Na=(e,t,n)=>{let r=new Map,i={platform:Ca,...n},a={...i.platform,_c:r};return gi(e,t,{...i,platform:a})},Pa=F();function Fa(){let e=c(Pa);if(e===void 0)throw Error("[kobalte]: `usePopperContext` must be used within a `Popper` component");return e}var Ia=p(`<svg display="block" viewBox="0 0 30 30" style="transform:scale(1.02)"><g><path fill="none" d="M23,27.8c1.1,1.2,3.4,2.2,5,2.2h2H0h2c1.7,0,3.9-1,5-2.2l6.6-7.2c0.7-0.8,2-0.8,2.7,0L23,27.8L23,27.8z"></path><path stroke="none" d="M23,27.8c1.1,1.2,3.4,2.2,5,2.2h2H0h2c1.7,0,3.9-1,5-2.2l6.6-7.2c0.7-0.8,2-0.8,2.7,0L23,27.8L23,27.8z">`),La=30,Ra=La/2,za={top:180,right:-90,bottom:0,left:90};function Ba(t){let n=Fa(),r=q({size:La},t),[i,a]=A(r,[`ref`,`style`,`size`]),o=()=>n.currentPlacement().split(`-`)[0],s=Va(n.contentRef),c=()=>s()?.getPropertyValue(`background-color`)||`none`,l=()=>s()?.getPropertyValue(`border-${o()}-color`)||`none`,u=()=>s()?.getPropertyValue(`border-${o()}-width`)||`0px`,d=()=>Number.parseInt(u())*2*(La/i.size),f=()=>`rotate(${za[o()]} ${Ra} ${Ra}) translate(0 2)`;return T(J,P({as:`div`,ref(e){let t=ot(n.setArrowRef,i.ref);typeof t==`function`&&t(e)},"aria-hidden":`true`,get style(){return Tt({position:`absolute`,"font-size":`${i.size}px`,width:`1em`,height:`1em`,"pointer-events":`none`,fill:c(),stroke:l(),"stroke-width":d()},i.style)}},a,{get children(){let t=Ia(),n=t.firstChild;return e(()=>z(n,`transform`,f())),t}}))}function Va(e){let[t,n]=o();return l(()=>{let t=e();t&&n(Pt(t).getComputedStyle(t))}),t}function Ha(e){let t=Fa(),[n,r]=A(e,[`ref`,`style`]);return T(J,P({as:`div`,ref(e){let r=ot(t.setPositionerRef,n.ref);typeof r==`function`&&r(e)},"data-popper-positioner":``,get style(){return Tt({position:`absolute`,top:0,left:0,"min-width":`max-content`},n.style)}},r))}function Ua(e){let{x:t=0,y:n=0,width:r=0,height:i=0}=e??{};if(typeof DOMRect==`function`)return new DOMRect(t,n,r,i);let a={x:t,y:n,width:r,height:i,top:n,right:t+r,bottom:n+i,left:t};return{...a,toJSON:()=>a}}function Wa(e,t){return{contextElement:e,getBoundingClientRect:()=>{let n=t(e);return n?Ua(n):e?e.getBoundingClientRect():Ua()}}}function Ga(e){return/^(?:top|bottom|left|right)(?:-(?:start|end))?$/.test(e)}var Ka={top:`bottom`,right:`left`,bottom:`top`,left:`right`};function qa(e,t){let[n,r]=e.split(`-`),i=Ka[n];return r?n===`left`||n===`right`?`${i} ${r===`start`?`top`:`bottom`}`:r===`start`?`${i} ${t===`rtl`?`right`:`left`}`:`${i} ${t===`rtl`?`left`:`right`}`:`${i} center`}function Ja(e){let t=q({getAnchorRect:e=>e?.getBoundingClientRect(),placement:`bottom`,gutter:0,shift:0,flip:!0,slide:!0,overlap:!1,sameWidth:!1,fitViewport:!1,hideWhenDetached:!1,detachedPadding:0,arrowPadding:4,overflowPadding:8},e),[r,i]=o(),[a,s]=o(),[c,u]=o(t.placement),d=()=>Wa(t.anchorRef?.(),t.getAnchorRect),{direction:f}=Nn();async function p(){let e=d(),n=r(),i=a();if(!e||!n)return;let o=(i?.clientHeight||0)/2,s=typeof t.gutter==`number`?t.gutter+o:t.gutter??o;n.style.setProperty(`--kb-popper-content-overflow-padding`,`${t.overflowPadding}px`),e.getBoundingClientRect();let c=[Da(({placement:e})=>{let n=!!e.split(`-`)[1];return{mainAxis:s,crossAxis:n?void 0:t.shift,alignmentAxis:t.shift}})];if(t.flip!==!1){let e=typeof t.flip==`string`?t.flip.split(` `):void 0;if(e!==void 0&&!e.every(Ga))throw Error("`flip` expects a spaced-delimited list of placements");c.push(ka({padding:t.overflowPadding,fallbackPlacements:e}))}(t.slide||t.overlap)&&c.push(Oa({mainAxis:t.slide,crossAxis:t.overlap,padding:t.overflowPadding})),c.push(Aa({padding:t.overflowPadding,apply({availableWidth:e,availableHeight:r,rects:i}){let a=Math.round(i.reference.width);e=Math.floor(e),r=Math.floor(r),n.style.setProperty(`--kb-popper-anchor-width`,`${a}px`),n.style.setProperty(`--kb-popper-content-available-width`,`${e}px`),n.style.setProperty(`--kb-popper-content-available-height`,`${r}px`),t.sameWidth&&(n.style.width=`${a}px`),t.fitViewport&&(n.style.maxWidth=`${e}px`,n.style.maxHeight=`${r}px`)}})),t.hideWhenDetached&&c.push(ja({padding:t.detachedPadding})),i&&c.push(Ma({element:i,padding:t.arrowPadding}));let l=await Na(e,n,{placement:t.placement,strategy:`absolute`,middleware:c,platform:{...Ca,isRTL:()=>f()===`rtl`}});if(u(l.placement),t.onCurrentPlacementChange?.(l.placement),!n)return;n.style.setProperty(`--kb-popper-content-transform-origin`,qa(l.placement,f()));let p=Math.round(l.x),m=Math.round(l.y),h;if(t.hideWhenDetached&&(h=l.middlewareData.hide?.referenceHidden?`hidden`:`visible`),Object.assign(n.style,{top:`0`,left:`0`,transform:`translate3d(${p}px, ${m}px, 0)`,visibility:h}),i&&l.middlewareData.arrow){let{x:e,y:t}=l.middlewareData.arrow,n=l.placement.split(`-`)[0];Object.assign(i.style,{left:e==null?``:`${e}px`,top:t==null?``:`${t}px`,[n]:`100%`})}}l(()=>{let e=d(),t=r();if(!e||!t)return;let i=Ea(e,t,p,{elementResize:typeof ResizeObserver==`function`});n(i)}),l(()=>{let e=r(),n=t.contentRef?.();e&&n&&queueMicrotask(()=>{e.style.zIndex=getComputedStyle(n).zIndex})});let m={currentPlacement:c,contentRef:()=>t.contentRef?.(),setPositionerRef:i,setArrowRef:s};return T(Pa.Provider,{value:m,get children(){return t.children}})}var Ya=Object.assign(Ja,{Arrow:Ba,Context:Pa,usePopperContext:Fa,Positioner:Ha});function Xa(e){let t=t=>{t.key===Lt.Escape&&e.onEscapeKeyDown?.(t)};l(()=>{if(V(e.isDisabled))return;let r=e.ownerDocument?.()??Ft();r.addEventListener(`keydown`,t),n(()=>{r.removeEventListener(`keydown`,t)})})}function Za(e){let t=(typeof e.composedPath==`function`?e.composedPath():void 0)?.[0]??e.target;return t instanceof Element?t:null}function Qa(e,t){if(!e)return!1;let n=t;for(;n;){if(Mt(e,n))return!0;let t=n.getRootNode();n=t instanceof ShadowRoot?t.host:null}return!1}function $a(e,t){let n=e;for(;n;){let e=n.closest(t);if(e)return e;let r=n.getRootNode();n=r instanceof ShadowRoot?r.host:null}return null}var eo=`interactOutside.pointerDownOutside`,to=`interactOutside.focusOutside`;function no(e,t){let r,i=fn,a=()=>Ft(t()),o=t=>e.onPointerDownOutside?.(t),s=t=>e.onFocusOutside?.(t),c=t=>e.onInteractOutside?.(t),u=n=>{let r=Za(n);return!r||$a(r,`[data-kb-top-layer]`)||!Qa(a(),r)||Qa(t(),r)?!1:!e.shouldExcludeElement?.(r)},d=e=>{function n(){let n=t(),r=Za(e);if(!n||!r||!u(e))return;let i=K([o,c]);r.addEventListener(eo,i,{once:!0});let a=new CustomEvent(eo,{bubbles:!1,cancelable:!0,detail:{originalEvent:e,isContextMenu:e.button===2||Wt(e)&&e.button===0}});r.dispatchEvent(a)}e.pointerType===`touch`?(a().removeEventListener(`click`,n),i=n,a().addEventListener(`click`,n,{once:!0})):n()},f=e=>{let n=t(),r=Za(e);if(!n||!r||!u(e))return;let i=K([s,c]);r.addEventListener(to,i,{once:!0});let a=new CustomEvent(to,{bubbles:!1,cancelable:!0,detail:{originalEvent:e,isContextMenu:!1}});r.dispatchEvent(a)};l(()=>{V(e.isDisabled)||(r=window.setTimeout(()=>{a().addEventListener(`pointerdown`,d,!0)},0),a().addEventListener(`focusin`,f,!0),n(()=>{window.clearTimeout(r),a().removeEventListener(`click`,i),a().removeEventListener(`pointerdown`,d,!0),a().removeEventListener(`focusin`,f,!0)}))})}var ro=F();function io(){return c(ro)}function ao(e){let t,r=io(),[i,a]=A(e,[`ref`,`disableOutsidePointerEvents`,`excludedElements`,`onEscapeKeyDown`,`onPointerDownOutside`,`onFocusOutside`,`onInteractOutside`,`onDismiss`,`bypassTopMostLayerCheck`]),o=new Set([]),c=e=>{o.add(e);let t=r?.registerNestedLayer(e);return()=>{o.delete(e),t?.()}};no({shouldExcludeElement:e=>t?i.excludedElements?.some(t=>Mt(t(),e))||[...o].some(t=>Mt(t,e)):!1,onPointerDownOutside:e=>{t&&!jr.isBelowPointerBlockingLayer(t)&&(i.bypassTopMostLayerCheck||jr.isTopMostLayer(t))&&(i.onPointerDownOutside?.(e),i.onInteractOutside?.(e),e.defaultPrevented||i.onDismiss?.())},onFocusOutside:e=>{i.onFocusOutside?.(e),i.onInteractOutside?.(e),e.defaultPrevented||i.onDismiss?.()}},()=>t),Xa({ownerDocument:()=>Ft(t),onEscapeKeyDown:e=>{t&&jr.isTopMostLayer(t)&&(i.onEscapeKeyDown?.(e),!e.defaultPrevented&&i.onDismiss&&(e.preventDefault(),i.onDismiss()))}}),s(()=>{if(!t)return;jr.addLayer({node:t,isPointerBlocking:i.disableOutsidePointerEvents,dismiss:i.onDismiss});let e=r?.registerNestedLayer(t);jr.assignPointerEventToLayers(),jr.disableBodyPointerEvents(t),n(()=>{t&&(jr.removeLayer(t),e?.(),jr.assignPointerEventToLayers(),jr.restoreBodyPointerEvents(t))})}),l(g([()=>t,()=>i.disableOutsidePointerEvents],([e,t])=>{if(!e)return;let r=jr.find(e);r&&r.isPointerBlocking!==t&&(r.isPointerBlocking=t,jr.assignPointerEventToLayers()),t&&jr.disableBodyPointerEvents(e),n(()=>{jr.restoreBodyPointerEvents(e)})},{defer:!0}));let u={registerNestedLayer:c};return T(ro.Provider,{value:u,get children(){return T(J,P({as:`div`,ref(e){let n=ot(e=>t=e,i.ref);typeof n==`function`&&n(e)}},a))}})}function oo(e={}){let[t,n]=Ln({value:()=>V(e.open),defaultValue:()=>!!V(e.defaultOpen),onChange:t=>e.onOpenChange?.(t)}),r=()=>{n(!0)},i=()=>{n(!1)};return{isOpen:t,setIsOpen:n,open:r,close:i,toggle:()=>{t()?i():r()}}}var so=[`id`,`name`,`validationState`,`required`,`disabled`,`readOnly`];function co(e){let t=q({id:`form-control-${O()}`},e),[n,r]=o(),[i,a]=o(),[s,c]=o(),[l,u]=o();return{formControlContext:{name:()=>V(t.name)??V(t.id),dataset:B(()=>({"data-valid":V(t.validationState)===`valid`?``:void 0,"data-invalid":V(t.validationState)===`invalid`?``:void 0,"data-required":V(t.required)?``:void 0,"data-disabled":V(t.disabled)?``:void 0,"data-readonly":V(t.readOnly)?``:void 0})),validationState:()=>V(t.validationState),isRequired:()=>V(t.required),isDisabled:()=>V(t.disabled),isReadOnly:()=>V(t.readOnly),labelId:n,fieldId:i,descriptionId:s,errorMessageId:l,getAriaLabelledBy:(e,t,r)=>{let i=r!=null||n()!=null;return[r,n(),i&&t!=null?e:void 0].filter(Boolean).join(` `)||void 0},getAriaDescribedBy:e=>[s(),l(),e].filter(Boolean).join(` `)||void 0,generateId:jt(()=>V(t.id)),registerLabel:Rr(r),registerField:Rr(a),registerDescription:Rr(c),registerErrorMessage:Rr(u)}}}var lo=F();function uo(){let e=c(lo);if(e===void 0)throw Error("[kobalte]: `useFormControlContext` must be used within a `FormControlContext.Provider` component");return e}function fo(e){let t=uo(),r=q({id:t.generateId(`description`)},e);return l(()=>n(t.registerDescription(r.id))),T(J,P({as:`div`},()=>t.dataset(),r))}var po=class{collection;ref;collator;constructor(e,t,n){this.collection=e,this.ref=t,this.collator=n}getKeyBelow(e){let t=this.collection().getKeyAfter(e);for(;t!=null;){let e=this.collection().getItem(t);if(e&&e.type===`item`&&!e.disabled)return t;t=this.collection().getKeyAfter(t)}}getKeyAbove(e){let t=this.collection().getKeyBefore(e);for(;t!=null;){let e=this.collection().getItem(t);if(e&&e.type===`item`&&!e.disabled)return t;t=this.collection().getKeyBefore(t)}}getFirstKey(){let e=this.collection().getFirstKey();for(;e!=null;){let t=this.collection().getItem(e);if(t&&t.type===`item`&&!t.disabled)return e;e=this.collection().getKeyAfter(e)}}getLastKey(){let e=this.collection().getLastKey();for(;e!=null;){let t=this.collection().getItem(e);if(t&&t.type===`item`&&!t.disabled)return e;e=this.collection().getKeyBefore(e)}}getItem(e){return this.ref?.()?.querySelector(`[data-key="${e}"]`)??null}getKeyPageAbove(e){let t=this.ref?.(),n=this.getItem(e);if(!t||!n)return;let r=Math.max(0,n.offsetTop+n.offsetHeight-t.offsetHeight),i=e;for(;i&&n&&n.offsetTop>r;)i=this.getKeyAbove(i),n=i==null?null:this.getItem(i);return i}getKeyPageBelow(e){let t=this.ref?.(),n=this.getItem(e);if(!t||!n)return;let r=Math.min(t.scrollHeight,n.offsetTop-n.offsetHeight+t.offsetHeight),i=e;for(;i&&n&&n.offsetTop<r;)i=this.getKeyBelow(i),n=i==null?null:this.getItem(i);return i}getKeyForSearch(e,t){let n=this.collator?.();if(!n)return;let r=t==null?this.getFirstKey():this.getKeyBelow(t);for(;r!=null;){let t=this.collection().getItem(r);if(t){let i=t.textValue.slice(0,e.length);if(t.textValue&&n.compare(i,e)===0)return r}r=this.getKeyBelow(r)}}};function mo(e,t,n){let r=Fn({usage:`search`,sensitivity:`base`});return Yn({selectionManager:()=>V(e.selectionManager),keyboardDelegate:B(()=>V(e.keyboardDelegate)||new po(e.collection,t,r)),autoFocus:()=>V(e.autoFocus),deferAutoFocus:()=>V(e.deferAutoFocus),shouldFocusWrap:()=>V(e.shouldFocusWrap),disallowEmptySelection:()=>V(e.disallowEmptySelection),selectOnFocus:()=>V(e.selectOnFocus),disallowTypeAhead:()=>V(e.disallowTypeAhead),shouldUseVirtualFocus:()=>V(e.shouldUseVirtualFocus),allowsTabNavigation:()=>V(e.allowsTabNavigation),isVirtualized:()=>V(e.isVirtualized),scrollToKey:t=>V(e.scrollToKey)?.(t),orientation:()=>V(e.orientation)},t,n)}var ho=`focusScope.autoFocusOnMount`,go=`focusScope.autoFocusOnUnmount`,_o={bubbles:!1,cancelable:!0},vo={stack:[],active(){return this.stack[0]},add(e){e!==this.active()&&this.active()?.pause(),this.stack=Dt(this.stack,e),this.stack.unshift(e)},remove(e){this.stack=Dt(this.stack,e),this.active()?.resume()}};function yo(e,t){let[r,i]=o(!1),a={pause(){i(!0)},resume(){i(!1)}},s=null,c=t=>e.onMountAutoFocus?.(t),u=t=>e.onUnmountAutoFocus?.(t),d=()=>Ft(t()),f=()=>{let e=d().createElement(`span`);return e.setAttribute(`data-focus-trap`,``),e.tabIndex=0,Object.assign(e.style,bn),e},p=()=>{let e=t();return e?en(e,!0).filter(e=>!e.hasAttribute(`data-focus-trap`)):[]},m=()=>{let e=p();return e.length>0?e[0]:null},h=()=>{let e=p();return e.length>0?e[e.length-1]:null},g=()=>{let e=t();if(!e)return!1;let n=Nt(e);return!n||Mt(e,n)?!1:nn(n)};l(()=>{let e=t();if(!e)return;vo.add(a);let r=Nt(e);if(!Mt(e,r)){let t=new CustomEvent(ho,_o);e.addEventListener(ho,c),e.dispatchEvent(t),t.defaultPrevented||setTimeout(()=>{Gt(m()),Nt(e)===r&&Gt(e)},0)}n(()=>{e.removeEventListener(ho,c),setTimeout(()=>{let t=new CustomEvent(go,_o);g()&&t.preventDefault(),e.addEventListener(go,u),e.dispatchEvent(t),t.defaultPrevented||Gt(r??d().body),e.removeEventListener(go,u),vo.remove(a)},0)})}),l(()=>{let i=t();if(!i||!V(e.trapFocus)||r())return;let a=e=>{let t=e.target;t?.closest(`[data-kb-top-layer]`)||(Mt(i,t)?s=t:Gt(s))},o=e=>{let t=e.relatedTarget??Nt(i);t?.closest(`[data-kb-top-layer]`)||Mt(i,t)||Gt(s)};d().addEventListener(`focusin`,a),d().addEventListener(`focusout`,o),n(()=>{d().removeEventListener(`focusin`,a),d().removeEventListener(`focusout`,o)})}),l(()=>{let i=t();if(!i||!V(e.trapFocus)||r())return;let a=f();i.insertAdjacentElement(`afterbegin`,a);let o=f();i.insertAdjacentElement(`beforeend`,o);function s(e){let t=m(),n=h();e.relatedTarget===t?Gt(n):Gt(t)}a.addEventListener(`focusin`,s),o.addEventListener(`focusin`,s);let c=new MutationObserver(e=>{for(let t of e)t.previousSibling===o&&(o.remove(),i.insertAdjacentElement(`beforeend`,o)),t.nextSibling===a&&(a.remove(),i.insertAdjacentElement(`afterbegin`,a))});c.observe(i,{childList:!0,subtree:!1}),n(()=>{a.removeEventListener(`focusin`,s),o.removeEventListener(`focusin`,s),a.remove(),o.remove(),c.disconnect()})})}var bo=`data-live-announcer`;function xo(e){l(()=>{V(e.isDisabled)||n(wo(V(e.targets),V(e.root)))})}var So=new WeakMap,Co=[];function wo(e,t=document.body){let n=new Set(e),r=new Set,i=e=>{for(let t of e.querySelectorAll(`[${bo}], [${hr}]`))n.add(t);let t=e=>{if(n.has(e)||e.parentElement&&r.has(e.parentElement)&&e.parentElement.getAttribute(`role`)!==`row`)return NodeFilter.FILTER_REJECT;for(let t of n)if(e.contains(t))return NodeFilter.FILTER_SKIP;return NodeFilter.FILTER_ACCEPT},i=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:t}),o=t(e);if(o===NodeFilter.FILTER_ACCEPT&&a(e),o!==NodeFilter.FILTER_REJECT){let e=i.nextNode();for(;e!=null;)a(e),e=i.nextNode()}},a=e=>{let t=So.get(e)??0;(e.getAttribute(`aria-hidden`)!==`true`||t!==0)&&(t===0&&setTimeout(()=>requestAnimationFrame(()=>e.setAttribute(`aria-hidden`,`true`))),r.add(e),So.set(e,t+1))};Co.length&&Co[Co.length-1].disconnect(),i(t);let o=new MutationObserver(e=>{for(let t of e)if(t.type===`childList`&&t.addedNodes.length!==0&&![...n,...r].some(e=>e.contains(t.target))){for(let e of t.removedNodes)e instanceof Element&&(n.delete(e),r.delete(e));for(let e of t.addedNodes)(e instanceof HTMLElement||e instanceof SVGElement)&&(e.dataset.liveAnnouncer===`true`||e.dataset.reactAriaTopLayer===`true`)?n.add(e):e instanceof Element&&i(e)}});o.observe(t,{childList:!0,subtree:!0});let s={observe(){o.observe(t,{childList:!0,subtree:!0})},disconnect(){o.disconnect()}};return Co.push(s),()=>{o.disconnect();for(let e of r){let t=So.get(e);if(t==null)return;t===1?setTimeout(()=>requestAnimationFrame(()=>{let t=So.get(e);t===1?(e.removeAttribute(`aria-hidden`),So.delete(e)):t!=null&&t>1&&So.set(e,t-1)})):So.set(e,t-1)}s===Co[Co.length-1]?(Co.pop(),Co.length&&Co[Co.length-1].observe()):Co.splice(Co.indexOf(s),1)}}function To(e){let t,i=uo(),a=q({id:i.generateId(`label`)},e),[o,s]=A(a,[`ref`]),c=Mr(()=>t,()=>`label`);return l(()=>n(i.registerLabel(s.id))),T(J,P({as:`label`,ref(e){let n=ot(e=>t=e,o.ref);typeof n==`function`&&n(e)},get for(){return r(()=>c()===`label`)()?i.fieldId():void 0}},()=>i.dataset(),s))}function Eo(e,t){l(g(e,e=>{if(e==null)return;let r=Do(e);r!=null&&(r.addEventListener(`reset`,t,{passive:!0}),n(()=>{r.removeEventListener(`reset`,t)}))}))}function Do(e){return Oo(e)?e.form:e.closest(`form`)}function Oo(e){return e.matches(`textarea, input, select, button`)}function ko(e){let t=uo(),r=q({id:t.generateId(`error-message`)},e),[i,a]=A(r,[`forceMount`]),o=()=>t.validationState()===`invalid`;return l(()=>{o()&&n(t.registerErrorMessage(a.id))}),T(L,{get when(){return i.forceMount||o()},get children(){return T(J,P({as:`div`},()=>t.dataset(),a))}})}var Ao=(e,t)=>{if(e.contains(t))return!0;let n=t;for(;n;){if(n===e)return!0;n=n._$host??n.parentElement}return!1},jo=new Map,Mo=e=>{l(()=>{let t=Y(e.style)??{},r=Y(e.properties)??[],i={};for(let n in t)i[n]=e.element.style[n];let a=jo.get(e.key);a?a.activeCount++:jo.set(e.key,{activeCount:1,originalStyles:i,properties:r.map(e=>e.key)}),Object.assign(e.element.style,e.style);for(let t of r)e.element.style.setProperty(t.key,t.value);n(()=>{let t=jo.get(e.key);if(t){if(t.activeCount!==1)t.activeCount--;else{jo.delete(e.key);for(let[n,r]of Object.entries(t.originalStyles))e.element.style[n]=r;for(let n of t.properties)e.element.style.removeProperty(n);e.element.style.length===0&&e.element.removeAttribute(`style`),e.cleanup?.()}}})})},No=(e,t)=>{switch(t){case`x`:return[e.clientWidth,e.scrollLeft,e.scrollWidth];case`y`:return[e.clientHeight,e.scrollTop,e.scrollHeight]}},Po=(e,t)=>{let n=getComputedStyle(e),r=t===`x`?n.overflowX:n.overflowY;return r===`auto`||r===`scroll`||e.tagName===`HTML`&&r===`visible`},Fo=(e,t,n)=>{let r=t===`x`&&window.getComputedStyle(e).direction===`rtl`?-1:1,i=e,a=0,o=0,s=!1;do{let[e,c,l]=No(i,t),u=l-e-r*c;(c!==0||u!==0)&&Po(i,t)&&(a+=u,o+=c),i===(n??document.documentElement)?s=!0:i=i._$host??i.parentElement}while(i&&!s);return[a,o]},[Io,Lo]=o([]),Ro=e=>Io().indexOf(e)===Io().length-1,zo=e=>{let t=P({element:null,enabled:!0,hideScrollbar:!0,preventScrollbarShift:!0,preventScrollbarShiftMode:`padding`,restoreScrollPosition:!0,allowPinchZoom:!1},e),r=O(),i=[0,0],a=null,o=null;l(()=>{Y(t.enabled)&&(Lo(e=>[...e,r]),n(()=>{Lo(e=>e.filter(e=>e!==r))}))}),l(()=>{if(!Y(t.enabled)||!Y(t.hideScrollbar))return;let{documentElement:e}=document,n=window.innerWidth-e.clientWidth;if(Y(t.preventScrollbarShift)){let r={overflow:`hidden`},i=[];n>0&&(Y(t.preventScrollbarShiftMode)===`padding`?r.paddingRight=`calc(${window.getComputedStyle(e).paddingRight} + ${n}px)`:r.marginRight=`calc(${window.getComputedStyle(e).marginRight} + ${n}px)`,i.push({key:`--scrollbar-width`,value:`${n}px`}));let a=window.scrollY,o=window.scrollX;Mo({key:`prevent-scroll`,element:e,style:r,properties:i,cleanup:()=>{Y(t.restoreScrollPosition)&&n>0&&window.scrollTo(o,a)}})}else Mo({key:`prevent-scroll`,element:e,style:{overflow:`hidden`}})}),l(()=>{Ro(r)&&Y(t.enabled)&&(document.addEventListener(`wheel`,c,{passive:!1}),document.addEventListener(`touchstart`,s,{passive:!1}),document.addEventListener(`touchmove`,u,{passive:!1}),n(()=>{document.removeEventListener(`wheel`,c),document.removeEventListener(`touchstart`,s),document.removeEventListener(`touchmove`,u)}))});let s=e=>{i=Vo(e),a=null,o=null},c=e=>{let n=e.target,r=Y(t.element),i=Bo(e),a=Math.abs(i[0])>Math.abs(i[1])?`x`:`y`,o=Ho(n,a,a===`x`?i[0]:i[1],r),s;s=r&&Ao(r,n)?!o:!0,s&&e.cancelable&&e.preventDefault()},u=e=>{let n=Y(t.element),r=e.target,s;if(e.touches.length===2)s=!Y(t.allowPinchZoom);else{if(a==null||o===null){let t=Vo(e).map((e,t)=>i[t]-e),n=Math.abs(t[0])>Math.abs(t[1])?`x`:`y`;a=n,o=n===`x`?t[0]:t[1]}if(r.type===`range`)s=!1;else{let e=Ho(r,a,o,n);s=n&&Ao(n,r)?!e:!0}}s&&e.cancelable&&e.preventDefault()}},Bo=e=>[e.deltaX,e.deltaY],Vo=e=>e.changedTouches[0]?[e.changedTouches[0].clientX,e.changedTouches[0].clientY]:[0,0],Ho=(e,t,n,r)=>{let[i,a]=Fo(e,t,r!==null&&Ao(r,e)?r:void 0);return!(n>0&&Math.abs(i)<=1||n<0&&Math.abs(a)<1)},Uo=zo,Wo={};pr(Wo,{Description:()=>fo,ErrorMessage:()=>ko,Item:()=>Yo,ItemControl:()=>Xo,ItemDescription:()=>Zo,ItemIndicator:()=>Qo,ItemInput:()=>$o,ItemLabel:()=>es,Label:()=>ts,RadioGroup:()=>rs,Root:()=>ns,useRadioGroupContext:()=>Ko});var Go=F();function Ko(){let e=c(Go);if(e===void 0)throw Error("[kobalte]: `useRadioGroupContext` must be used within a `RadioGroup` component");return e}var qo=F();function Jo(){let e=c(qo);if(e===void 0)throw Error("[kobalte]: `useRadioGroupItemContext` must be used within a `RadioGroup.Item` component");return e}function Yo(e){let t=uo(),n=Ko(),r=q({id:`${t.generateId(`item`)}-${O()}`},e),[i,a]=A(r,[`value`,`disabled`,`onPointerDown`]),[s,c]=o(),[l,u]=o(),[d,f]=o(),[p,m]=o(),[h,g]=o(!1),_=B(()=>n.isDefaultValue(i.value)),v=B(()=>n.isSelectedValue(i.value)),y=B(()=>i.disabled||t.isDisabled()||!1),b=e=>{G(e,i.onPointerDown),h()&&e.preventDefault()},x=B(()=>({...t.dataset(),"data-disabled":y()?``:void 0,"data-checked":v()?``:void 0})),S={value:()=>i.value,dataset:x,isDefault:_,isSelected:v,isDisabled:y,inputId:s,labelId:l,descriptionId:d,inputRef:p,select:()=>n.setSelectedValue(i.value),generateId:jt(()=>a.id),registerInput:Rr(c),registerLabel:Rr(u),registerDescription:Rr(f),setIsFocused:g,setInputRef:m};return T(qo.Provider,{value:S,get children(){return T(J,P({as:`div`,role:`group`,onPointerDown:b},x,a))}})}function Xo(e){let t=Jo(),n=q({id:t.generateId(`control`)},e),[r,i]=A(n,[`onClick`,`onKeyDown`]);return T(J,P({as:`div`,onClick:e=>{G(e,r.onClick),t.select(),t.inputRef()?.focus({preventScroll:!0})},onKeyDown:e=>{G(e,r.onKeyDown),e.key===Lt.Space&&(t.select(),t.inputRef()?.focus({preventScroll:!0}))}},()=>t.dataset(),i))}function Zo(e){let t=Jo(),r=q({id:t.generateId(`description`)},e);return l(()=>n(t.registerDescription(r.id))),T(J,P({as:`div`},()=>t.dataset(),r))}function Qo(e){let t=Jo(),n=q({id:t.generateId(`indicator`)},e),[r,i]=A(n,[`ref`,`forceMount`]),[a,s]=o(),{present:c}=mr({show:()=>r.forceMount||t.isSelected(),element:()=>a()??null});return T(L,{get when(){return c()},get children(){return T(J,P({as:`div`,ref(e){let t=ot(s,r.ref);typeof t==`function`&&t(e)}},()=>t.dataset(),i))}})}function $o(e){let t=uo(),r=Ko(),i=Jo(),a=q({id:i.generateId(`input`)},e),[s,c]=A(a,[`ref`,`style`,`aria-labelledby`,`aria-describedby`,`onChange`,`onFocus`,`onBlur`]),u=()=>[s[`aria-labelledby`],i.labelId(),s[`aria-labelledby`]!=null&&c[`aria-label`]!=null?c.id:void 0].filter(Boolean).join(` `)||void 0,d=()=>[s[`aria-describedby`],i.descriptionId(),r.ariaDescribedBy()].filter(Boolean).join(` `)||void 0,[f,p]=o(!1);return l(g([()=>i.isSelected(),()=>i.value()],e=>{if(!e[0]&&e[1]===i.value())return;p(!0);let t=i.inputRef();t?.dispatchEvent(new Event(`input`,{bubbles:!0,cancelable:!0})),t?.dispatchEvent(new Event(`change`,{bubbles:!0,cancelable:!0}))},{defer:!0})),l(()=>n(i.registerInput(c.id))),T(J,P({as:`input`,ref(e){let t=ot(i.setInputRef,s.ref);typeof t==`function`&&t(e)},type:`radio`,get name(){return t.name()},get value(){return i.value()},get checked(){return i.isSelected()},get required(){return t.isRequired()},get disabled(){return i.isDisabled()},get readonly(){return t.isReadOnly()},get style(){return Tt({...bn},s.style)},get"aria-labelledby"(){return u()},get"aria-describedby"(){return d()},onChange:e=>{if(G(e,s.onChange),e.stopPropagation(),!f()){r.setSelectedValue(i.value());let t=e.target;t.checked=i.isSelected()}p(!1)},onFocus:e=>{G(e,s.onFocus),i.setIsFocused(!0)},onBlur:e=>{G(e,s.onBlur),i.setIsFocused(!1)}},()=>i.dataset(),c))}function es(e){let t=Jo(),r=q({id:t.generateId(`label`)},e);return l(()=>n(t.registerLabel(r.id))),T(J,P({as:`label`,get for(){return t.inputId()}},()=>t.dataset(),r))}function ts(e){return T(To,P({as:`span`},e))}function ns(e){let t,n=q({id:`radiogroup-${O()}`,orientation:`vertical`},e),[r,i,a]=A(n,[`ref`,`value`,`defaultValue`,`onChange`,`orientation`,`aria-labelledby`,`aria-describedby`],so),[o,s]=In({value:()=>r.value,defaultValue:()=>r.defaultValue,onChange:e=>r.onChange?.(e)}),{formControlContext:c}=co(i);Eo(()=>t,()=>s(r.defaultValue??``));let l=()=>c.getAriaLabelledBy(V(i.id),a[`aria-label`],r[`aria-labelledby`]),u=()=>c.getAriaDescribedBy(r[`aria-describedby`]),d=t=>t===e.defaultValue,f=e=>e===o(),p={ariaDescribedBy:u,isDefaultValue:d,isSelectedValue:f,setSelectedValue:e=>{if(!(c.isReadOnly()||c.isDisabled())&&(s(e),t))for(let e of t.querySelectorAll(`[type='radio']`)){let t=e;t.checked=f(t.value)}}};return T(lo.Provider,{value:c,get children(){return T(Go.Provider,{value:p,get children(){return T(J,P({as:`div`,ref(e){let n=ot(e=>t=e,r.ref);typeof n==`function`&&n(e)},role:`radiogroup`,get id(){return V(i.id)},get"aria-invalid"(){return c.validationState()===`invalid`||void 0},get"aria-required"(){return c.isRequired()||void 0},get"aria-disabled"(){return c.isDisabled()||void 0},get"aria-readonly"(){return c.isReadOnly()||void 0},get"aria-orientation"(){return r.orientation},get"aria-labelledby"(){return l()},get"aria-describedby"(){return u()}},()=>c.dataset(),a))}})}})}var rs=Object.assign(ns,{Description:fo,ErrorMessage:ko,Item:Yo,ItemControl:Xo,ItemDescription:Zo,ItemIndicator:Qo,ItemInput:$o,ItemLabel:es,Label:ts}),is=F();function as(){return c(is)}var os=F();function ss(){return c(os)}var cs=F();function ls(){return c(cs)}function us(){let e=ls();if(e===void 0)throw Error("[kobalte]: `useMenuContext` must be used within a `Menu` component");return e}var ds=F();function fs(){let e=c(ds);if(e===void 0)throw Error("[kobalte]: `useMenuRootContext` must be used within a `MenuRoot` component");return e}function ps(e,t,n){let r=e.split(`-`)[0],i=n.getBoundingClientRect(),a=[],o=t.clientX,s=t.clientY;switch(r){case`top`:a.push([o,s+5]),a.push([i.left,i.bottom]),a.push([i.left,i.top]),a.push([i.right,i.top]),a.push([i.right,i.bottom]);break;case`right`:a.push([o-5,s]),a.push([i.left,i.top]),a.push([i.right,i.top]),a.push([i.right,i.bottom]),a.push([i.left,i.bottom]);break;case`bottom`:a.push([o,s-5]),a.push([i.right,i.top]),a.push([i.right,i.bottom]),a.push([i.left,i.bottom]),a.push([i.left,i.top]);break;case`left`:a.push([o+5,s]),a.push([i.right,i.bottom]),a.push([i.left,i.bottom]),a.push([i.left,i.top]),a.push([i.right,i.top])}return a}function ms(e,t){return t?pn([e.clientX,e.clientY],t):!1}function hs(e){let t=fs(),r=tr(),i=ls(),a=as(),s=ss(),c=q({placement:t.orientation()===`horizontal`?`bottom-start`:`right-start`},e),[u,d]=A(c,[`open`,`defaultOpen`,`onOpenChange`]),f=0,p=null,m=`right`,[h,g]=o(),[_,v]=o(),[y,b]=o(),[x,S]=o(),[C,w]=o(!0),[E,ee]=o(d.placement),[D,O]=o([]),[k,te]=o([]),{DomCollectionProvider:j}=ur({items:k,onItemsChange:te}),M=oo({open:()=>u.open,defaultOpen:()=>u.defaultOpen,onOpenChange:e=>u.onOpenChange?.(e)}),{present:N}=mr({show:()=>t.forceMount()||M.isOpen(),element:()=>x()??null}),ne=$n({selectionMode:`none`,dataSource:k}),re=e=>{w(e),M.open()},F=(e=!1)=>{M.close(),e&&i&&i.close(!0)},I=e=>{w(e),M.toggle()},ie=()=>{let e=x();e&&(Gt(e),ne.selectionManager().setFocused(!0),ne.selectionManager().setFocusedKey(void 0))},R=()=>{s==null?ie():setTimeout(()=>ie())},ae=e=>{O(t=>[...t,e]);let t=i?.registerNestedMenu(e);return()=>{O(t=>Dt(t,e)),t?.()}},z=e=>m===p?.side&&ms(e,p?.area),oe=e=>{z(e)&&e.preventDefault()},se=e=>{z(e)||R()},ce=e=>{z(e)&&e.preventDefault()};xo({isDisabled:()=>!(i==null&&M.isOpen()&&t.isModal()),targets:()=>[x(),...D()].filter(Boolean)}),l(()=>{let e=x();if(!e||!i)return;let t=i.registerNestedMenu(e);n(()=>{t()})}),l(()=>{i===void 0&&a?.registerMenu(t.value(),[x(),...D()])}),l(()=>{i===void 0&&a!==void 0&&(a.value()===t.value()?(y()?.focus(),a.autoFocusMenu()&&re(!0)):F())}),l(()=>{i===void 0&&a!==void 0&&M.isOpen()&&a.setValue(t.value())}),n(()=>{i===void 0&&a?.unregisterMenu(t.value())});let le={dataset:B(()=>({"data-expanded":M.isOpen()?``:void 0,"data-closed":M.isOpen()?void 0:``})),isOpen:M.isOpen,contentPresent:N,nestedMenus:D,currentPlacement:E,pointerGraceTimeoutId:()=>f,autoFocus:C,listState:()=>ne,parentMenuContext:()=>i,triggerRef:y,contentRef:x,triggerId:h,contentId:_,setTriggerRef:b,setContentRef:S,open:re,close:F,toggle:I,focusContent:R,onItemEnter:oe,onItemLeave:se,onTriggerLeave:ce,setPointerDir:e=>m=e,setPointerGraceTimeoutId:e=>f=e,setPointerGraceIntent:e=>p=e,registerNestedMenu:ae,registerItemToParentDomCollection:r?.registerItem,registerTriggerId:Rr(g),registerContentId:Rr(v)};return T(j,{get children(){return T(cs.Provider,{value:le,get children(){return T(L,{when:s===void 0,get fallback(){return d.children},get children(){return T(Ya,P({anchorRef:y,contentRef:x,onCurrentPlacementChange:ee},d))}})}})}})}var gs=F();function _s(){let e=c(gs);if(e===void 0)throw Error("[kobalte]: `useMenuItemContext` must be used within a `Menu.Item` component");return e}function vs(e){let t,n=fs(),r=us(),i=q({id:n.generateId(`item-${O()}`)},e),[a,s]=A(i,[`ref`,`textValue`,`disabled`,`closeOnSelect`,`checked`,`indeterminate`,`onSelect`,`onPointerMove`,`onPointerLeave`,`onPointerDown`,`onPointerUp`,`onClick`,`onKeyDown`,`onMouseDown`,`onFocus`]),[c,l]=o(),[u,d]=o(),[f,p]=o(),m=()=>r.listState().selectionManager(),h=()=>s.id,g=()=>m().focusedKey()===h(),_=()=>{a.onSelect?.(),a.closeOnSelect&&setTimeout(()=>{r.close(!0)},1)};dr({getItem:()=>({ref:()=>t,type:`item`,key:h(),textValue:a.textValue??f()?.textContent??t?.textContent??``,disabled:a.disabled??!1})});let v=Xn({key:h,selectionManager:m,shouldSelectOnPressUp:!0,allowsDifferentPressOrigin:!0,disabled:()=>a.disabled},()=>t),y=e=>{G(e,a.onPointerMove),e.pointerType===`mouse`&&(a.disabled?r.onItemLeave(e):(r.onItemEnter(e),e.defaultPrevented||(Gt(e.currentTarget),r.listState().selectionManager().setFocused(!0),r.listState().selectionManager().setFocusedKey(h()))))},b=e=>{G(e,a.onPointerLeave),e.pointerType===`mouse`&&r.onItemLeave(e)},x=e=>{G(e,a.onPointerUp),!a.disabled&&e.button===0&&_()},S=e=>{if(G(e,a.onKeyDown),!e.repeat&&!a.disabled)switch(e.key){case`Enter`:case` `:_()}},C=B(()=>{if(a.indeterminate)return`mixed`;if(a.checked!=null)return a.checked}),w=B(()=>({"data-indeterminate":a.indeterminate?``:void 0,"data-checked":a.checked&&!a.indeterminate?``:void 0,"data-disabled":a.disabled?``:void 0,"data-highlighted":g()?``:void 0})),E={isChecked:()=>a.checked,dataset:w,setLabelRef:p,generateId:jt(()=>s.id),registerLabel:Rr(l),registerDescription:Rr(d)};return T(gs.Provider,{value:E,get children(){return T(J,P({as:`div`,ref(e){let n=ot(e=>t=e,a.ref);typeof n==`function`&&n(e)},get tabIndex(){return v.tabIndex()},get"aria-checked"(){return C()},get"aria-disabled"(){return a.disabled},get"aria-labelledby"(){return c()},get"aria-describedby"(){return u()},get"data-key"(){return v.dataKey()},get onPointerDown(){return K([a.onPointerDown,v.onPointerDown])},get onPointerUp(){return K([x,v.onPointerUp])},get onClick(){return K([a.onClick,v.onClick])},get onKeyDown(){return K([S,v.onKeyDown])},get onMouseDown(){return K([a.onMouseDown,v.onMouseDown])},get onFocus(){return K([a.onFocus,v.onFocus])},onPointerMove:y,onPointerLeave:b},w,s))}})}function ys(e){let t=q({closeOnSelect:!1},e),[n,r]=A(t,[`checked`,`defaultChecked`,`onChange`,`onSelect`]),i=zr({isSelected:()=>n.checked,defaultIsSelected:()=>n.defaultChecked,onSelectedChange:e=>n.onChange?.(e),isDisabled:()=>r.disabled});return T(vs,P({role:`menuitemcheckbox`,get checked(){return i.isSelected()},onSelect:()=>{n.onSelect?.(),i.toggle()}},r))}var bs={next:(e,t)=>e===`ltr`?t===`horizontal`?`ArrowRight`:`ArrowDown`:t===`horizontal`?`ArrowLeft`:`ArrowUp`,previous:(e,t)=>bs.next(e===`ltr`?`rtl`:`ltr`,t)},xs={first:e=>e===`horizontal`?`ArrowDown`:`ArrowRight`,last:e=>e===`horizontal`?`ArrowUp`:`ArrowLeft`};function Ss(e){let t=fs(),i=us(),a=as(),{direction:o}=Nn(),s=q({id:t.generateId(`trigger`)},e),[c,u]=A(s,[`ref`,`id`,`disabled`,`onPointerDown`,`onClick`,`onKeyDown`,`onMouseOver`,`onFocus`]),d=()=>t.value();a!==void 0&&(d=()=>t.value()??c.id,a.lastValue()===void 0&&a.setLastValue(d));let f=Mr(()=>i.triggerRef(),()=>`button`),p=B(()=>f()===`a`&&i.triggerRef()?.getAttribute(`href`)!=null);l(g(()=>a?.value(),e=>{p()&&e===d()&&i.triggerRef()?.focus()}));let m=()=>{a===void 0?i.toggle(!0):i.isOpen()?a.value()===d()&&a.closeMenu():(a.autoFocusMenu()||a.setAutoFocusMenu(!0),i.open(!1))};return l(()=>n(i.registerTriggerId(c.id))),T(Ir,P({ref(e){let t=ot(i.setTriggerRef,c.ref);typeof t==`function`&&t(e)},get"data-kb-menu-value-trigger"(){return t.value()},get id(){return c.id},get disabled(){return c.disabled},"aria-haspopup":`true`,get"aria-expanded"(){return i.isOpen()},get"aria-controls"(){return r(()=>!!i.isOpen())()?i.contentId():void 0},get"data-highlighted"(){return d()!==void 0&&a?.value()===d()||void 0},get tabIndex(){return a===void 0?void 0:a.value()===d()||a.lastValue()===d()?0:-1},onPointerDown:e=>{G(e,c.onPointerDown),e.currentTarget.dataset.pointerType=e.pointerType,!c.disabled&&e.pointerType!==`touch`&&e.button===0&&m()},onMouseOver:e=>{G(e,c.onMouseOver),i.triggerRef()?.dataset.pointerType!==`touch`&&!c.disabled&&a!==void 0&&a.value()!==void 0&&a.setValue(d)},onClick:e=>{G(e,c.onClick),c.disabled||e.currentTarget.dataset.pointerType===`touch`&&m()},onKeyDown:e=>{if(G(e,c.onKeyDown),!c.disabled){if(p())switch(e.key){case`Enter`:case` `:return}switch(e.key){case`Enter`:case` `:case xs.first(t.orientation()):e.stopPropagation(),e.preventDefault(),yn(e.currentTarget),i.open(`first`),a?.setAutoFocusMenu(!0),a?.setValue(d);break;case xs.last(t.orientation()):e.stopPropagation(),e.preventDefault(),i.open(`last`);break;case bs.next(o(),t.orientation()):if(a===void 0)break;e.stopPropagation(),e.preventDefault(),a.nextMenu();break;case bs.previous(o(),t.orientation()):if(a===void 0)break;e.stopPropagation(),e.preventDefault(),a.previousMenu()}}},onFocus:e=>{G(e,c.onFocus),a!==void 0&&e.currentTarget.dataset.pointerType!==`touch`&&a.setValue(d)},role:a===void 0?void 0:`menuitem`},()=>i.dataset(),u))}function Cs(e){let t,i=fs(),a=us(),o=as(),s=ss(),{direction:c}=Nn(),u=q({id:i.generateId(`content-${O()}`)},e),[d,f]=A(u,[`ref`,`id`,`style`,`onOpenAutoFocus`,`onCloseAutoFocus`,`onEscapeKeyDown`,`onFocusOutside`,`onPointerEnter`,`onPointerMove`,`onKeyDown`,`onMouseDown`,`onFocusIn`,`onFocusOut`]),p=0,m=()=>a.parentMenuContext()==null&&o===void 0&&i.isModal(),h=mo({selectionManager:a.listState().selectionManager,collection:a.listState().collection,autoFocus:a.autoFocus,deferAutoFocus:!0,shouldFocusWrap:!0,disallowTypeAhead:()=>!a.listState().selectionManager().isFocused(),orientation:()=>i.orientation()===`horizontal`?`vertical`:`horizontal`},()=>t);yo({trapFocus:()=>m()&&a.isOpen(),onMountAutoFocus:e=>{o===void 0&&d.onOpenAutoFocus?.(e)},onUnmountAutoFocus:d.onCloseAutoFocus},()=>t);let g=e=>{if(Mt(e.currentTarget,e.target)&&(e.key===`Tab`&&a.isOpen()&&e.preventDefault(),o!==void 0&&e.currentTarget.getAttribute(`aria-haspopup`)!==`true`))switch(e.key){case bs.next(c(),i.orientation()):e.stopPropagation(),e.preventDefault(),a.close(!0),o.setAutoFocusMenu(!0),o.nextMenu();break;case bs.previous(c(),i.orientation()):if(e.currentTarget.hasAttribute(`data-closed`))break;e.stopPropagation(),e.preventDefault(),a.close(!0),o.setAutoFocusMenu(!0),o.previousMenu()}},_=e=>{d.onEscapeKeyDown?.(e),o?.setAutoFocusMenu(!1),a.close(!0)},v=e=>{d.onFocusOutside?.(e),i.isModal()&&e.preventDefault()},y=e=>{G(e,d.onPointerEnter),a.isOpen()&&(a.parentMenuContext()?.listState().selectionManager().setFocused(!1),a.parentMenuContext()?.listState().selectionManager().setFocusedKey(void 0))},b=e=>{if(G(e,d.onPointerMove),e.pointerType!==`mouse`)return;let t=e.target,n=p!==e.clientX;Mt(e.currentTarget,t)&&n&&(a.setPointerDir(e.clientX>p?`right`:`left`),p=e.clientX)};l(()=>n(a.registerContentId(d.id))),n(()=>a.setContentRef(void 0));let x={ref:ot(e=>{a.setContentRef(e),t=e},d.ref),role:`menu`,get id(){return d.id},get tabIndex(){return h.tabIndex()},get"aria-labelledby"(){return a.triggerId()},onKeyDown:K([d.onKeyDown,h.onKeyDown,g]),onMouseDown:K([d.onMouseDown,h.onMouseDown]),onFocusIn:K([d.onFocusIn,h.onFocusIn]),onFocusOut:K([d.onFocusOut,h.onFocusOut]),onPointerEnter:y,onPointerMove:b,get"data-orientation"(){return i.orientation()}};return T(L,{get when(){return a.contentPresent()},get children(){return T(L,{get when(){return s===void 0||a.parentMenuContext()!=null},get fallback(){return T(J,P({as:`div`},()=>a.dataset(),x,f))},get children(){return T(Ya.Positioner,{get children(){return T(ao,P({get disableOutsidePointerEvents(){return r(()=>!!m())()&&a.isOpen()},get excludedElements(){return[a.triggerRef]},bypassTopMostLayerCheck:!0,get style(){return Tt({"--kb-menu-content-transform-origin":`var(--kb-popper-content-transform-origin)`,position:`relative`},d.style)},onEscapeKeyDown:_,onFocusOutside:v,get onDismiss(){return a.close}},()=>a.dataset(),x,f))}})}})}})}function ws(e){let t,n=fs(),r=us(),[i,a]=A(e,[`ref`]);return Uo({element:()=>t??null,enabled:()=>r.contentPresent()&&n.preventScroll()}),T(Cs,P({ref(e){let n=ot(e=>{t=e},i.ref);typeof n==`function`&&n(e)}},a))}var Ts=F();function Es(){let e=c(Ts);if(e===void 0)throw Error("[kobalte]: `useMenuGroupContext` must be used within a `Menu.Group` component");return e}function Ds(e){let t=q({id:fs().generateId(`group-${O()}`)},e),[n,r]=o(),i={generateId:jt(()=>t.id),registerLabelId:Rr(r)};return T(Ts.Provider,{value:i,get children(){return T(J,P({as:`div`,role:`group`,get"aria-labelledby"(){return n()}},t))}})}function Os(e){let t=Es(),r=q({id:t.generateId(`label`)},e),[i,a]=A(r,[`id`]);return l(()=>n(t.registerLabelId(i.id))),T(J,P({as:`span`,get id(){return i.id},"aria-hidden":`true`},a))}function ks(e){let t=us(),n=q({children:`▼`},e);return T(J,P({as:`span`,"aria-hidden":`true`},()=>t.dataset(),n))}function As(e){return T(vs,P({role:`menuitem`,closeOnSelect:!0},e))}function js(e){let t=_s(),r=q({id:t.generateId(`description`)},e),[i,a]=A(r,[`id`]);return l(()=>n(t.registerDescription(i.id))),T(J,P({as:`div`,get id(){return i.id}},()=>t.dataset(),a))}function Ms(e){let t=_s(),n=q({id:t.generateId(`indicator`)},e),[r,i]=A(n,[`forceMount`]);return T(L,{get when(){return r.forceMount||t.isChecked()},get children(){return T(J,P({as:`div`},()=>t.dataset(),i))}})}function Ns(e){let t=_s(),r=q({id:t.generateId(`label`)},e),[i,a]=A(r,[`ref`,`id`]);return l(()=>n(t.registerLabel(i.id))),T(J,P({as:`div`,ref(e){let n=ot(t.setLabelRef,i.ref);typeof n==`function`&&n(e)},get id(){return i.id}},()=>t.dataset(),a))}function Ps(e){let t=us();return T(L,{get when(){return t.contentPresent()},get children(){return T(_,e)}})}var Fs=F();function Is(){let e=c(Fs);if(e===void 0)throw Error("[kobalte]: `useMenuRadioGroupContext` must be used within a `Menu.RadioGroup` component");return e}function Ls(e){let t=q({id:fs().generateId(`radiogroup-${O()}`)},e),[n,r]=A(t,[`value`,`defaultValue`,`onChange`,`disabled`]),[i,a]=In({value:()=>n.value,defaultValue:()=>n.defaultValue,onChange:e=>n.onChange?.(e)});return T(Fs.Provider,{value:{isDisabled:()=>n.disabled,isSelectedValue:e=>e===i(),setSelectedValue:e=>a(e)},get children(){return T(Ds,r)}})}function Rs(e){let t=Is(),n=q({closeOnSelect:!1},e),[r,i]=A(n,[`value`,`onSelect`]);return T(vs,P({role:`menuitemradio`,get checked(){return t.isSelectedValue(r.value)},onSelect:()=>{r.onSelect?.(),t.setSelectedValue(r.value)}},i))}function zs(e){let t=as(),n=q({id:`menu-${O()}`,modal:!0},e),[r,i]=A(n,[`id`,`modal`,`preventScroll`,`forceMount`,`open`,`defaultOpen`,`onOpenChange`,`value`,`orientation`]),a=oo({open:()=>r.open,defaultOpen:()=>r.defaultOpen,onOpenChange:e=>r.onOpenChange?.(e)}),o={isModal:()=>r.modal??!0,preventScroll:()=>r.preventScroll??o.isModal(),forceMount:()=>r.forceMount??!1,generateId:jt(()=>r.id),value:()=>r.value,orientation:()=>r.orientation??t?.orientation()??`horizontal`};return T(ds.Provider,{value:o,get children(){return T(hs,P({get open(){return a.isOpen()},get onOpenChange(){return a.setIsOpen}},i))}})}function Bs(e){let{direction:t}=Nn();return T(hs,P({get placement(){return t()===`rtl`?`left-start`:`right-start`},flip:!0},e))}var Vs={close:(e,t)=>e===`ltr`?[t===`horizontal`?`ArrowLeft`:`ArrowUp`]:[t===`horizontal`?`ArrowRight`:`ArrowDown`]};function Hs(e){let t=us(),n=fs(),[r,i]=A(e,[`onFocusOutside`,`onKeyDown`]),{direction:a}=Nn();return T(Cs,P({onOpenAutoFocus:e=>{e.preventDefault()},onCloseAutoFocus:e=>{e.preventDefault()},onFocusOutside:e=>{r.onFocusOutside?.(e);let n=e.target;Mt(t.triggerRef(),n)||t.close()},onKeyDown:e=>{G(e,r.onKeyDown);let i=Mt(e.currentTarget,e.target),o=Vs.close(a(),n.orientation()).includes(e.key),s=t.parentMenuContext()!=null;i&&o&&s&&(t.close(),Gt(t.triggerRef()))}},i))}var Us=[`Enter`,` `],Ws={open:(e,t)=>e===`ltr`?[...Us,t===`horizontal`?`ArrowRight`:`ArrowDown`]:[...Us,t===`horizontal`?`ArrowLeft`:`ArrowUp`]};function Gs(e){let t,i=fs(),a=us(),o=q({id:i.generateId(`sub-trigger-${O()}`)},e),[s,c]=A(o,[`ref`,`id`,`textValue`,`disabled`,`onPointerMove`,`onPointerLeave`,`onPointerDown`,`onPointerUp`,`onClick`,`onKeyDown`,`onMouseDown`,`onFocus`]),u=null,d=()=>{u&&window.clearTimeout(u),u=null},{direction:f}=Nn(),p=()=>s.id,m=()=>{let e=a.parentMenuContext();if(e==null)throw Error("[kobalte]: `Menu.SubTrigger` must be used within a `Menu.Sub` component");return e.listState().selectionManager()},h=()=>a.listState().collection(),_=()=>m().focusedKey()===p(),v=Xn({key:p,selectionManager:m,shouldSelectOnPressUp:!0,allowsDifferentPressOrigin:!0,disabled:()=>s.disabled},()=>t),y=e=>{G(e,s.onClick),!a.isOpen()&&!s.disabled&&a.open(!0)},b=e=>{if(G(e,s.onPointerMove),e.pointerType!==`mouse`)return;let t=a.parentMenuContext();t?.onItemEnter(e),!e.defaultPrevented&&(s.disabled?t?.onItemLeave(e):(!a.isOpen()&&!u&&(a.parentMenuContext()?.setPointerGraceIntent(null),u=window.setTimeout(()=>{a.open(!1),d()},100)),t?.onItemEnter(e),e.defaultPrevented||(a.listState().selectionManager().isFocused()&&(a.listState().selectionManager().setFocused(!1),a.listState().selectionManager().setFocusedKey(void 0)),Gt(e.currentTarget),t?.listState().selectionManager().setFocused(!0),t?.listState().selectionManager().setFocusedKey(p()))))},x=e=>{if(G(e,s.onPointerLeave),e.pointerType!==`mouse`)return;d();let t=a.parentMenuContext(),n=a.contentRef();if(n){t?.setPointerGraceIntent({area:ps(a.currentPlacement(),e,n),side:a.currentPlacement().split(`-`)[0]}),window.clearTimeout(t?.pointerGraceTimeoutId());let r=window.setTimeout(()=>{t?.setPointerGraceIntent(null)},300);t?.setPointerGraceTimeoutId(r)}else{if(t?.onTriggerLeave(e),e.defaultPrevented)return;t?.setPointerGraceIntent(null)}t?.onItemLeave(e)},S=e=>{G(e,s.onKeyDown),e.repeat||s.disabled||Ws.open(f(),i.orientation()).includes(e.key)&&(e.stopPropagation(),e.preventDefault(),m().setFocused(!1),m().setFocusedKey(void 0),a.isOpen()||a.open(`first`),a.focusContent(),a.listState().selectionManager().setFocused(!0),a.listState().selectionManager().setFocusedKey(h().getFirstKey()))};return l(()=>{if(a.registerItemToParentDomCollection==null)throw Error("[kobalte]: `Menu.SubTrigger` must be used within a `Menu.Sub` component");let e=a.registerItemToParentDomCollection({ref:()=>t,type:`item`,key:p(),textValue:s.textValue??t?.textContent??``,disabled:s.disabled??!1});n(e)}),l(g(()=>a.parentMenuContext()?.pointerGraceTimeoutId(),e=>{n(()=>{window.clearTimeout(e),a.parentMenuContext()?.setPointerGraceIntent(null)})})),l(()=>n(a.registerTriggerId(s.id))),n(()=>{d()}),T(J,P({as:`div`,ref(e){let n=ot(e=>{a.setTriggerRef(e),t=e},s.ref);typeof n==`function`&&n(e)},get id(){return s.id},role:`menuitem`,get tabIndex(){return v.tabIndex()},"aria-haspopup":`true`,get"aria-expanded"(){return a.isOpen()},get"aria-controls"(){return r(()=>!!a.isOpen())()?a.contentId():void 0},get"aria-disabled"(){return s.disabled},get"data-key"(){return v.dataKey()},get"data-highlighted"(){return _()?``:void 0},get"data-disabled"(){return s.disabled?``:void 0},get onPointerDown(){return K([s.onPointerDown,v.onPointerDown])},get onPointerUp(){return K([s.onPointerUp,v.onPointerUp])},get onClick(){return K([y,v.onClick])},get onKeyDown(){return K([S,v.onKeyDown])},get onMouseDown(){return K([s.onMouseDown,v.onMouseDown])},get onFocus(){return K([s.onFocus,v.onFocus])},onPointerMove:b,onPointerLeave:x},()=>a.dataset(),c))}pr({},{Root:()=>Ks,Separator:()=>qs});function Ks(e){let t,n=q({orientation:`horizontal`},e),[r,i]=A(n,[`ref`,`orientation`]),a=Mr(()=>t,()=>`hr`);return T(J,P({as:`hr`,ref(e){let n=ot(e=>t=e,r.ref);typeof n==`function`&&n(e)},get role(){return a()===`hr`?void 0:`separator`},get"aria-orientation"(){return r.orientation===`vertical`?`vertical`:void 0},get"data-orientation"(){return r.orientation}},i))}var qs=Ks,X={};pr(X,{Arrow:()=>Ba,CheckboxItem:()=>ys,Content:()=>Js,DropdownMenu:()=>Xs,Group:()=>Ds,GroupLabel:()=>Os,Icon:()=>ks,Item:()=>As,ItemDescription:()=>js,ItemIndicator:()=>Ms,ItemLabel:()=>Ns,Portal:()=>Ps,RadioGroup:()=>Ls,RadioItem:()=>Rs,Root:()=>Ys,Separator:()=>Ks,Sub:()=>Bs,SubContent:()=>Hs,SubTrigger:()=>Gs,Trigger:()=>Ss});function Js(e){let t=fs(),n=us(),[r,i]=A(e,[`onCloseAutoFocus`,`onInteractOutside`]),a=!1;return T(ws,P({onCloseAutoFocus:e=>{r.onCloseAutoFocus?.(e),a||Gt(n.triggerRef()),a=!1,e.preventDefault()},onInteractOutside:e=>{r.onInteractOutside?.(e),(!t.isModal()||e.detail.isContextMenu)&&(a=!0)}},i))}function Ys(e){let t=q({id:`dropdownmenu-${O()}`},e);return T(zs,t)}var Xs=Object.assign(Ys,{Arrow:Ba,CheckboxItem:ys,Content:Js,Group:Ds,GroupLabel:Os,Icon:ks,Item:As,ItemDescription:js,ItemIndicator:Ms,ItemLabel:Ns,Portal:Ps,RadioGroup:Ls,RadioItem:Rs,Separator:Ks,Sub:Bs,SubContent:Hs,SubTrigger:Gs,Trigger:Ss}),Z={colors:{inherit:`inherit`,current:`currentColor`,transparent:`transparent`,black:`#000000`,white:`#ffffff`,neutral:{50:`#f9fafb`,100:`#f2f4f7`,200:`#eaecf0`,300:`#d0d5dd`,400:`#98a2b3`,500:`#667085`,600:`#475467`,700:`#344054`,800:`#1d2939`,900:`#101828`},darkGray:{50:`#525c7a`,100:`#49536e`,200:`#414962`,300:`#394056`,400:`#313749`,500:`#292e3d`,600:`#212530`,700:`#191c24`,800:`#111318`,900:`#0b0d10`},gray:{50:`#f9fafb`,100:`#f2f4f7`,200:`#eaecf0`,300:`#d0d5dd`,400:`#98a2b3`,500:`#667085`,600:`#475467`,700:`#344054`,800:`#1d2939`,900:`#101828`},blue:{25:`#F5FAFF`,50:`#EFF8FF`,100:`#D1E9FF`,200:`#B2DDFF`,300:`#84CAFF`,400:`#53B1FD`,500:`#2E90FA`,600:`#1570EF`,700:`#175CD3`,800:`#1849A9`,900:`#194185`},green:{25:`#F6FEF9`,50:`#ECFDF3`,100:`#D1FADF`,200:`#A6F4C5`,300:`#6CE9A6`,400:`#32D583`,500:`#12B76A`,600:`#039855`,700:`#027A48`,800:`#05603A`,900:`#054F31`},red:{50:`#fef2f2`,100:`#fee2e2`,200:`#fecaca`,300:`#fca5a5`,400:`#f87171`,500:`#ef4444`,600:`#dc2626`,700:`#b91c1c`,800:`#991b1b`,900:`#7f1d1d`,950:`#450a0a`},yellow:{25:`#FFFCF5`,50:`#FFFAEB`,100:`#FEF0C7`,200:`#FEDF89`,300:`#FEC84B`,400:`#FDB022`,500:`#F79009`,600:`#DC6803`,700:`#B54708`,800:`#93370D`,900:`#7A2E0E`},purple:{25:`#FAFAFF`,50:`#F4F3FF`,100:`#EBE9FE`,200:`#D9D6FE`,300:`#BDB4FE`,400:`#9B8AFB`,500:`#7A5AF8`,600:`#6938EF`,700:`#5925DC`,800:`#4A1FB8`,900:`#3E1C96`},teal:{25:`#F6FEFC`,50:`#F0FDF9`,100:`#CCFBEF`,200:`#99F6E0`,300:`#5FE9D0`,400:`#2ED3B7`,500:`#15B79E`,600:`#0E9384`,700:`#107569`,800:`#125D56`,900:`#134E48`},pink:{25:`#fdf2f8`,50:`#fce7f3`,100:`#fbcfe8`,200:`#f9a8d4`,300:`#f472b6`,400:`#ec4899`,500:`#db2777`,600:`#be185d`,700:`#9d174d`,800:`#831843`,900:`#500724`},cyan:{25:`#ecfeff`,50:`#cffafe`,100:`#a5f3fc`,200:`#67e8f9`,300:`#22d3ee`,400:`#06b6d4`,500:`#0891b2`,600:`#0e7490`,700:`#155e75`,800:`#164e63`,900:`#083344`}},alpha:{100:`ff`,90:`e5`,80:`cc`,70:`b3`,60:`99`,50:`80`,40:`66`,30:`4d`,20:`33`,10:`1a`,0:`00`},font:{size:{"2xs":`calc(var(--tsqd-font-size) * 0.625)`,xs:`calc(var(--tsqd-font-size) * 0.75)`,sm:`calc(var(--tsqd-font-size) * 0.875)`,md:`var(--tsqd-font-size)`,lg:`calc(var(--tsqd-font-size) * 1.125)`,xl:`calc(var(--tsqd-font-size) * 1.25)`,"2xl":`calc(var(--tsqd-font-size) * 1.5)`,"3xl":`calc(var(--tsqd-font-size) * 1.875)`,"4xl":`calc(var(--tsqd-font-size) * 2.25)`,"5xl":`calc(var(--tsqd-font-size) * 3)`,"6xl":`calc(var(--tsqd-font-size) * 3.75)`,"7xl":`calc(var(--tsqd-font-size) * 4.5)`,"8xl":`calc(var(--tsqd-font-size) * 6)`,"9xl":`calc(var(--tsqd-font-size) * 8)`},lineHeight:{xs:`calc(var(--tsqd-font-size) * 1)`,sm:`calc(var(--tsqd-font-size) * 1.25)`,md:`calc(var(--tsqd-font-size) * 1.5)`,lg:`calc(var(--tsqd-font-size) * 1.75)`,xl:`calc(var(--tsqd-font-size) * 2)`,"2xl":`calc(var(--tsqd-font-size) * 2.25)`,"3xl":`calc(var(--tsqd-font-size) * 2.5)`,"4xl":`calc(var(--tsqd-font-size) * 2.75)`,"5xl":`calc(var(--tsqd-font-size) * 3)`,"6xl":`calc(var(--tsqd-font-size) * 3.25)`,"7xl":`calc(var(--tsqd-font-size) * 3.5)`,"8xl":`calc(var(--tsqd-font-size) * 3.75)`,"9xl":`calc(var(--tsqd-font-size) * 4)`},weight:{thin:`100`,extralight:`200`,light:`300`,normal:`400`,medium:`500`,semibold:`600`,bold:`700`,extrabold:`800`,black:`900`}},breakpoints:{xs:`320px`,sm:`640px`,md:`768px`,lg:`1024px`,xl:`1280px`,"2xl":`1536px`},border:{radius:{none:`0px`,xs:`calc(var(--tsqd-font-size) * 0.125)`,sm:`calc(var(--tsqd-font-size) * 0.25)`,md:`calc(var(--tsqd-font-size) * 0.375)`,lg:`calc(var(--tsqd-font-size) * 0.5)`,xl:`calc(var(--tsqd-font-size) * 0.75)`,"2xl":`calc(var(--tsqd-font-size) * 1)`,"3xl":`calc(var(--tsqd-font-size) * 1.5)`,full:`9999px`}},size:{0:`0px`,.25:`calc(var(--tsqd-font-size) * 0.0625)`,.5:`calc(var(--tsqd-font-size) * 0.125)`,1:`calc(var(--tsqd-font-size) * 0.25)`,1.5:`calc(var(--tsqd-font-size) * 0.375)`,2:`calc(var(--tsqd-font-size) * 0.5)`,2.5:`calc(var(--tsqd-font-size) * 0.625)`,3:`calc(var(--tsqd-font-size) * 0.75)`,3.5:`calc(var(--tsqd-font-size) * 0.875)`,4:`calc(var(--tsqd-font-size) * 1)`,4.5:`calc(var(--tsqd-font-size) * 1.125)`,5:`calc(var(--tsqd-font-size) * 1.25)`,5.5:`calc(var(--tsqd-font-size) * 1.375)`,6:`calc(var(--tsqd-font-size) * 1.5)`,6.5:`calc(var(--tsqd-font-size) * 1.625)`,7:`calc(var(--tsqd-font-size) * 1.75)`,8:`calc(var(--tsqd-font-size) * 2)`,9:`calc(var(--tsqd-font-size) * 2.25)`,10:`calc(var(--tsqd-font-size) * 2.5)`,11:`calc(var(--tsqd-font-size) * 2.75)`,12:`calc(var(--tsqd-font-size) * 3)`,14:`calc(var(--tsqd-font-size) * 3.5)`,16:`calc(var(--tsqd-font-size) * 4)`,20:`calc(var(--tsqd-font-size) * 5)`,24:`calc(var(--tsqd-font-size) * 6)`,28:`calc(var(--tsqd-font-size) * 7)`,32:`calc(var(--tsqd-font-size) * 8)`,36:`calc(var(--tsqd-font-size) * 9)`,40:`calc(var(--tsqd-font-size) * 10)`,44:`calc(var(--tsqd-font-size) * 11)`,48:`calc(var(--tsqd-font-size) * 12)`,52:`calc(var(--tsqd-font-size) * 13)`,56:`calc(var(--tsqd-font-size) * 14)`,60:`calc(var(--tsqd-font-size) * 15)`,64:`calc(var(--tsqd-font-size) * 16)`,72:`calc(var(--tsqd-font-size) * 18)`,80:`calc(var(--tsqd-font-size) * 20)`,96:`calc(var(--tsqd-font-size) * 24)`},shadow:{xs:(e=`rgb(0 0 0 / 0.1)`)=>`0 1px 2px 0 rgb(0 0 0 / 0.05)`,sm:(e=`rgb(0 0 0 / 0.1)`)=>`0 1px 3px 0 ${e}, 0 1px 2px -1px ${e}`,md:(e=`rgb(0 0 0 / 0.1)`)=>`0 4px 6px -1px ${e}, 0 2px 4px -2px ${e}`,lg:(e=`rgb(0 0 0 / 0.1)`)=>`0 10px 15px -3px ${e}, 0 4px 6px -4px ${e}`,xl:(e=`rgb(0 0 0 / 0.1)`)=>`0 20px 25px -5px ${e}, 0 8px 10px -6px ${e}`,"2xl":(e=`rgb(0 0 0 / 0.25)`)=>`0 25px 50px -12px ${e}`,inner:(e=`rgb(0 0 0 / 0.05)`)=>`inset 0 2px 4px 0 ${e}`,none:()=>`none`},zIndices:{hide:-1,auto:`auto`,base:0,docked:10,dropdown:1e3,sticky:1100,banner:1200,overlay:1300,modal:1400,popover:1500,skipLink:1600,toast:1700,tooltip:1800}},Zs=p(`<svg width=14 height=14 viewBox="0 0 14 14"fill=none xmlns=http://www.w3.org/2000/svg><path d="M13 13L9.00007 9M10.3333 5.66667C10.3333 8.244 8.244 10.3333 5.66667 10.3333C3.08934 10.3333 1 8.244 1 5.66667C1 3.08934 3.08934 1 5.66667 1C8.244 1 10.3333 3.08934 10.3333 5.66667Z"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>`),Qs=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9 3H15M3 6H21M19 6L18.2987 16.5193C18.1935 18.0975 18.1409 18.8867 17.8 19.485C17.4999 20.0118 17.0472 20.4353 16.5017 20.6997C15.882 21 15.0911 21 13.5093 21H10.4907C8.90891 21 8.11803 21 7.49834 20.6997C6.95276 20.4353 6.50009 20.0118 6.19998 19.485C5.85911 18.8867 5.8065 18.0975 5.70129 16.5193L5 6M10 10.5V15.5M14 10.5V15.5"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),$s=p(`<svg width=10 height=6 viewBox="0 0 10 6"fill=none xmlns=http://www.w3.org/2000/svg><path d="M1 1L5 5L9 1"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>`),ec=p(`<svg width=12 height=12 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg><path d="M8 13.3333V2.66667M8 2.66667L4 6.66667M8 2.66667L12 6.66667"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>`),tc=p(`<svg width=12 height=12 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg><path d="M8 2.66667V13.3333M8 13.3333L4 9.33333M8 13.3333L12 9.33333"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>`),nc=p(`<svg width=12 height=12 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg style=transform:rotate(90deg)><path d="M8 2.66667V13.3333M8 13.3333L4 9.33333M8 13.3333L12 9.33333"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>`),rc=p(`<svg width=12 height=12 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg style=transform:rotate(-90deg)><path d="M8 2.66667V13.3333M8 13.3333L4 9.33333M8 13.3333L12 9.33333"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>`),ic=p(`<svg viewBox="0 0 24 24"height=12 width=12 fill=none xmlns=http://www.w3.org/2000/svg><path d="M12 2v2m0 16v2M4 12H2m4.314-5.686L4.9 4.9m12.786 1.414L19.1 4.9M6.314 17.69 4.9 19.104m12.786-1.414 1.414 1.414M22 12h-2m-3 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),ac=p(`<svg viewBox="0 0 24 24"height=12 width=12 fill=none xmlns=http://www.w3.org/2000/svg><path d="M22 15.844a10.424 10.424 0 0 1-4.306.925c-5.779 0-10.463-4.684-10.463-10.462 0-1.536.33-2.994.925-4.307A10.464 10.464 0 0 0 2 11.538C2 17.316 6.684 22 12.462 22c4.243 0 7.896-2.526 9.538-6.156Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),oc=p(`<svg viewBox="0 0 24 24"height=12 width=12 fill=none xmlns=http://www.w3.org/2000/svg><path d="M8 21h8m-4-4v4m-5.2-4h10.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C22 14.72 22 13.88 22 12.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C19.72 3 18.88 3 17.2 3H6.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C2 5.28 2 6.12 2 7.8v4.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C4.28 17 5.12 17 6.8 17Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),sc=p(`<svg stroke=currentColor fill=currentColor stroke-width=0 viewBox="0 0 24 24"height=1em width=1em xmlns=http://www.w3.org/2000/svg><path fill=none d="M0 0h24v24H0z"></path><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z">`),cc=p(`<svg stroke-width=0 viewBox="0 0 24 24"height=1em width=1em xmlns=http://www.w3.org/2000/svg><path fill=none d="M24 .01c0-.01 0-.01 0 0L0 0v24h24V.01zM0 0h24v24H0V0zm0 0h24v24H0V0z"></path><path d="M22.99 9C19.15 5.16 13.8 3.76 8.84 4.78l2.52 2.52c3.47-.17 6.99 1.05 9.63 3.7l2-2zm-4 4a9.793 9.793 0 00-4.49-2.56l3.53 3.53.96-.97zM2 3.05L5.07 6.1C3.6 6.82 2.22 7.78 1 9l1.99 2c1.24-1.24 2.67-2.16 4.2-2.77l2.24 2.24A9.684 9.684 0 005 13v.01L6.99 15a7.042 7.042 0 014.92-2.06L18.98 20l1.27-1.26L3.29 1.79 2 3.05zM9 17l3 3 3-3a4.237 4.237 0 00-6 0z">`),lc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9.3951 19.3711L9.97955 20.6856C10.1533 21.0768 10.4368 21.4093 10.7958 21.6426C11.1547 21.8759 11.5737 22.0001 12.0018 22C12.4299 22.0001 12.8488 21.8759 13.2078 21.6426C13.5667 21.4093 13.8503 21.0768 14.024 20.6856L14.6084 19.3711C14.8165 18.9047 15.1664 18.5159 15.6084 18.26C16.0532 18.0034 16.5678 17.8941 17.0784 17.9478L18.5084 18.1C18.9341 18.145 19.3637 18.0656 19.7451 17.8713C20.1265 17.6771 20.4434 17.3763 20.6573 17.0056C20.8715 16.635 20.9735 16.2103 20.9511 15.7829C20.9286 15.3555 20.7825 14.9438 20.5307 14.5978L19.684 13.4344C19.3825 13.0171 19.2214 12.5148 19.224 12C19.2239 11.4866 19.3865 10.9864 19.6884 10.5711L20.5351 9.40778C20.787 9.06175 20.933 8.65007 20.9555 8.22267C20.978 7.79528 20.8759 7.37054 20.6618 7C20.4479 6.62923 20.131 6.32849 19.7496 6.13423C19.3681 5.93997 18.9386 5.86053 18.5129 5.90556L17.0829 6.05778C16.5722 6.11141 16.0577 6.00212 15.6129 5.74556C15.17 5.48825 14.82 5.09736 14.6129 4.62889L14.024 3.31444C13.8503 2.92317 13.5667 2.59072 13.2078 2.3574C12.8488 2.12408 12.4299 1.99993 12.0018 2C11.5737 1.99993 11.1547 2.12408 10.7958 2.3574C10.4368 2.59072 10.1533 2.92317 9.97955 3.31444L9.3951 4.62889C9.18803 5.09736 8.83798 5.48825 8.3951 5.74556C7.95032 6.00212 7.43577 6.11141 6.9251 6.05778L5.49066 5.90556C5.06499 5.86053 4.6354 5.93997 4.25397 6.13423C3.87255 6.32849 3.55567 6.62923 3.34177 7C3.12759 7.37054 3.02555 7.79528 3.04804 8.22267C3.07052 8.65007 3.21656 9.06175 3.46844 9.40778L4.3151 10.5711C4.61704 10.9864 4.77964 11.4866 4.77955 12C4.77964 12.5134 4.61704 13.0137 4.3151 13.4289L3.46844 14.5922C3.21656 14.9382 3.07052 15.3499 3.04804 15.7773C3.02555 16.2047 3.12759 16.6295 3.34177 17C3.55589 17.3706 3.8728 17.6712 4.25417 17.8654C4.63554 18.0596 5.06502 18.1392 5.49066 18.0944L6.92066 17.9422C7.43133 17.8886 7.94587 17.9979 8.39066 18.2544C8.83519 18.511 9.18687 18.902 9.3951 19.3711Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round></path><path d="M12 15C13.6568 15 15 13.6569 15 12C15 10.3431 13.6568 9 12 9C10.3431 9 8.99998 10.3431 8.99998 12C8.99998 13.6569 10.3431 15 12 15Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),uc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M16 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V8M11.5 12.5L17 7M17 7H12M17 7V12M6.2 21H8.8C9.9201 21 10.4802 21 10.908 20.782C11.2843 20.5903 11.5903 20.2843 11.782 19.908C12 19.4802 12 18.9201 12 17.8V15.2C12 14.0799 12 13.5198 11.782 13.092C11.5903 12.7157 11.2843 12.4097 10.908 12.218C10.4802 12 9.92011 12 8.8 12H6.2C5.0799 12 4.51984 12 4.09202 12.218C3.71569 12.4097 3.40973 12.7157 3.21799 13.092C3 13.5198 3 14.0799 3 15.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),dc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path class=copier d="M8 8V5.2C8 4.0799 8 3.51984 8.21799 3.09202C8.40973 2.71569 8.71569 2.40973 9.09202 2.21799C9.51984 2 10.0799 2 11.2 2H18.8C19.9201 2 20.4802 2 20.908 2.21799C21.2843 2.40973 21.5903 2.71569 21.782 3.09202C22 3.51984 22 4.0799 22 5.2V12.8C22 13.9201 22 14.4802 21.782 14.908C21.5903 15.2843 21.2843 15.5903 20.908 15.782C20.4802 16 19.9201 16 18.8 16H16M5.2 22H12.8C13.9201 22 14.4802 22 14.908 21.782C15.2843 21.5903 15.5903 21.2843 15.782 20.908C16 20.4802 16 19.9201 16 18.8V11.2C16 10.0799 16 9.51984 15.782 9.09202C15.5903 8.71569 15.2843 8.40973 14.908 8.21799C14.4802 8 13.9201 8 12.8 8H5.2C4.0799 8 3.51984 8 3.09202 8.21799C2.71569 8.40973 2.40973 8.71569 2.21799 9.09202C2 9.51984 2 10.0799 2 11.2V18.8C2 19.9201 2 20.4802 2.21799 20.908C2.40973 21.2843 2.71569 21.5903 3.09202 21.782C3.51984 22 4.07989 22 5.2 22Z"stroke-width=2 stroke-linecap=round stroke-linejoin=round stroke=currentColor>`),fc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M2.5 21.4998L8.04927 19.3655C8.40421 19.229 8.58168 19.1607 8.74772 19.0716C8.8952 18.9924 9.0358 18.901 9.16804 18.7984C9.31692 18.6829 9.45137 18.5484 9.72028 18.2795L21 6.99982C22.1046 5.89525 22.1046 4.10438 21 2.99981C19.8955 1.89525 18.1046 1.89524 17 2.99981L5.72028 14.2795C5.45138 14.5484 5.31692 14.6829 5.20139 14.8318C5.09877 14.964 5.0074 15.1046 4.92823 15.2521C4.83911 15.4181 4.77085 15.5956 4.63433 15.9506L2.5 21.4998ZM2.5 21.4998L4.55812 16.1488C4.7054 15.7659 4.77903 15.5744 4.90534 15.4867C5.01572 15.4101 5.1523 15.3811 5.2843 15.4063C5.43533 15.4351 5.58038 15.5802 5.87048 15.8703L8.12957 18.1294C8.41967 18.4195 8.56472 18.5645 8.59356 18.7155C8.61877 18.8475 8.58979 18.9841 8.51314 19.0945C8.42545 19.2208 8.23399 19.2944 7.85107 19.4417L2.5 21.4998Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),pc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M7.5 12L10.5 15L16.5 9M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),mc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9 9L15 15M15 9L9 15M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"stroke=#F04438 stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),hc=p(`<svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 xmlns=http://www.w3.org/2000/svg><rect class=list width=20 height=20 y=2 x=2 rx=2></rect><line class=list-item y1=7 y2=7 x1=6 x2=18></line><line class=list-item y2=12 y1=12 x1=6 x2=18></line><line class=list-item y1=17 y2=17 x1=6 x2=18>`),gc=p(`<svg viewBox="0 0 24 24"height=20 width=20 fill=none xmlns=http://www.w3.org/2000/svg><path d="M3 7.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C5.28 3 6.12 3 7.8 3h8.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C21 5.28 21 6.12 21 7.8v8.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C18.72 21 17.88 21 16.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V7.8Z"stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),_c=p(`<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M7.5 12L10.5 15L16.5 9M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),vc=p(`<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.0784 19.0784L16.25 16.25M19.0784 4.99994L16.25 7.82837M4.92157 19.0784L7.75 16.25M4.92157 4.99994L7.75 7.82837"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round></path><animateTransform attributeName=transform attributeType=XML type=rotate from=0 to=360 dur=2s repeatCount=indefinite>`),yc=p(`<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M15 9L9 15M9 9L15 15M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),bc=p(`<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9.5 15V9M14.5 15V9M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),xc=p(`<svg version=1.0 viewBox="0 0 633 633"><linearGradient x1=-666.45 x2=-666.45 y1=163.28 y2=163.99 gradientTransform="matrix(633 0 0 633 422177 -103358)"gradientUnits=userSpaceOnUse><stop stop-color=#6BDAFF offset=0></stop><stop stop-color=#F9FFB5 offset=.32></stop><stop stop-color=#FFA770 offset=.71></stop><stop stop-color=#FF7373 offset=1></stop></linearGradient><circle cx=316.5 cy=316.5 r=316.5></circle><defs><filter x=-137.5 y=412 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=-137.5 y=412 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=89.5 cy=610.5 rx=214.5 ry=186 fill=#015064 stroke=#00CFE2 stroke-width=25></ellipse></g><defs><filter x=316.5 y=412 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=316.5 y=412 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=543.5 cy=610.5 rx=214.5 ry=186 fill=#015064 stroke=#00CFE2 stroke-width=25></ellipse></g><defs><filter x=-137.5 y=450 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=-137.5 y=450 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=89.5 cy=648.5 rx=214.5 ry=186 fill=#015064 stroke=#00A8B8 stroke-width=25></ellipse></g><defs><filter x=316.5 y=450 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=316.5 y=450 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=543.5 cy=648.5 rx=214.5 ry=186 fill=#015064 stroke=#00A8B8 stroke-width=25></ellipse></g><defs><filter x=-137.5 y=486 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=-137.5 y=486 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=89.5 cy=684.5 rx=214.5 ry=186 fill=#015064 stroke=#007782 stroke-width=25></ellipse></g><defs><filter x=316.5 y=486 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=316.5 y=486 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=543.5 cy=684.5 rx=214.5 ry=186 fill=#015064 stroke=#007782 stroke-width=25></ellipse></g><defs><filter x=272.2 y=308 width=176.9 height=129.3 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=272.2 y=308 width=176.9 height=129.3 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><line x1=436 x2=431 y1=403.2 y2=431.8 fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11></line><line x1=291 x2=280 y1=341.5 y2=403.5 fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11></line><line x1=332.9 x2=328.6 y1=384.1 y2=411.2 fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11></line><linearGradient x1=-670.75 x2=-671.59 y1=164.4 y2=164.49 gradientTransform="matrix(-184.16 -32.472 -11.461 64.997 -121359 -32126)"gradientUnits=userSpaceOnUse><stop stop-color=#EE2700 offset=0></stop><stop stop-color=#FF008E offset=1></stop></linearGradient><path d="m344.1 363 97.7 17.2c5.8 2.1 8.2 6.1 7.1 12.1s-4.7 9.2-11 9.9l-106-18.7-57.5-59.2c-3.2-4.8-2.9-9.1 0.8-12.8s8.3-4.4 13.7-2.1l55.2 53.6z"clip-rule=evenodd fill-rule=evenodd></path><line x1=428.2 x2=429.1 y1=384.5 y2=378 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=395.2 x2=396.1 y1=379.5 y2=373 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=362.2 x2=363.1 y1=373.5 y2=367.4 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=324.2 x2=328.4 y1=351.3 y2=347.4 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=303.2 x2=307.4 y1=331.3 y2=327.4 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line></g><defs><filter x=73.2 y=113.8 width=280.6 height=317.4 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=73.2 y=113.8 width=280.6 height=317.4 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><linearGradient x1=-672.16 x2=-672.16 y1=165.03 y2=166.03 gradientTransform="matrix(-100.18 48.861 97.976 200.88 -83342 -93.059)"gradientUnits=userSpaceOnUse><stop stop-color=#A17500 offset=0></stop><stop stop-color=#5D2100 offset=1></stop></linearGradient><path d="m192.3 203c8.1 37.3 14 73.6 17.8 109.1 3.8 35.4 2.8 75.1-3 119.2l61.2-16.7c-15.6-59-25.2-97.9-28.6-116.6s-10.8-51.9-22.1-99.6l-25.3 4.6"clip-rule=evenodd fill-rule=evenodd></path><g stroke=#2F8A00><linearGradient x1=-660.23 x2=-660.23 y1=166.72 y2=167.72 gradientTransform="matrix(92.683 4.8573 -2.0259 38.657 61680 -3088.6)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m195 183.9s-12.6-22.1-36.5-29.9c-15.9-5.2-34.4-1.5-55.5 11.1 15.9 14.3 29.5 22.6 40.7 24.9 16.8 3.6 51.3-6.1 51.3-6.1z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-661.36 x2=-661.36 y1=164.18 y2=165.18 gradientTransform="matrix(110 5.7648 -6.3599 121.35 73933 -15933)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5s-47.5-8.5-83.2 15.7c-23.8 16.2-34.3 49.3-31.6 99.4 30.3-27.8 52.1-48.5 65.2-61.9 19.8-20.2 49.6-53.2 49.6-53.2z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-656.79 x2=-656.79 y1=165.15 y2=166.15 gradientTransform="matrix(62.954 3.2993 -3.5023 66.828 42156 -8754.1)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m195 183.9c-0.8-21.9 6-38 20.6-48.2s29.8-15.4 45.5-15.3c-6.1 21.4-14.5 35.8-25.2 43.4s-24.4 14.2-40.9 20.1z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-663.07 x2=-663.07 y1=165.44 y2=166.44 gradientTransform="matrix(152.47 7.9907 -3.0936 59.029 101884 -4318.7)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5c31.9-30 64.1-39.7 96.7-29s50.8 30.4 54.6 59.1c-35.2-5.5-60.4-9.6-75.8-12.1-15.3-2.6-40.5-8.6-75.5-18z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-662.57 x2=-662.57 y1=164.44 y2=165.44 gradientTransform="matrix(136.46 7.1517 -5.2163 99.533 91536 -11442)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5c35.8-7.6 65.6-0.2 89.2 22s37.7 49 42.3 80.3c-39.8-9.7-68.3-23.8-85.5-42.4s-32.5-38.5-46-59.9z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-656.43 x2=-656.43 y1=163.86 y2=164.86 gradientTransform="matrix(60.866 3.1899 -8.7773 167.48 41560 -25168)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5c-33.6 13.8-53.6 35.7-60.1 65.6s-3.6 63.1 8.7 99.6c27.4-40.3 43.2-69.6 47.4-88s5.6-44.1 4-77.2z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><path d="m196.5 182.3c-14.8 21.6-25.1 41.4-30.8 59.4s-9.5 33-11.1 45.1"fill=none stroke-linecap=round stroke-width=8></path><path d="m194.9 185.7c-24.4 1.7-43.8 9-58.1 21.8s-24.7 25.4-31.3 37.8"fill=none stroke-linecap=round stroke-width=8></path><path d="m204.5 176.4c29.7-6.7 52-8.4 67-5.1s26.9 8.6 35.8 15.9"fill=none stroke-linecap=round stroke-width=8></path><path d="m196.5 181.4c20.3 9.9 38.2 20.5 53.9 31.9s27.4 22.1 35.1 32"fill=none stroke-linecap=round stroke-width=8></path></g></g><defs><filter x=50.5 y=399 width=532 height=633 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=50.5 y=399 width=532 height=633 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><linearGradient x1=-666.06 x2=-666.23 y1=163.36 y2=163.75 gradientTransform="matrix(532 0 0 633 354760 -102959)"gradientUnits=userSpaceOnUse><stop stop-color=#FFF400 offset=0></stop><stop stop-color=#3C8700 offset=1></stop></linearGradient><ellipse cx=316.5 cy=715.5 rx=266 ry=316.5></ellipse></g><defs><filter x=391 y=-24 width=288 height=283 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=391 y=-24 width=288 height=283 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><linearGradient x1=-664.56 x2=-664.56 y1=163.79 y2=164.79 gradientTransform="matrix(227 0 0 227 151421 -37204)"gradientUnits=userSpaceOnUse><stop stop-color=#FFDF00 offset=0></stop><stop stop-color=#FF9D00 offset=1></stop></linearGradient><circle cx=565.5 cy=89.5 r=113.5></circle><linearGradient x1=-644.5 x2=-645.77 y1=342 y2=342 gradientTransform="matrix(30 0 0 1 19770 -253)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=427 x2=397 y1=89 y2=89 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-641.56 x2=-642.83 y1=196.02 y2=196.07 gradientTransform="matrix(26.5 0 0 5.5 17439 -1025.5)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=430.5 x2=404 y1=55.5 y2=50 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-643.73 x2=-645 y1=185.83 y2=185.9 gradientTransform="matrix(29 0 0 8 19107 -1361)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=431 x2=402 y1=122 y2=130 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-638.94 x2=-640.22 y1=177.09 y2=177.39 gradientTransform="matrix(24 0 0 13 15783 -2145)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=442 x2=418 y1=153 y2=166 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-633.42 x2=-634.7 y1=172.41 y2=173.31 gradientTransform="matrix(20 0 0 19 13137 -3096)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=464 x2=444 y1=180 y2=199 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-619.05 x2=-619.52 y1=170.82 y2=171.82 gradientTransform="matrix(13.83 0 0 22.85 9050 -3703.4)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=491.4 x2=477.5 y1=203 y2=225.9 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-578.5 x2=-578.63 y1=170.31 y2=171.31 gradientTransform="matrix(7.5 0 0 24.5 4860 -3953)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=524.5 x2=517 y1=219.5 y2=244 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=666.5 x2=666.5 y1=170.31 y2=171.31 gradientTransform="matrix(.5 0 0 24.5 231.5 -3944)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=564.5 x2=565 y1=228.5 y2=253 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12>`);function Sc(){return Zs()}function Cc(){return Qs()}function wc(){return $s()}function Tc(){return ec()}function Ec(){return tc()}function Dc(){return nc()}function Oc(){return rc()}function kc(){return ic()}function Ac(){return ac()}function jc(){return oc()}function Mc(){return sc()}function Nc(){return cc()}function Pc(){return lc()}function Fc(){return uc()}function Ic(){return dc()}function Lc(){return fc()}function Rc(t){return(()=>{var n=pc(),r=n.firstChild;return e(()=>z(r,`stroke`,t.theme===`dark`?`#12B76A`:`#027A48`)),n})()}function zc(){return mc()}function Bc(){return hc()}function Vc(t){return[T(L,{get when(){return t.checked},get children(){var n=pc(),r=n.firstChild;return e(()=>z(r,`stroke`,t.theme===`dark`?`#9B8AFB`:`#6938EF`)),n}}),T(L,{get when(){return!t.checked},get children(){var n=gc(),r=n.firstChild;return e(()=>z(r,`stroke`,t.theme===`dark`?`#9B8AFB`:`#6938EF`)),n}})]}function Hc(){return _c()}function Uc(){return vc()}function Wc(){return yc()}function Gc(){return bc()}function Kc(){let e=O();return(()=>{var t=xc(),n=t.firstChild,r=n.nextSibling,i=r.nextSibling,a=i.firstChild,o=i.nextSibling,s=o.firstChild,c=o.nextSibling,l=c.nextSibling,u=l.firstChild,d=l.nextSibling,f=d.firstChild,p=d.nextSibling,m=p.nextSibling,h=m.firstChild,g=m.nextSibling,_=g.firstChild,v=g.nextSibling,y=v.nextSibling,b=y.firstChild,x=y.nextSibling,S=x.firstChild,C=x.nextSibling,w=C.nextSibling,T=w.firstChild,E=w.nextSibling,ee=E.firstChild,D=E.nextSibling,O=D.nextSibling,k=O.firstChild,A=O.nextSibling,te=A.firstChild,j=A.nextSibling,M=j.nextSibling,N=M.firstChild,ne=M.nextSibling,P=ne.firstChild,re=ne.nextSibling,F=re.firstChild.nextSibling.nextSibling.nextSibling,I=F.nextSibling,ie=re.nextSibling,L=ie.firstChild,R=ie.nextSibling,ae=R.firstChild,oe=R.nextSibling,se=oe.firstChild,B=se.nextSibling,ce=B.nextSibling.firstChild,le=ce.nextSibling,ue=le.nextSibling,de=ue.nextSibling,fe=de.nextSibling,V=fe.nextSibling,pe=V.nextSibling,me=pe.nextSibling,he=me.nextSibling,ge=he.nextSibling,_e=ge.nextSibling,ve=_e.nextSibling,ye=oe.nextSibling,be=ye.firstChild,xe=ye.nextSibling,Se=xe.firstChild,H=xe.nextSibling,Ce=H.firstChild,we=Ce.nextSibling,Te=H.nextSibling,Ee=Te.firstChild,De=Te.nextSibling,Oe=De.firstChild,ke=De.nextSibling,Ae=ke.firstChild,je=Ae.nextSibling,Me=je.nextSibling,Ne=Me.nextSibling,Pe=Ne.nextSibling,Fe=Pe.nextSibling,Ie=Fe.nextSibling,Le=Ie.nextSibling,Re=Le.nextSibling,ze=Re.nextSibling,Be=ze.nextSibling,Ve=Be.nextSibling,He=Ve.nextSibling,Ue=He.nextSibling,We=Ue.nextSibling,Ge=We.nextSibling,Ke=Ge.nextSibling,qe=Ke.nextSibling;return z(n,`id`,`a-${e}`),z(r,`fill`,`url(#a-${e})`),z(a,`id`,`am-${e}`),z(o,`id`,`b-${e}`),z(s,`filter`,`url(#am-${e})`),z(c,`mask`,`url(#b-${e})`),z(u,`id`,`ah-${e}`),z(d,`id`,`k-${e}`),z(f,`filter`,`url(#ah-${e})`),z(p,`mask`,`url(#k-${e})`),z(h,`id`,`ae-${e}`),z(g,`id`,`j-${e}`),z(_,`filter`,`url(#ae-${e})`),z(v,`mask`,`url(#j-${e})`),z(b,`id`,`ai-${e}`),z(x,`id`,`i-${e}`),z(S,`filter`,`url(#ai-${e})`),z(C,`mask`,`url(#i-${e})`),z(T,`id`,`aj-${e}`),z(E,`id`,`h-${e}`),z(ee,`filter`,`url(#aj-${e})`),z(D,`mask`,`url(#h-${e})`),z(k,`id`,`ag-${e}`),z(A,`id`,`g-${e}`),z(te,`filter`,`url(#ag-${e})`),z(j,`mask`,`url(#g-${e})`),z(N,`id`,`af-${e}`),z(ne,`id`,`f-${e}`),z(P,`filter`,`url(#af-${e})`),z(re,`mask`,`url(#f-${e})`),z(F,`id`,`m-${e}`),z(I,`fill`,`url(#m-${e})`),z(L,`id`,`ak-${e}`),z(R,`id`,`e-${e}`),z(ae,`filter`,`url(#ak-${e})`),z(oe,`mask`,`url(#e-${e})`),z(se,`id`,`n-${e}`),z(B,`fill`,`url(#n-${e})`),z(ce,`id`,`r-${e}`),z(le,`fill`,`url(#r-${e})`),z(ue,`id`,`s-${e}`),z(de,`fill`,`url(#s-${e})`),z(fe,`id`,`q-${e}`),z(V,`fill`,`url(#q-${e})`),z(pe,`id`,`p-${e}`),z(me,`fill`,`url(#p-${e})`),z(he,`id`,`o-${e}`),z(ge,`fill`,`url(#o-${e})`),z(_e,`id`,`l-${e}`),z(ve,`fill`,`url(#l-${e})`),z(be,`id`,`al-${e}`),z(xe,`id`,`d-${e}`),z(Se,`filter`,`url(#al-${e})`),z(H,`mask`,`url(#d-${e})`),z(Ce,`id`,`u-${e}`),z(we,`fill`,`url(#u-${e})`),z(Ee,`id`,`ad-${e}`),z(De,`id`,`c-${e}`),z(Oe,`filter`,`url(#ad-${e})`),z(ke,`mask`,`url(#c-${e})`),z(Ae,`id`,`t-${e}`),z(je,`fill`,`url(#t-${e})`),z(Me,`id`,`v-${e}`),z(Ne,`stroke`,`url(#v-${e})`),z(Pe,`id`,`aa-${e}`),z(Fe,`stroke`,`url(#aa-${e})`),z(Ie,`id`,`w-${e}`),z(Le,`stroke`,`url(#w-${e})`),z(Re,`id`,`ac-${e}`),z(ze,`stroke`,`url(#ac-${e})`),z(Be,`id`,`ab-${e}`),z(Ve,`stroke`,`url(#ab-${e})`),z(He,`id`,`y-${e}`),z(Ue,`stroke`,`url(#y-${e})`),z(We,`id`,`x-${e}`),z(Ge,`stroke`,`url(#x-${e})`),z(Ke,`id`,`z-${e}`),z(qe,`stroke`,`url(#z-${e})`),t})()}var qc=Object.keys(k)[0],Jc=Object.keys(w)[0],Yc=class extends Error{},Xc=F(void 0),Zc=e=>{let[t,r]=o(null),i=()=>{let n=t();n!=null&&(n.close(),e.setLocalStore(`pip_open`,`false`),r(null))},a=(n,i)=>{if(t()!=null)return;let a=window.open(``,`TSQD-Devtools-Panel`,`width=${n},height=${i},popup`);if(!a)throw new Yc(`Failed to open popup. Please allow popups for this site to view the devtools in picture-in-picture mode.`);a.document.head.innerHTML=``,a.document.body.innerHTML=``,le(a.document),a.document.title=`TanStack Query Devtools`,a.document.body.style.margin=`0`,a.addEventListener(`pagehide`,()=>{e.setLocalStore(`pip_open`,`false`),r(null)}),[...(H().shadowDOMTarget||document).styleSheets].forEach(e=>{try{let t=[...e.cssRules].map(e=>e.cssText).join(``),n=document.createElement(`style`),r=e.ownerNode,i=``;r&&`id`in r&&(i=r.id),i&&n.setAttribute(`id`,i),n.textContent=t,a.document.head.appendChild(n)}catch{let t=document.createElement(`link`);if(e.href==null)return;t.rel=`stylesheet`,t.type=e.type,t.media=e.media.toString(),t.href=e.href,a.document.head.appendChild(t)}}),y([`focusin`,`focusout`,`pointermove`,`keydown`,`pointerdown`,`pointerup`,`click`,`mousedown`,`input`],a.document),e.setLocalStore(`pip_open`,`true`),r(a)};l(()=>{if((e.localStore.pip_open??`false`)===`true`&&!e.disabled)try{a(Number(window.innerWidth),Number(e.localStore.height||500))}catch(t){if(t instanceof Yc){e.setLocalStore(`pip_open`,`false`),e.setLocalStore(`open`,`false`);return}throw t}}),l(()=>{let e=(H().shadowDOMTarget||document).querySelector(`#_goober`),r=t();if(e&&r){let t=new MutationObserver(()=>{let t=(H().shadowDOMTarget||r.document).querySelector(`#_goober`);t&&(t.textContent=e.textContent)});t.observe(e,{childList:!0,subtree:!0,characterDataOldValue:!0}),n(()=>{t.disconnect()})}});let s=B(()=>({pipWindow:t(),requestPipWindow:a,closePipWindow:i,disabled:e.disabled??!1}));return T(Xc.Provider,{value:s,get children(){return e.children}})},Qc=()=>B(()=>{let e=c(Xc);if(!e)throw Error(`usePiPWindow must be used within a PiPProvider`);return e()}),$c=F(()=>`dark`);function Q(){return c($c)}var el=p(`<span><svg width=16 height=16 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg><path d="M6 12L10 8L6 4"stroke-width=2 stroke-linecap=round stroke-linejoin=round>`),tl=p(`<button title="Copy object to clipboard">`),nl=p(`<button title="Remove all items"aria-label="Remove all items">`),rl=p(`<button title="Delete item"aria-label="Delete item">`),il=p(`<button title="Toggle value"aria-label="Toggle value">`),al=p(`<button title="Bulk Edit Data"aria-label="Bulk Edit Data">`),ol=p(`<div>`),sl=p(`<div><button> <span></span> <span> `),cl=p(`<input>`),ll=p(`<span>`),ul=p(`<div><label>:`),dl=p(`<div><div><button> [<!>...<!>]`);function fl(e,t){if(t<1)return[];let n=0,r=[];for(;n<e.length;)r.push(e.slice(n,n+t)),n+=t;return r}var pl=t=>{let n=Q(),r=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,i=B(()=>n()===`dark`?Sl(r):xl(r));return(()=>{var n=el();return e(()=>N(n,W(i().expander,r`
          transform: rotate(${t.expanded?90:0}deg);
        `,t.expanded&&r`
            & svg {
              top: -1px;
            }
          `))),n})()},ml=t=>{let n=Q(),r=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,i=B(()=>n()===`dark`?Sl(r):xl(r)),[a,s]=o(`NoCopy`);return(()=>{var r=tl();return b(r,`click`,a()===`NoCopy`?()=>{navigator.clipboard.writeText(D(t.value)).then(()=>{s(`SuccessCopy`),setTimeout(()=>{s(`NoCopy`)},1500)},e=>{s(`ErrorCopy`),setTimeout(()=>{s(`NoCopy`)},1500)})}:void 0,!0),I(r,T(v,{get children(){return[T(ne,{get when(){return a()===`NoCopy`},get children(){return T(Ic,{})}}),T(ne,{get when(){return a()===`SuccessCopy`},get children(){return T(Rc,{get theme(){return n()}})}}),T(ne,{get when(){return a()===`ErrorCopy`},get children(){return T(zc,{})}})]}})),e(e=>{var t=i().actionButton,n=`${a()===`NoCopy`?`Copy object to clipboard`:a()===`SuccessCopy`?`Object copied to clipboard`:`Error copying object to clipboard`}`;return t!==e.e&&N(r,e.e=t),n!==e.t&&z(r,`aria-label`,e.t=n),e},{e:void 0,t:void 0}),r})()},hl=t=>{let n=Q(),r=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,i=B(()=>n()===`dark`?Sl(r):xl(r)),a=H().client;return(()=>{var n=nl();return n.$$click=()=>{let e=t.activeQuery.state.data,n=ce(e,t.dataPath,[]);a.setQueryData(t.activeQuery.queryKey,n)},I(n,T(Bc,{})),e(()=>N(n,i().actionButton)),n})()},gl=t=>{let n=Q(),r=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,i=B(()=>n()===`dark`?Sl(r):xl(r)),a=H().client;return(()=>{var n=rl();return n.$$click=()=>{let e=t.activeQuery.state.data,n=ae(e,t.dataPath);a.setQueryData(t.activeQuery.queryKey,n)},I(n,T(Cc,{})),e(()=>N(n,W(i().actionButton))),n})()},_l=t=>{let n=Q(),r=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,i=B(()=>n()===`dark`?Sl(r):xl(r)),a=H().client;return(()=>{var o=il();return o.$$click=()=>{let e=t.activeQuery.state.data,n=ce(e,t.dataPath,!t.value);a.setQueryData(t.activeQuery.queryKey,n)},I(o,T(Vc,{get theme(){return n()},get checked(){return t.value}})),e(e=>{var n=W(i().actionButton,r`
          width: ${Z.size[3.5]};
          height: ${Z.size[3.5]};
        `),a=t.value;return n!==e.e&&N(o,e.e=n),a!==e.t&&z(o,`aria-pressed`,e.t=a),e},{e:void 0,t:void 0}),o})()};function vl(e){return Symbol.iterator in e}function yl(t){let n=Q(),i=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,a=B(()=>n()===`dark`?Sl(i):xl(i)),s=H().client,[c,l]=o((t.defaultExpanded||[]).includes(t.label)),u=()=>l(e=>!e),[d,f]=o([]),p=B(()=>Array.isArray(t.value)?t.value.map((e,t)=>({label:t.toString(),value:e})):t.value!==null&&typeof t.value==`object`&&vl(t.value)&&typeof t.value[Symbol.iterator]==`function`?t.value instanceof Map?Array.from(t.value,([e,t])=>({label:e,value:t})):Array.from(t.value,(e,t)=>({label:t.toString(),value:e})):typeof t.value==`object`&&t.value!==null?Object.entries(t.value).map(([e,t])=>({label:e,value:t})):[]),m=B(()=>Array.isArray(t.value)?`array`:t.value!==null&&typeof t.value==`object`&&vl(t.value)&&typeof t.value[Symbol.iterator]==`function`?`Iterable`:typeof t.value==`object`&&t.value!==null?`object`:typeof t.value),h=B(()=>fl(p(),100)),g=t.dataPath??[],_=O();return(()=>{var n=ol();return I(n,T(L,{get when(){return h().length},get children(){return[(()=>{var n=sl(),i=n.firstChild,o=i.firstChild,s=o.nextSibling,l=s.nextSibling.nextSibling,d=l.firstChild;return i.$$click=()=>u(),I(i,T(pl,{get expanded(){return c()}}),o),I(s,()=>t.label),I(l,()=>String(m()).toLowerCase()===`iterable`?`(Iterable) `:``,d),I(l,()=>p().length,d),I(l,()=>p().length>1?`items`:`item`,null),I(n,T(L,{get when(){return t.editable},get children(){var n=ol();return I(n,T(ml,{get value(){return t.value}}),null),I(n,T(L,{get when(){return r(()=>!!t.itemsDeletable)()&&t.activeQuery!==void 0},get children(){return T(gl,{get activeQuery(){return t.activeQuery},dataPath:g})}}),null),I(n,T(L,{get when(){return r(()=>m()===`array`)()&&t.activeQuery!==void 0},get children(){return T(hl,{get activeQuery(){return t.activeQuery},dataPath:g})}}),null),I(n,T(L,{get when(){return r(()=>!!t.onEdit)()&&!se(t.value).meta},get children(){var n=al();return n.$$click=()=>{t.onEdit?.()},I(n,T(Lc,{})),e(()=>N(n,a().actionButton)),n}}),null),e(()=>N(n,a().actions)),n}}),null),e(e=>{var t=a().expanderButtonContainer,r=a().expanderButton,o=c()?`true`:`false`,s=a().info;return t!==e.e&&N(n,e.e=t),r!==e.t&&N(i,e.t=r),o!==e.a&&z(i,`aria-expanded`,e.a=o),s!==e.o&&N(l,e.o=s),e},{e:void 0,t:void 0,a:void 0,o:void 0}),n})(),T(L,{get when(){return c()},get children(){return[T(L,{get when(){return h().length===1},get children(){var n=ol();return I(n,T(vt,{get each(){return p()},by:e=>e.label,children:e=>T(yl,{get defaultExpanded(){return t.defaultExpanded},get label(){return e().label},get value(){return e().value},get editable(){return t.editable},get dataPath(){return[...g,e().label]},get activeQuery(){return t.activeQuery},get itemsDeletable(){return m()===`array`||m()===`Iterable`||m()===`object`}})})),e(()=>N(n,a().subEntry)),n}}),T(L,{get when(){return h().length>1},get children(){var n=ol();return I(n,T(S,{get each(){return h()},children:(n,r)=>(()=>{var i=dl(),o=i.firstChild,s=o.firstChild,c=s.firstChild,l=c.nextSibling,u=l.nextSibling.nextSibling;return u.nextSibling,s.$$click=()=>f(e=>e.includes(r)?e.filter(e=>e!==r):[...e,r]),I(s,T(pl,{get expanded(){return d().includes(r)}}),c),I(s,r*100,l),I(s,r*100+100-1,u),I(o,T(L,{get when(){return d().includes(r)},get children(){var r=ol();return I(r,T(vt,{get each(){return n()},by:e=>e.label,children:e=>T(yl,{get defaultExpanded(){return t.defaultExpanded},get label(){return e().label},get value(){return e().value},get editable(){return t.editable},get dataPath(){return[...g,e().label]},get activeQuery(){return t.activeQuery}})})),e(()=>N(r,a().subEntry)),r}}),null),e(e=>{var t=a().entry,n=a().expanderButton;return t!==e.e&&N(o,e.e=t),n!==e.t&&N(s,e.t=n),e},{e:void 0,t:void 0}),i})()})),e(()=>N(n,a().subEntry)),n}})]}})]}}),null),I(n,T(L,{get when(){return h().length===0},get children(){var n=ul(),i=n.firstChild,o=i.firstChild;return z(i,`for`,_),I(i,()=>t.label,o),I(n,T(L,{get when(){return r(()=>!!(t.editable&&t.activeQuery!==void 0))()&&(m()===`string`||m()===`number`||m()===`boolean`)},get fallback(){return(()=>{var n=ll();return I(n,()=>te(t.value)),e(()=>N(n,a().value)),n})()},get children(){return[T(L,{get when(){return r(()=>!!(t.editable&&t.activeQuery!==void 0))()&&(m()===`string`||m()===`number`)},get children(){var n=cl();return n.addEventListener(`change`,e=>{let n=t.activeQuery.state.data,r=ce(n,g,m()===`number`?e.target.valueAsNumber:e.target.value);s.setQueryData(t.activeQuery.queryKey,r)}),z(n,`id`,_),e(e=>{var t=m()===`number`?`number`:`text`,r=W(a().value,a().editableInput);return t!==e.e&&z(n,`type`,e.e=t),r!==e.t&&N(n,e.t=r),e},{e:void 0,t:void 0}),e(()=>n.value=t.value),n}}),T(L,{get when(){return m()===`boolean`},get children(){var n=ll();return I(n,T(_l,{get activeQuery(){return t.activeQuery},dataPath:g,get value(){return t.value}}),null),I(n,()=>te(t.value),null),e(()=>N(n,W(a().value,a().actions,a().editableInput))),n}})]}}),null),I(n,T(L,{get when(){return r(()=>!!(t.editable&&t.itemsDeletable))()&&t.activeQuery!==void 0},get children(){return T(gl,{get activeQuery(){return t.activeQuery},dataPath:g})}}),null),e(e=>{var t=a().row,r=a().label;return t!==e.e&&N(n,e.e=t),r!==e.t&&N(i,e.t=r),e},{e:void 0,t:void 0}),n}}),null),e(()=>N(n,a().entry)),n})()}var bl=(e,t)=>{let{colors:n,font:r,size:i,border:a}=Z,o=(t,n)=>e===`light`?t:n;return{entry:t`
      & * {
        font-size: ${r.size.xs};
        font-family:
          ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
      }
      position: relative;
      outline: none;
      word-break: break-word;
    `,subEntry:t`
      margin: 0 0 0 0.5em;
      padding-left: 0.75em;
      border-left: 2px solid ${o(n.gray[300],n.darkGray[400])};
      /* outline: 1px solid ${n.teal[400]}; */
    `,expander:t`
      & path {
        stroke: ${n.gray[400]};
      }
      & svg {
        width: ${i[3]};
        height: ${i[3]};
      }
      display: inline-flex;
      align-items: center;
      transition: all 0.1s ease;
      /* outline: 1px solid ${n.blue[400]}; */
    `,expanderButtonContainer:t`
      display: flex;
      align-items: center;
      line-height: ${i[4]};
      min-height: ${i[4]};
      gap: ${i[2]};
    `,expanderButton:t`
      cursor: pointer;
      color: inherit;
      font: inherit;
      outline: inherit;
      height: ${i[5]};
      background: transparent;
      border: none;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: ${i[1]};
      position: relative;
      /* outline: 1px solid ${n.green[400]}; */

      &:focus-visible {
        border-radius: ${a.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }

      & svg {
        position: relative;
        left: 1px;
      }
    `,info:t`
      color: ${o(n.gray[500],n.gray[500])};
      font-size: ${r.size.xs};
      margin-left: ${i[1]};
      /* outline: 1px solid ${n.yellow[400]}; */
    `,label:t`
      color: ${o(n.gray[700],n.gray[300])};
      white-space: nowrap;
    `,value:t`
      color: ${o(n.purple[600],n.purple[400])};
      flex-grow: 1;
    `,actions:t`
      display: inline-flex;
      gap: ${i[2]};
      align-items: center;
    `,row:t`
      display: inline-flex;
      gap: ${i[2]};
      width: 100%;
      margin: ${i[.25]} 0px;
      line-height: ${i[4.5]};
      align-items: center;
    `,editableInput:t`
      border: none;
      padding: ${i[.5]} ${i[1]} ${i[.5]} ${i[1.5]};
      flex-grow: 1;
      border-radius: ${a.radius.xs};
      background-color: ${o(n.gray[200],n.darkGray[500])};

      &:hover {
        background-color: ${o(n.gray[300],n.darkGray[600])};
      }
    `,actionButton:t`
      background-color: transparent;
      color: ${o(n.gray[500],n.gray[500])};
      border: none;
      display: inline-flex;
      padding: 0px;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      width: ${i[3]};
      height: ${i[3]};
      position: relative;
      z-index: 1;

      &:hover svg {
        color: ${o(n.gray[600],n.gray[400])};
      }

      &:focus-visible {
        border-radius: ${a.radius.xs};
        outline: 2px solid ${n.blue[800]};
        outline-offset: 2px;
      }
    `}},xl=e=>bl(`light`,e),Sl=e=>bl(`dark`,e);y([`click`]);var Cl=p(`<div><div aria-hidden=true></div><button type=button aria-label="Open Tanstack query devtools"class=tsqd-open-btn>`),wl=p(`<div>`),Tl=p(`<div style=--tsqd-font-size:16px;max-height:100vh;height:100vh;width:100vw>`),El=p(`<aside aria-label="Tanstack query devtools"><div role=separator aria-label="Resize devtools panel"tabindex=0></div><button aria-label="Close tanstack query devtools">`),Dl=p(`<select name=tsqd-queries-filter-sort aria-label="Sort queries by">`),Ol=p(`<select name=tsqd-mutations-filter-sort aria-label="Sort mutations by">`),kl=p(`<span>Asc`),Al=p(`<span>Desc`),jl=p(`<button aria-label="Open in picture-in-picture mode"title="Open in picture-in-picture mode">`),Ml=p(`<div>Settings`),Nl=p(`<span>Position`),Pl=p(`<span>Top`),Fl=p(`<span>Bottom`),Il=p(`<span>Left`),Ll=p(`<span>Right`),Rl=p(`<span>Theme`),zl=p(`<span>Light`),Bl=p(`<span>Dark`),Vl=p(`<span>System`),Hl=p(`<span>Disabled Queries`),Ul=p(`<span>Show`),Wl=p(`<span>Hide`),Gl=p(`<div><div class=tsqd-queries-container>`),Kl=p(`<div><div class=tsqd-mutations-container>`),ql=p(`<div><div><div><button aria-label="Close Tanstack query devtools"><span>TANSTACK</span><span> v</span></button></div></div><div><div><div><input aria-label="Filter queries by query key"type=text placeholder=Filter name=tsqd-query-filter-input></div><div></div><button class=tsqd-query-filter-sort-order-btn></button></div><div><button aria-label="Clear query cache"></button><button>`),Jl=p(`<option>Sort by `),Yl=p(`<div class=tsqd-query-disabled-indicator aria-hidden=true>disabled`),Xl=p(`<div class=tsqd-query-static-indicator aria-hidden=true>static`),Zl=p(`<button><div></div><code class=tsqd-query-hash>`),Ql=p(`<div role=tooltip id=tsqd-status-tooltip>`),$l=p(`<span>`),eu=p(`<button><span aria-hidden=true></span><span>`),tu=p(`<button><span aria-hidden=true></span> Error`),nu=p(`<div><span aria-hidden=true></span>Trigger Error<select aria-label="Select error type to trigger"><option value disabled selected>`),ru=p(`<div class="tsqd-query-details-explorer-container tsqd-query-details-data-explorer">`),iu=p(`<form><textarea name=data aria-label="Edit query data as JSON"></textarea><div><span></span><div><button type=button>Cancel</button><button>Save`),au=p(`<div><div role=heading aria-level=2>Query Details</div><div><div class=tsqd-query-details-summary><pre><code></code></pre><span role=status aria-live=polite></span></div><div class=tsqd-query-details-observers-count><span>Observers:</span><span></span></div><div class=tsqd-query-details-last-updated><span>Last Updated:</span><span></span></div></div><div role=heading aria-level=2>Actions</div><div><button><span aria-hidden=true></span>Refetch</button><button><span aria-hidden=true></span>Invalidate</button><button><span aria-hidden=true></span>Reset</button><button><span aria-hidden=true></span>Remove</button><button><span aria-hidden=true></span> Loading</button></div><div role=heading aria-level=2>Data </div><div role=heading aria-level=2>Query Explorer</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer">`),ou=p(`<option>`),su=p(`<div><div role=heading aria-level=2>Mutation Details</div><div><div class=tsqd-query-details-summary><pre><code></code></pre><span role=status aria-live=polite></span></div><div class=tsqd-query-details-last-updated><span>Submitted At:</span><span></span></div></div><div role=heading aria-level=2>Variables Details</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer"></div><div role=heading aria-level=2>Context Details</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer"></div><div role=heading aria-level=2>Data Explorer</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer"></div><div role=heading aria-level=2>Mutations Explorer</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer">`),cu=t=>{let i=Q(),a=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,o=B(()=>i()===`dark`?Tu(a):wu(a)),c=Qc(),u=B(()=>H().buttonPosition||`bottom-right`),d=B(()=>t.localStore.open===`true`?!0:t.localStore.open===`false`?!1:H().initialIsOpen||!1),p=B(()=>t.localStore.position||H().position||`bottom`),m;l(()=>{let e=m.parentElement,n=t.localStore.height||500,r=t.localStore.width||500,i=p();e.style.setProperty(`--tsqd-panel-height`,`${i===`top`?`-`:``}${n}px`),e.style.setProperty(`--tsqd-panel-width`,`${i===`left`?`-`:``}${r}px`)}),s(()=>{let e=()=>{let e=m.parentElement,t=getComputedStyle(e).fontSize;e.style.setProperty(`--tsqd-font-size`,t)};e(),window.addEventListener(`focus`,e),n(()=>{window.removeEventListener(`focus`,e)})});let h=B(()=>t.localStore.pip_open??`false`);return[T(L,{get when(){return r(()=>!!c().pipWindow)()&&h()==`true`},get children(){return T(_,{get mount(){return c().pipWindow?.document.body},get children(){return T(lu,{get children(){return T(du,t)}})}})}}),(()=>{var n=wl(),i=m;return typeof i==`function`?f(i,n):m=n,I(n,T(mt,{name:`tsqd-panel-transition`,get children(){return T(L,{get when(){return r(()=>!(!d()||c().pipWindow))()&&h()==`false`},get children(){return T(uu,{get localStore(){return t.localStore},get setLocalStore(){return t.setLocalStore}})}})}}),null),I(n,T(mt,{name:`tsqd-button-transition`,get children(){return T(L,{get when(){return!d()},get children(){var n=Cl(),r=n.firstChild,i=r.nextSibling;return I(r,T(Kc,{})),i.$$click=()=>t.setLocalStore(`open`,`true`),I(i,T(Kc,{})),e(()=>N(n,W(o().devtoolsBtn,o()[`devtoolsBtn-position-${u()}`],`tsqd-open-btn-container`))),n}})}}),null),e(()=>N(n,W(a`
            & .tsqd-panel-transition-exit-active,
            & .tsqd-panel-transition-enter-active {
              transition:
                opacity 0.3s,
                transform 0.3s;
            }

            & .tsqd-panel-transition-exit-to,
            & .tsqd-panel-transition-enter {
              ${p()===`top`||p()===`bottom`?`transform: translateY(var(--tsqd-panel-height));`:`transform: translateX(var(--tsqd-panel-width));`}
            }

            & .tsqd-button-transition-exit-active,
            & .tsqd-button-transition-enter-active {
              transition:
                opacity 0.3s,
                transform 0.3s;
              opacity: 1;
            }

            & .tsqd-button-transition-exit-to,
            & .tsqd-button-transition-enter {
              transform: ${u()===`relative`?`none;`:u()===`top-left`?`translateX(-72px);`:u()===`top-right`?`translateX(72px);`:`translateY(72px);`};
              opacity: 0;
            }
          `,`tsqd-transitions-container`))),n})()]},lu=t=>{let{panelWidth:r,setPanelWidth:i}=je(),a=Qc(),o=Q(),s=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,c=B(()=>o()===`dark`?Tu(s):wu(s)),u=()=>{let{colors:e}=Z,t=(e,t)=>o()===`dark`?t:e;return r()<796?s`
        flex-direction: column;
        background-color: ${t(e.gray[300],e.gray[600])};
      `:s`
      flex-direction: row;
      background-color: ${t(e.gray[200],e.darkGray[900])};
    `};return l(()=>{let e=a().pipWindow,t=()=>{e&&i(e.innerWidth)};e&&(e.addEventListener(`resize`,t),t()),n(()=>{e&&e.removeEventListener(`resize`,t)})}),(()=>{var n=Tl();return I(n,()=>t.children),e(()=>N(n,W(c().panel,u(),{[s`
            min-width: min-content;
          `]:r()<700},`tsqd-main-panel`))),n})()},uu=t=>{let{setSelectedQueryHash:r,panelWidth:i,setPanelWidth:a}=je(),c=Q(),u=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,p=B(()=>c()===`dark`?Tu(u):wu(u)),m;s(()=>{m.focus()});let[h,g]=o(!1),_=B(()=>t.localStore.position||H().position||`bottom`),v=e=>{let n=e.currentTarget.parentElement;if(!n)return;g(!0);let{height:i,width:a}=n.getBoundingClientRect(),o=e.clientX,s=e.clientY,c=0,l=j(3.5),u=j(12),d=e=>{if(e.preventDefault(),_()===`left`||_()===`right`){let r=_()===`right`?o-e.clientX:e.clientX-o;c=Math.round(a+r),c<u&&(c=u),t.setLocalStore(`width`,String(Math.round(c)));let i=n.getBoundingClientRect().width;Number(t.localStore.width)<i&&t.setLocalStore(`width`,String(i))}else{let n=_()===`bottom`?s-e.clientY:e.clientY-s;c=Math.round(i+n),c<l&&(c=l,r(null)),t.setLocalStore(`height`,String(Math.round(c)))}},f=()=>{h()&&g(!1),document.removeEventListener(`mousemove`,d,!1),document.removeEventListener(`mouseup`,f,!1)};document.addEventListener(`mousemove`,d,!1),document.addEventListener(`mouseup`,f,!1)},y;s(()=>{St(y,({width:e},t)=>{t===y&&a(e)})}),l(()=>{let e=y.parentElement?.parentElement?.parentElement;if(!e)return;let r=t.localStore.position||`bottom`,i=oe(`padding`,r),a=t.localStore.position===`left`||t.localStore.position===`right`,o=(({padding:e,paddingTop:t,paddingBottom:n,paddingLeft:r,paddingRight:i})=>({padding:e,paddingTop:t,paddingBottom:n,paddingLeft:r,paddingRight:i}))(e.style);e.style[i]=`${a?t.localStore.width:t.localStore.height}px`,n(()=>{Object.entries(o).forEach(([t,n])=>{e.style[t]=n})})});let b=()=>{let{colors:e}=Z,t=(e,t)=>c()===`dark`?t:e;return i()<796?u`
        flex-direction: column;
        background-color: ${t(e.gray[300],e.gray[600])};
      `:u`
      flex-direction: row;
      background-color: ${t(e.gray[200],e.darkGray[900])};
    `};return(()=>{var n=El(),r=n.firstChild,a=r.nextSibling,o=y;typeof o==`function`?f(o,n):y=n,r.$$keydown=e=>{let n=j(3.5),r=j(12);if(_()===`top`||_()===`bottom`){if(e.key===`ArrowUp`||e.key===`ArrowDown`){e.preventDefault();let r=Number(t.localStore.height||500),i=_()===`bottom`?e.key===`ArrowUp`?10:-10:e.key===`ArrowDown`?10:-10,a=Math.max(n,r+i);t.setLocalStore(`height`,String(a))}}else if(e.key===`ArrowLeft`||e.key===`ArrowRight`){e.preventDefault();let n=Number(t.localStore.width||500),i=_()===`right`?e.key===`ArrowLeft`?10:-10:e.key===`ArrowRight`?10:-10,a=Math.max(r,n+i);t.setLocalStore(`width`,String(a))}},r.$$mousedown=v,a.$$click=()=>t.setLocalStore(`open`,`false`);var s=m;return typeof s==`function`?f(s,a):m=a,I(a,T(wc,{})),I(n,T(du,t),null),e(e=>{var o=W(p().panel,p()[`panel-position-${_()}`],b(),{[u`
            min-width: min-content;
          `]:i()<700&&(_()===`right`||_()===`left`)},`tsqd-main-panel`),s=_()===`bottom`||_()===`top`?`${t.localStore.height||500}px`:`auto`,c=_()===`right`||_()===`left`?`${t.localStore.width||500}px`:`auto`,l=_()===`top`||_()===`bottom`?`horizontal`:`vertical`,f=_()===`top`||_()===`bottom`?j(3.5):j(12),m=_()===`top`||_()===`bottom`?Number(t.localStore.height||500):Number(t.localStore.width||500),h=W(p().dragHandle,p()[`dragHandle-position-${_()}`],`tsqd-drag-handle`),g=W(p().closeBtn,p()[`closeBtn-position-${_()}`],`tsqd-minimize-btn`);return o!==e.e&&N(n,e.e=o),s!==e.t&&d(n,`height`,e.t=s),c!==e.a&&d(n,`width`,e.a=c),l!==e.o&&z(r,`aria-orientation`,e.o=l),f!==e.i&&z(r,`aria-valuemin`,e.i=f),m!==e.n&&z(r,`aria-valuenow`,e.n=m),h!==e.s&&N(r,e.s=h),g!==e.h&&N(a,e.h=g),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0}),n})()},du=t=>{let{selectedQueryHash:n,setSelectedQueryHash:i,selectedMutationId:a,setSelectedMutationId:s,panelWidth:c}=je(),{offline:l,toggleOffline:u}=we();yu(),bu();let d,p=Q(),m=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,h=B(()=>p()===`dark`?Tu(m):wu(m)),_=Qc(),[v,y]=o(`queries`),x=B(()=>t.localStore.sort||qc),S=B(()=>Number(t.localStore.sortOrder)||1),C=B(()=>t.localStore.mutationSort||Jc),E=B(()=>Number(t.localStore.mutationSortOrder)||1),ee=B(()=>k[x()]),D=B(()=>w[C()]),O=B(()=>H().client.getQueryCache()),A=B(()=>H().client.getMutationCache()),te=$(e=>e().getAll().length,!1),j=B(()=>t.localStore.hideDisabledQueries===`true`?!0:t.localStore.hideDisabledQueries===`false`?!1:H().hideDisabledQueries||!1),M=B(g(()=>[te(),t.localStore.filter,x(),S(),j()],()=>{let e=O().getAll(),n=t.localStore.filter?e.filter(e=>Re(e.queryHash,t.localStore.filter||``).passed):[...e];return j()&&(n=n.filter(e=>!e.isDisabled())),ee()?n.sort((e,t)=>ee()(e,t)*S()):n})),ne=xu(e=>e().getAll().length,!1),P=B(g(()=>[ne(),t.localStore.mutationFilter,C(),E()],()=>{let e=A().getAll(),n=t.localStore.mutationFilter?e.filter(e=>Re(`${e.options.mutationKey?JSON.stringify(e.options.mutationKey)+` - `:``}${new Date(e.state.submittedAt).toLocaleString()}`,t.localStore.mutationFilter||``).passed):[...e];return D()?n.sort((e,t)=>D()(e,t)*E()):n})),re=e=>{t.setLocalStore(`position`,e)},F=e=>{let t=getComputedStyle(d).getPropertyValue(`--tsqd-font-size`);e.style.setProperty(`--tsqd-font-size`,t)};return[(()=>{var o=ql(),p=o.firstChild,g=p.firstChild,ee=g.firstChild,D=ee.firstChild,te=D.nextSibling,ne=te.firstChild,ie=p.nextSibling,R=ie.firstChild,ae=R.firstChild,oe=ae.firstChild,se=ae.nextSibling,B=se.nextSibling,ce=R.nextSibling,le=ce.firstChild,ue=le.nextSibling,de=d;return typeof de==`function`?f(de,o):d=o,ee.$$click=()=>{!_().pipWindow&&!t.showPanelViewOnly?t.setLocalStore(`open`,`false`):t.onClose&&t.onClose()},I(te,()=>H().queryFlavor,ne),I(te,()=>H().version,null),I(g,T(Wo.Root,{get class(){return W(h().viewToggle)},get value(){return v()},"aria-label":`Toggle between queries and mutations view`,onChange:e=>{y(e),i(null),s(null)},get children(){return[T(Wo.Item,{value:`queries`,class:`tsqd-radio-toggle`,get children(){return[T(Wo.ItemInput,{}),T(Wo.ItemControl,{get children(){return T(Wo.ItemIndicator,{})}}),T(Wo.ItemLabel,{title:`Toggle Queries View`,children:`Queries`})]}}),T(Wo.Item,{value:`mutations`,class:`tsqd-radio-toggle`,get children(){return[T(Wo.ItemInput,{}),T(Wo.ItemControl,{get children(){return T(Wo.ItemIndicator,{})}}),T(Wo.ItemLabel,{title:`Toggle Mutations View`,children:`Mutations`})]}})]}}),null),I(p,T(L,{get when(){return v()===`queries`},get children(){return T(mu,{})}}),null),I(p,T(L,{get when(){return v()===`mutations`},get children(){return T(hu,{})}}),null),I(ae,T(Sc,{}),oe),oe.$$input=e=>{v()===`queries`?t.setLocalStore(`filter`,e.currentTarget.value):t.setLocalStore(`mutationFilter`,e.currentTarget.value)},I(se,T(L,{get when(){return v()===`queries`},get children(){var n=Dl();return n.addEventListener(`change`,e=>{t.setLocalStore(`sort`,e.currentTarget.value)}),I(n,()=>Object.keys(k).map(e=>(()=>{var t=Jl();return t.firstChild,t.value=e,I(t,e,null),t})())),e(()=>n.value=x()),n}}),null),I(se,T(L,{get when(){return v()===`mutations`},get children(){var n=Ol();return n.addEventListener(`change`,e=>{t.setLocalStore(`mutationSort`,e.currentTarget.value)}),I(n,()=>Object.keys(w).map(e=>(()=>{var t=Jl();return t.firstChild,t.value=e,I(t,e,null),t})())),e(()=>n.value=C()),n}}),null),I(se,T(wc,{}),null),B.$$click=()=>{v()===`queries`?t.setLocalStore(`sortOrder`,String(S()*-1)):t.setLocalStore(`mutationSortOrder`,String(E()*-1))},I(B,T(L,{get when(){return(v()===`queries`?S():E())===1},get children(){return[kl(),T(Tc,{})]}}),null),I(B,T(L,{get when(){return(v()===`queries`?S():E())===-1},get children(){return[Al(),T(Ec,{})]}}),null),le.$$click=()=>{v()===`queries`?(Su({type:`CLEAR_QUERY_CACHE`}),O().clear()):(Su({type:`CLEAR_MUTATION_CACHE`}),A().clear())},I(le,T(Cc,{})),b(ue,`click`,u,!0),I(ue,(()=>{var e=r(()=>!!l());return()=>e()?T(Nc,{}):T(Mc,{})})()),I(ce,T(L,{get when(){return r(()=>!_().pipWindow)()&&!_().disabled},get children(){var n=jl();return n.$$click=()=>{_().requestPipWindow(Number(window.innerWidth),Number(t.localStore.height??500))},I(n,T(Fc,{})),e(()=>N(n,W(h().actionsBtn,`tsqd-actions-btn`,`tsqd-action-open-pip`))),n}}),null),I(ce,T(X.Root,{gutter:4,get children(){return[T(X.Trigger,{get class(){return W(h().actionsBtn,`tsqd-actions-btn`,`tsqd-action-settings`)},"aria-label":`Open settings menu`,title:`Open settings menu`,get children(){return T(Pc,{})}}),T(X.Portal,{ref:e=>F(e),get mount(){return r(()=>!!_().pipWindow)()?_().pipWindow.document.body:document.body},get children(){return T(X.Content,{get class(){return W(h().settingsMenu,`tsqd-settings-menu`)},get children(){return[(()=>{var t=Ml();return e(()=>N(t,W(h().settingsMenuHeader,`tsqd-settings-menu-header`))),t})(),T(L,{get when(){return!t.showPanelViewOnly},get children(){return T(X.Sub,{overlap:!0,gutter:8,shift:-4,get children(){return[T(X.SubTrigger,{get class(){return W(h().settingsSubTrigger,`tsqd-settings-menu-sub-trigger`,`tsqd-settings-menu-sub-trigger-position`)},get children(){return[Nl(),T(wc,{})]}}),T(X.Portal,{ref:e=>F(e),get mount(){return r(()=>!!_().pipWindow)()?_().pipWindow.document.body:document.body},get children(){return T(X.SubContent,{get class(){return W(h().settingsMenu,`tsqd-settings-submenu`)},get children(){return T(X.RadioGroup,{"aria-label":`Position settings`,get value(){return t.localStore.position},onChange:e=>re(e),get children(){return[T(X.RadioItem,{value:`top`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-top`)},get children(){return[Pl(),T(Tc,{})]}}),T(X.RadioItem,{value:`bottom`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-bottom`)},get children(){return[Fl(),T(Ec,{})]}}),T(X.RadioItem,{value:`left`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-left`)},get children(){return[Il(),T(Dc,{})]}}),T(X.RadioItem,{value:`right`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-right`)},get children(){return[Ll(),T(Oc,{})]}})]}})}})}})]}})}}),T(X.Sub,{overlap:!0,gutter:8,shift:-4,get children(){return[T(X.SubTrigger,{get class(){return W(h().settingsSubTrigger,`tsqd-settings-menu-sub-trigger`,`tsqd-settings-menu-sub-trigger-theme`)},get children(){return[Rl(),T(wc,{})]}}),T(X.Portal,{ref:e=>F(e),get mount(){return r(()=>!!_().pipWindow)()?_().pipWindow.document.body:document.body},get children(){return T(X.SubContent,{get class(){return W(h().settingsMenu,`tsqd-settings-submenu`)},get children(){return T(X.RadioGroup,{get value(){return t.localStore.theme_preference},onChange:e=>{t.setLocalStore(`theme_preference`,e)},"aria-label":`Theme preference`,get children(){return[T(X.RadioItem,{value:`light`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-top`)},get children(){return[zl(),T(kc,{})]}}),T(X.RadioItem,{value:`dark`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-bottom`)},get children(){return[Bl(),T(Ac,{})]}}),T(X.RadioItem,{value:`system`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-left`)},get children(){return[Vl(),T(jc,{})]}})]}})}})}})]}}),T(X.Sub,{overlap:!0,gutter:8,shift:-4,get children(){return[T(X.SubTrigger,{get class(){return W(h().settingsSubTrigger,`tsqd-settings-menu-sub-trigger`,`tsqd-settings-menu-sub-trigger-disabled-queries`)},get children(){return[Hl(),T(wc,{})]}}),T(X.Portal,{ref:e=>F(e),get mount(){return r(()=>!!_().pipWindow)()?_().pipWindow.document.body:document.body},get children(){return T(X.SubContent,{get class(){return W(h().settingsMenu,`tsqd-settings-submenu`)},get children(){return T(X.RadioGroup,{get value(){return j()?`true`:`false`},"aria-label":`Hide disabled queries setting`,onChange:e=>t.setLocalStore(`hideDisabledQueries`,e),get children(){return[T(X.RadioItem,{value:`false`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-show`)},get children(){return[Ul(),T(L,{get when(){return!j()},get children(){return T(Hc,{})}})]}}),T(X.RadioItem,{value:`true`,get class(){return W(h().settingsSubButton,`tsqd-settings-menu-position-btn`,`tsqd-settings-menu-position-btn-hide`)},get children(){return[Wl(),T(L,{get when(){return j()},get children(){return T(Hc,{})}})]}})]}})}})}})]}})]}})}})]}}),null),I(o,T(L,{get when(){return v()===`queries`},get children(){var t=Gl(),n=t.firstChild;return I(n,T(vt,{by:e=>e.queryHash,get each(){return M()},children:e=>T(fu,{get query(){return e()}})})),e(()=>N(t,W(h().overflowQueryContainer,`tsqd-queries-overflow-container`))),t}}),null),I(o,T(L,{get when(){return v()===`mutations`},get children(){var t=Kl(),n=t.firstChild;return I(n,T(vt,{by:e=>e.mutationId,get each(){return P()},children:e=>T(pu,{get mutation(){return e()}})})),e(()=>N(t,W(h().overflowQueryContainer,`tsqd-mutations-overflow-container`))),t}}),null),e(e=>{var t=W(h().queriesContainer,c()<796&&(n()||a())&&m`
              height: 50%;
              max-height: 50%;
            `,c()<796&&!(n()||a())&&m`
              height: 100%;
              max-height: 100%;
            `,`tsqd-queries-container`),r=W(h().row,`tsqd-header`),i=h().logoAndToggleContainer,s=W(h().logo,`tsqd-text-logo-container`),u=W(h().tanstackLogo,`tsqd-text-logo-tanstack`),d=W(h().queryFlavorLogo,`tsqd-text-logo-query-flavor`),f=W(h().row,`tsqd-filters-actions-container`),_=W(h().filtersContainer,`tsqd-filters-container`),y=W(h().filterInput,`tsqd-query-filter-textfield-container`),b=W(`tsqd-query-filter-textfield`),x=W(h().filterSelect,`tsqd-query-filter-sort-container`),C=`Sort order ${(v()===`queries`?S():E())===-1?`descending`:`ascending`}`,w=(v()===`queries`?S():E())===-1,T=W(h().actionsContainer,`tsqd-actions-container`),O=W(h().actionsBtn,`tsqd-actions-btn`,`tsqd-action-clear-cache`),k=`Clear ${v()} cache`,A=W(h().actionsBtn,l()&&h().actionsBtnOffline,`tsqd-actions-btn`,`tsqd-action-mock-offline-behavior`),j=`${l()?`Unset offline mocking behavior`:`Mock offline behavior`}`,M=l(),ne=`${l()?`Unset offline mocking behavior`:`Mock offline behavior`}`;return t!==e.e&&N(o,e.e=t),r!==e.t&&N(p,e.t=r),i!==e.a&&N(g,e.a=i),s!==e.o&&N(ee,e.o=s),u!==e.i&&N(D,e.i=u),d!==e.n&&N(te,e.n=d),f!==e.s&&N(ie,e.s=f),_!==e.h&&N(R,e.h=_),y!==e.r&&N(ae,e.r=y),b!==e.d&&N(oe,e.d=b),x!==e.l&&N(se,e.l=x),C!==e.u&&z(B,`aria-label`,e.u=C),w!==e.c&&z(B,`aria-pressed`,e.c=w),T!==e.w&&N(ce,e.w=T),O!==e.m&&N(le,e.m=O),k!==e.f&&z(le,`title`,e.f=k),A!==e.y&&N(ue,e.y=A),j!==e.g&&z(ue,`aria-label`,e.g=j),M!==e.p&&z(ue,`aria-pressed`,e.p=M),ne!==e.b&&z(ue,`title`,e.b=ne),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0,c:void 0,w:void 0,m:void 0,f:void 0,y:void 0,g:void 0,p:void 0,b:void 0}),e(()=>oe.value=v()===`queries`?t.localStore.filter||``:t.localStore.mutationFilter||``),o})(),T(L,{get when(){return r(()=>v()===`queries`)()&&n()},get children(){return T(_u,{})}}),T(L,{get when(){return r(()=>v()===`mutations`)()&&a()},get children(){return T(vu,{})}})]},fu=t=>{let{selectedQueryHash:n,setSelectedQueryHash:r}=je(),i=Q(),o=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,s=B(()=>i()===`dark`?Tu(o):wu(o)),{colors:c,alpha:l}=Z,u=(e,t)=>i()===`dark`?t:e,d=$(e=>e().get(t.query.queryHash)?.state,!0,e=>e.query.queryHash===t.query.queryHash),f=$(e=>e().get(t.query.queryHash)?.isDisabled()??!1,!0,e=>e.query.queryHash===t.query.queryHash),p=$(e=>e().get(t.query.queryHash)?.isStatic()??!1,!0,e=>e.query.queryHash===t.query.queryHash),m=$(e=>e().get(t.query.queryHash)?.isStale()??!1,!0,e=>e.query.queryHash===t.query.queryHash),h=$(e=>e().get(t.query.queryHash)?.getObserversCount()??0,!0,e=>e.query.queryHash===t.query.queryHash),g=B(()=>a({queryState:d(),observerCount:h(),isStale:m()})),_=()=>g()===`gray`?o`
        background-color: ${u(c[g()][200],c[g()][700])};
        color: ${u(c[g()][700],c[g()][300])};
      `:o`
      background-color: ${u(c[g()][200]+l[80],c[g()][900])};
      color: ${u(c[g()][800],c[g()][300])};
    `;return T(L,{get when(){return d()},get children(){var i=Zl(),a=i.firstChild,o=a.nextSibling;return i.$$click=()=>r(t.query.queryHash===n()?null:t.query.queryHash),I(a,h),I(o,()=>t.query.queryHash),I(i,T(L,{get when(){return f()},get children(){return Yl()}}),null),I(i,T(L,{get when(){return p()},get children(){return Xl()}}),null),e(e=>{var r=W(s().queryRow,n()===t.query.queryHash&&s().selectedQueryRow,`tsqd-query-row`),o=`Query key ${t.query.queryHash}${f()?`, disabled`:``}${p()?`, static`:``}`,c=W(_(),`tsqd-query-observer-count`);return r!==e.e&&N(i,e.e=r),o!==e.t&&z(i,`aria-label`,e.t=o),c!==e.a&&N(a,e.a=c),e},{e:void 0,t:void 0,a:void 0}),i}})},pu=t=>{let{selectedMutationId:n,setSelectedMutationId:i}=je(),a=Q(),o=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,s=B(()=>a()===`dark`?Tu(o):wu(o)),{colors:c,alpha:l}=Z,u=(e,t)=>a()===`dark`?t:e,d=xu(e=>e().getAll().find(e=>e.mutationId===t.mutation.mutationId)?.state),f=xu(e=>{let n=e().getAll().find(e=>e.mutationId===t.mutation.mutationId);return n?n.state.isPaused:!1}),p=xu(e=>{let n=e().getAll().find(e=>e.mutationId===t.mutation.mutationId);return n?n.state.status:`idle`}),m=B(()=>re({isPaused:f(),status:p()})),h=()=>m()===`gray`?o`
        background-color: ${u(c[m()][200],c[m()][700])};
        color: ${u(c[m()][700],c[m()][300])};
      `:o`
      background-color: ${u(c[m()][200]+l[80],c[m()][900])};
      color: ${u(c[m()][800],c[m()][300])};
    `;return T(L,{get when(){return d()},get children(){var a=Zl(),o=a.firstChild,c=o.nextSibling;return a.$$click=()=>{i(t.mutation.mutationId===n()?null:t.mutation.mutationId)},I(o,T(L,{get when(){return m()===`purple`},get children(){return T(Gc,{})}}),null),I(o,T(L,{get when(){return m()===`green`},get children(){return T(Hc,{})}}),null),I(o,T(L,{get when(){return m()===`red`},get children(){return T(Wc,{})}}),null),I(o,T(L,{get when(){return m()===`yellow`},get children(){return T(Uc,{})}}),null),I(c,T(L,{get when(){return t.mutation.options.mutationKey},get children(){return[r(()=>JSON.stringify(t.mutation.options.mutationKey)),` -`,` `]}}),null),I(c,()=>new Date(t.mutation.state.submittedAt).toLocaleString(),null),e(e=>{var r=W(s().queryRow,n()===t.mutation.mutationId&&s().selectedQueryRow,`tsqd-query-row`),i=`Mutation submitted at ${new Date(t.mutation.state.submittedAt).toLocaleString()}`,c=W(h(),`tsqd-query-observer-count`);return r!==e.e&&N(a,e.e=r),i!==e.t&&z(a,`aria-label`,e.t=i),c!==e.a&&N(o,e.a=c),e},{e:void 0,t:void 0,a:void 0}),a}})},mu=()=>{let t=$(e=>e().getAll().filter(e=>R(e)===`stale`).length),n=$(e=>e().getAll().filter(e=>R(e)===`fresh`).length),r=$(e=>e().getAll().filter(e=>R(e)===`fetching`).length),i=$(e=>e().getAll().filter(e=>R(e)===`paused`).length),a=$(e=>e().getAll().filter(e=>R(e)===`inactive`).length),o=Q(),s=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,c=B(()=>o()===`dark`?Tu(s):wu(s));return(()=>{var o=wl();return I(o,T(gu,{label:`Fresh`,color:`green`,get count(){return n()}}),null),I(o,T(gu,{label:`Fetching`,color:`blue`,get count(){return r()}}),null),I(o,T(gu,{label:`Paused`,color:`purple`,get count(){return i()}}),null),I(o,T(gu,{label:`Stale`,color:`yellow`,get count(){return t()}}),null),I(o,T(gu,{label:`Inactive`,color:`gray`,get count(){return a()}}),null),e(()=>N(o,W(c().queryStatusContainer,`tsqd-query-status-container`))),o})()},hu=()=>{let t=xu(e=>e().getAll().filter(e=>re({isPaused:e.state.isPaused,status:e.state.status})===`green`).length),n=xu(e=>e().getAll().filter(e=>re({isPaused:e.state.isPaused,status:e.state.status})===`yellow`).length),r=xu(e=>e().getAll().filter(e=>re({isPaused:e.state.isPaused,status:e.state.status})===`purple`).length),i=xu(e=>e().getAll().filter(e=>re({isPaused:e.state.isPaused,status:e.state.status})===`red`).length),a=Q(),o=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,s=B(()=>a()===`dark`?Tu(o):wu(o));return(()=>{var a=wl();return I(a,T(gu,{label:`Paused`,color:`purple`,get count(){return r()}}),null),I(a,T(gu,{label:`Pending`,color:`yellow`,get count(){return n()}}),null),I(a,T(gu,{label:`Success`,color:`green`,get count(){return t()}}),null),I(a,T(gu,{label:`Error`,color:`red`,get count(){return i()}}),null),e(()=>N(a,W(s().queryStatusContainer,`tsqd-query-status-container`))),a})()},gu=t=>{let{selectedQueryHash:n,panelWidth:i}=je(),a=Q(),s=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,c=B(()=>a()===`dark`?Tu(s):wu(s)),{colors:l,alpha:u}=Z,d=(e,t)=>a()===`dark`?t:e,p,[m,h]=o(!1),[g,_]=o(!1),v=B(()=>!(n()&&i()<1024&&i()>796||i()<796));return(()=>{var n=eu(),i=n.firstChild,a=i.nextSibling,o=p;return typeof o==`function`?f(o,n):p=n,n.addEventListener(`mouseleave`,()=>{h(!1),_(!1)}),n.addEventListener(`mouseenter`,()=>h(!0)),n.addEventListener(`blur`,()=>_(!1)),n.addEventListener(`focus`,()=>_(!0)),x(n,P({get disabled(){return v()},get"aria-label"(){return`${t.label}: ${t.count}`},get class(){return W(c().queryStatusTag,!v()&&s`
            cursor: pointer;
            &:hover {
              background: ${d(l.gray[200],l.darkGray[400])}${u[80]};
            }
          `,`tsqd-query-status-tag`,`tsqd-query-status-tag-${t.label.toLowerCase()}`)}},()=>m()||g()?{"aria-describedby":`tsqd-status-tooltip`}:{}),!1,!0),I(n,T(L,{get when(){return r(()=>!v())()&&(m()||g())},get children(){var n=Ql();return I(n,()=>t.label),e(()=>N(n,W(c().statusTooltip,`tsqd-query-status-tooltip`))),n}}),i),I(n,T(L,{get when(){return v()},get children(){var n=$l();return I(n,()=>t.label),e(()=>N(n,W(c().queryStatusTagLabel,`tsqd-query-status-tag-label`))),n}}),a),I(a,()=>t.count),e(e=>{var n=W(s`
            width: ${Z.size[1.5]};
            height: ${Z.size[1.5]};
            border-radius: ${Z.border.radius.full};
            background-color: ${Z.colors[t.color][500]};
          `,`tsqd-query-status-tag-dot`),r=W(c().queryStatusCount,t.count>0&&t.color!==`gray`&&s`
              background-color: ${d(l[t.color][100],l[t.color][900])};
              color: ${d(l[t.color][700],l[t.color][300])};
            `,`tsqd-query-status-tag-count`);return n!==e.e&&N(i,e.e=n),r!==e.t&&N(a,e.t=r),e},{e:void 0,t:void 0}),n})()},_u=()=>{let{selectedQueryHash:t,setSelectedQueryHash:n}=je(),i=Q(),a=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,s=B(()=>i()===`dark`?Tu(a):wu(a)),{colors:c}=Z,u=(e,t)=>i()===`dark`?t:e,f=H().client,[p,m]=o(!1),[g,_]=o(`view`),[v,y]=o(!1),b=B(()=>H().errorTypes||[]),x=$(e=>e().getAll().find(e=>e.queryHash===t()),!1),S=$(e=>e().getAll().find(e=>e.queryHash===t()),!1),C=$(e=>e().getAll().find(e=>e.queryHash===t())?.state,!1),w=$(e=>e().getAll().find(e=>e.queryHash===t())?.state.data,!1),E=$(e=>{let n=e().getAll().find(e=>e.queryHash===t());return n?R(n):`inactive`}),D=$(e=>{let n=e().getAll().find(e=>e.queryHash===t());return n?n.state.status:`pending`}),O=$(e=>e().getAll().find(e=>e.queryHash===t())?.getObserversCount()??0),k=B(()=>h(E())),A=()=>{Su({type:`REFETCH`,queryHash:x()?.queryHash}),(x()?.fetch())?.catch(()=>{})},j=e=>{let t=x();if(!t)return;Su({type:`TRIGGER_ERROR`,queryHash:t.queryHash,metadata:{error:e?.name}});let n=e?.initializer(t)??Error(`Unknown error from devtools`),r=t.options;t.setState({data:void 0,status:`error`,error:n,fetchMeta:{...t.state.fetchMeta,__previousQueryOptions:r}})},M=()=>{let e=x();if(!e)return;Su({type:`RESTORE_LOADING`,queryHash:e.queryHash});let t=e.state,n=e.state.fetchMeta?e.state.fetchMeta.__previousQueryOptions:null;e.cancel({silent:!0}),e.setState({...t,fetchStatus:`idle`,fetchMeta:null}),n&&e.fetch(n)};l(()=>{E()!==`fetching`&&m(!1)});let ne=()=>k()===`gray`?a`
        background-color: ${u(c[k()][200],c[k()][700])};
        color: ${u(c[k()][700],c[k()][300])};
        border-color: ${u(c[k()][400],c[k()][600])};
      `:a`
      background-color: ${u(c[k()][100],c[k()][900])};
      color: ${u(c[k()][700],c[k()][300])};
      border-color: ${u(c[k()][400],c[k()][600])};
    `;return T(L,{get when(){return r(()=>!!x())()&&C()},get children(){var t=au(),r=t.firstChild,i=r.nextSibling,o=i.firstChild,l=o.firstChild,h=l.firstChild,k=l.nextSibling,P=o.nextSibling,re=P.firstChild.nextSibling,F=P.nextSibling.firstChild.nextSibling,ie=i.nextSibling,R=ie.nextSibling,ae=R.firstChild,oe=ae.firstChild,se=ae.nextSibling,B=se.firstChild,ce=se.nextSibling,le=ce.firstChild,ue=ce.nextSibling,de=ue.firstChild,fe=ue.nextSibling,V=fe.firstChild,pe=V.nextSibling,me=R.nextSibling;me.firstChild;var he=me.nextSibling,ge=he.nextSibling;return I(h,()=>te(x().queryKey,!0)),I(k,E),I(re,O),I(F,()=>new Date(C().dataUpdatedAt).toLocaleTimeString()),ae.$$click=A,se.$$click=()=>{Su({type:`INVALIDATE`,queryHash:x()?.queryHash}),f.invalidateQueries({queryKey:x()?.queryKey,exact:!0})},ce.$$click=()=>{Su({type:`RESET`,queryHash:x()?.queryHash}),f.resetQueries({queryKey:x()?.queryKey,exact:!0})},ue.$$click=()=>{Su({type:`REMOVE`,queryHash:x()?.queryHash}),f.removeQueries({queryKey:x()?.queryKey,exact:!0}),n(null)},fe.$$click=()=>{if(x()?.state.data===void 0)m(!0),M();else{let e=x();if(!e)return;Su({type:`TRIGGER_LOADING`,queryHash:e.queryHash});let t=e.options;e.fetch({...t,queryFn:()=>new Promise(()=>{}),gcTime:-1}),e.setState({data:void 0,status:`pending`,fetchMeta:{...e.state.fetchMeta,__previousQueryOptions:t}})}},I(fe,()=>D()===`pending`?`Restore`:`Trigger`,pe),I(R,T(L,{get when(){return b().length===0||D()===`error`},get children(){var t=tu(),n=t.firstChild,r=n.nextSibling;return t.$$click=()=>{x().state.error?(Su({type:`RESTORE_ERROR`,queryHash:x()?.queryHash}),f.resetQueries({queryKey:x()?.queryKey})):j()},I(t,()=>D()===`error`?`Restore`:`Trigger`,r),e(e=>{var r=W(a`
                  color: ${u(c.red[500],c.red[400])};
                `,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-error`),i=D()===`pending`,o=a`
                  background-color: ${u(c.red[500],c.red[400])};
                `;return r!==e.e&&N(t,e.e=r),i!==e.t&&(t.disabled=e.t=i),o!==e.a&&N(n,e.a=o),e},{e:void 0,t:void 0,a:void 0}),t}}),null),I(R,T(L,{get when(){return b().length!==0&&D()!==`error`},get children(){var t=nu(),n=t.firstChild,r=n.nextSibling.nextSibling;return r.firstChild,r.addEventListener(`change`,e=>{let t=b().find(t=>t.name===e.currentTarget.value);j(t)}),I(r,T(ee,{get each(){return b()},children:t=>(()=>{var n=ou();return I(n,()=>t.name),e(()=>n.value=t.name),n})()}),null),I(t,T(wc,{}),null),e(e=>{var i=W(s().actionsSelect,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-error-multiple`),o=a`
                  background-color: ${Z.colors.red[400]};
                `,c=D()===`pending`;return i!==e.e&&N(t,e.e=i),o!==e.t&&N(n,e.t=o),c!==e.a&&(r.disabled=e.a=c),e},{e:void 0,t:void 0,a:void 0}),t}}),null),I(me,()=>g()===`view`?`Explorer`:`Editor`,null),I(t,T(L,{get when(){return g()===`view`},get children(){var t=ru();return I(t,T(yl,{label:`Data`,defaultExpanded:[`Data`],get value(){return w()},editable:!0,onEdit:()=>_(`edit`),get activeQuery(){return x()}})),e(e=>d(t,`padding`,Z.size[2])),t}}),he),I(t,T(L,{get when(){return g()===`edit`},get children(){var t=iu(),n=t.firstChild,r=n.nextSibling,i=r.firstChild,o=i.nextSibling,l=o.firstChild,d=l.nextSibling;return t.addEventListener(`submit`,e=>{e.preventDefault();let t=new FormData(e.currentTarget).get(`data`);try{let e=JSON.parse(t);x().setState({...x().state,data:e}),_(`view`)}catch{y(!0)}}),n.addEventListener(`focus`,()=>y(!1)),I(i,()=>v()?`Invalid Value`:``),l.$$click=()=>_(`view`),e(e=>{var f=W(s().devtoolsEditForm,`tsqd-query-details-data-editor`),p=s().devtoolsEditTextarea,m=v(),h=s().devtoolsEditFormActions,g=s().devtoolsEditFormError,_=s().devtoolsEditFormActionContainer,y=W(s().devtoolsEditFormAction,a`
                      color: ${u(c.gray[600],c.gray[300])};
                    `),b=W(s().devtoolsEditFormAction,a`
                      color: ${u(c.blue[600],c.blue[400])};
                    `);return f!==e.e&&N(t,e.e=f),p!==e.t&&N(n,e.t=p),m!==e.a&&z(n,`data-error`,e.a=m),h!==e.o&&N(r,e.o=h),g!==e.i&&N(i,e.i=g),_!==e.n&&N(o,e.n=_),y!==e.s&&N(l,e.s=y),b!==e.h&&N(d,e.h=b),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0}),e(()=>n.value=JSON.stringify(w(),null,2)),t}}),he),I(ge,T(yl,{label:`Query`,defaultExpanded:[`Query`,`queryKey`],get value(){return S()}})),e(e=>{var n=W(s().detailsContainer,`tsqd-query-details-container`),o=W(s().detailsHeader,`tsqd-query-details-header`),l=W(s().detailsBody,`tsqd-query-details-summary-container`),f=W(s().queryDetailsStatus,ne()),m=W(s().detailsHeader,`tsqd-query-details-header`),h=W(s().actionsBody,`tsqd-query-details-actions-container`),g=W(a`
                color: ${u(c.blue[600],c.blue[400])};
              `,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-refetch`),_=E()===`fetching`,v=a`
                background-color: ${u(c.blue[600],c.blue[400])};
              `,y=W(a`
                color: ${u(c.yellow[600],c.yellow[400])};
              `,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-invalidate`),b=D()===`pending`,x=a`
                background-color: ${u(c.yellow[600],c.yellow[400])};
              `,S=W(a`
                color: ${u(c.gray[600],c.gray[300])};
              `,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-reset`),C=D()===`pending`,w=a`
                background-color: ${u(c.gray[600],c.gray[400])};
              `,T=W(a`
                color: ${u(c.pink[500],c.pink[400])};
              `,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-remove`),ee=E()===`fetching`,O=a`
                background-color: ${u(c.pink[500],c.pink[400])};
              `,A=W(a`
                color: ${u(c.cyan[500],c.cyan[400])};
              `,`tsqd-query-details-actions-btn`,`tsqd-query-details-action-loading`),te=p(),j=a`
                background-color: ${u(c.cyan[500],c.cyan[400])};
              `,M=W(s().detailsHeader,`tsqd-query-details-header`),P=W(s().detailsHeader,`tsqd-query-details-header`),re=Z.size[2];return n!==e.e&&N(t,e.e=n),o!==e.t&&N(r,e.t=o),l!==e.a&&N(i,e.a=l),f!==e.o&&N(k,e.o=f),m!==e.i&&N(ie,e.i=m),h!==e.n&&N(R,e.n=h),g!==e.s&&N(ae,e.s=g),_!==e.h&&(ae.disabled=e.h=_),v!==e.r&&N(oe,e.r=v),y!==e.d&&N(se,e.d=y),b!==e.l&&(se.disabled=e.l=b),x!==e.u&&N(B,e.u=x),S!==e.c&&N(ce,e.c=S),C!==e.w&&(ce.disabled=e.w=C),w!==e.m&&N(le,e.m=w),T!==e.f&&N(ue,e.f=T),ee!==e.y&&(ue.disabled=e.y=ee),O!==e.g&&N(de,e.g=O),A!==e.p&&N(fe,e.p=A),te!==e.b&&(fe.disabled=e.b=te),j!==e.T&&N(V,e.T=j),M!==e.A&&N(me,e.A=M),P!==e.O&&N(he,e.O=P),re!==e.I&&d(ge,`padding`,e.I=re),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0,c:void 0,w:void 0,m:void 0,f:void 0,y:void 0,g:void 0,p:void 0,b:void 0,T:void 0,A:void 0,O:void 0,I:void 0}),t}})},vu=()=>{let{selectedMutationId:t}=je(),n=Q(),r=H().shadowDOMTarget?U.bind({target:H().shadowDOMTarget}):U,i=B(()=>n()===`dark`?Tu(r):wu(r)),{colors:a}=Z,o=(e,t)=>n()===`dark`?t:e,s=xu(e=>{let n=e().getAll().find(e=>e.mutationId===t());return n?n.state.isPaused:!1}),c=xu(e=>{let n=e().getAll().find(e=>e.mutationId===t());return n?n.state.status:`idle`}),l=B(()=>re({isPaused:s(),status:c()})),u=xu(e=>e().getAll().find(e=>e.mutationId===t()),!1),f=()=>l()===`gray`?r`
        background-color: ${o(a[l()][200],a[l()][700])};
        color: ${o(a[l()][700],a[l()][300])};
        border-color: ${o(a[l()][400],a[l()][600])};
      `:r`
      background-color: ${o(a[l()][100],a[l()][900])};
      color: ${o(a[l()][700],a[l()][300])};
      border-color: ${o(a[l()][400],a[l()][600])};
    `;return T(L,{get when(){return u()},get children(){var t=su(),n=t.firstChild,r=n.nextSibling,a=r.firstChild,o=a.firstChild,s=o.firstChild,p=o.nextSibling,m=a.nextSibling.firstChild.nextSibling,h=r.nextSibling,g=h.nextSibling,_=g.nextSibling,v=_.nextSibling,y=v.nextSibling,b=y.nextSibling,x=b.nextSibling,S=x.nextSibling;return I(s,T(L,{get when(){return u().options.mutationKey},fallback:`No mutationKey found`,get children(){return te(u().options.mutationKey,!0)}})),I(p,T(L,{get when(){return l()===`purple`},children:`pending`}),null),I(p,T(L,{get when(){return l()!==`purple`},get children(){return c()}}),null),I(m,()=>new Date(u().state.submittedAt).toLocaleTimeString()),I(g,T(yl,{label:`Variables`,defaultExpanded:[`Variables`],get value(){return u().state.variables}})),I(v,T(yl,{label:`Context`,defaultExpanded:[`Context`],get value(){return u().state.context}})),I(b,T(yl,{label:`Data`,defaultExpanded:[`Data`],get value(){return u().state.data}})),I(S,T(yl,{label:`Mutation`,defaultExpanded:[`Mutation`],get value(){return u()}})),e(e=>{var a=W(i().detailsContainer,`tsqd-query-details-container`),o=W(i().detailsHeader,`tsqd-query-details-header`),s=W(i().detailsBody,`tsqd-query-details-summary-container`),c=W(i().queryDetailsStatus,f()),l=W(i().detailsHeader,`tsqd-query-details-header`),u=Z.size[2],m=W(i().detailsHeader,`tsqd-query-details-header`),C=Z.size[2],w=W(i().detailsHeader,`tsqd-query-details-header`),T=Z.size[2],E=W(i().detailsHeader,`tsqd-query-details-header`),ee=Z.size[2];return a!==e.e&&N(t,e.e=a),o!==e.t&&N(n,e.t=o),s!==e.a&&N(r,e.a=s),c!==e.o&&N(p,e.o=c),l!==e.i&&N(h,e.i=l),u!==e.n&&d(g,`padding`,e.n=u),m!==e.s&&N(_,e.s=m),C!==e.h&&d(v,`padding`,e.h=C),w!==e.r&&N(y,e.r=w),T!==e.d&&d(b,`padding`,e.d=T),E!==e.l&&N(x,e.l=E),ee!==e.u&&d(S,`padding`,e.u=ee),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0}),t}})},yu=()=>{let{queryCacheSubscriptions:e}=Oe(),t=B(()=>H().client.getQueryCache());l(()=>{let r=t(),i=r.subscribe(t=>{E(()=>{e.notify(()=>r,t)})});n(i)})},$=(e,t=!0,n=()=>!0)=>{let{queryCacheSubscriptions:r}=Oe(),i=B(()=>H().client.getQueryCache()),[a,s]=o(e(i),t?void 0:{equals:!1});return l(()=>{s(e(i))}),r.register(e,s,n),a},bu=()=>{let{mutationCacheSubscriptions:e}=Oe(),t=B(()=>H().client.getMutationCache());l(()=>{let r=t(),i=!0,a=r.subscribe(t=>{e.notify(()=>r,t,e=>{queueMicrotask(()=>{i&&e()})})});n(()=>{i=!1,a()})})},xu=(e,t=!0)=>{let{mutationCacheSubscriptions:n}=Oe(),r=B(()=>H().client.getMutationCache()),[i,a]=o(e(r),t?void 0:{equals:!1});return l(()=>{a(e(r))}),n.register(e,a),i},Su=({type:e,queryHash:t,metadata:n})=>{let r=new CustomEvent(`@tanstack/query-devtools-event`,{detail:{type:e,queryHash:t,metadata:n},bubbles:!0,cancelable:!0});window.dispatchEvent(r)},Cu=(e,t)=>{let{colors:n,font:r,size:i,alpha:a,shadow:o,border:s}=Z,c=(t,n)=>e===`light`?t:n;return{devtoolsBtn:t`
      z-index: 100000;
      position: fixed;
      padding: 4px;
      text-align: left;

      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      box-shadow: ${o.md()};
      overflow: hidden;

      & div {
        position: absolute;
        top: -8px;
        left: -8px;
        right: -8px;
        bottom: -8px;
        border-radius: 9999px;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);

        & svg {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        filter: blur(6px) saturate(1.2) contrast(1.1);
      }

      &:focus-within {
        outline-offset: 2px;
        outline: 3px solid ${n.green[600]};
      }

      & button {
        position: relative;
        z-index: 1;
        padding: 0;
        border-radius: 9999px;
        background-color: transparent;
        border: none;
        height: 40px;
        display: flex;
        width: 40px;
        overflow: hidden;
        cursor: pointer;
        outline: none;
        & svg {
          position: absolute;
          width: 100%;
          height: 100%;
        }
      }
    `,panel:t`
      position: fixed;
      z-index: 9999;
      display: flex;
      gap: ${Z.size[.5]};
      & * {
        box-sizing: border-box;
        text-transform: none;
      }

      & *::-webkit-scrollbar {
        width: 7px;
      }

      & *::-webkit-scrollbar-track {
        background: transparent;
      }

      & *::-webkit-scrollbar-thumb {
        background: ${c(n.gray[300],n.darkGray[200])};
      }

      & *::-webkit-scrollbar-thumb:hover {
        background: ${c(n.gray[400],n.darkGray[300])};
      }
    `,parentPanel:t`
      z-index: 9999;
      display: flex;
      height: 100%;
      gap: ${Z.size[.5]};
      & * {
        box-sizing: border-box;
        text-transform: none;
      }

      & *::-webkit-scrollbar {
        width: 7px;
      }

      & *::-webkit-scrollbar-track {
        background: transparent;
      }

      & *::-webkit-scrollbar-thumb {
        background: ${c(n.gray[300],n.darkGray[200])};
      }

      & *::-webkit-scrollbar-thumb:hover {
        background: ${c(n.gray[400],n.darkGray[300])};
      }
    `,"devtoolsBtn-position-bottom-right":t`
      bottom: 12px;
      right: 12px;
    `,"devtoolsBtn-position-bottom-left":t`
      bottom: 12px;
      left: 12px;
    `,"devtoolsBtn-position-top-left":t`
      top: 12px;
      left: 12px;
    `,"devtoolsBtn-position-top-right":t`
      top: 12px;
      right: 12px;
    `,"devtoolsBtn-position-relative":t`
      position: relative;
    `,"panel-position-top":t`
      top: 0;
      right: 0;
      left: 0;
      max-height: 90%;
      min-height: ${i[14]};
      border-bottom: ${c(n.gray[400],n.darkGray[300])} 1px solid;
    `,"panel-position-bottom":t`
      bottom: 0;
      right: 0;
      left: 0;
      max-height: 90%;
      min-height: ${i[14]};
      border-top: ${c(n.gray[400],n.darkGray[300])} 1px solid;
    `,"panel-position-right":t`
      bottom: 0;
      right: 0;
      top: 0;
      border-left: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      max-width: 90%;
    `,"panel-position-left":t`
      bottom: 0;
      left: 0;
      top: 0;
      border-right: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      max-width: 90%;
    `,closeBtn:t`
      position: absolute;
      cursor: pointer;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      background-color: ${c(n.gray[50],n.darkGray[700])};
      &:hover {
        background-color: ${c(n.gray[200],n.darkGray[500])};
      }
      &:focus-visible {
        outline: 2px solid ${n.blue[600]};
      }
      & svg {
        color: ${c(n.gray[600],n.gray[400])};
        width: ${i[2]};
        height: ${i[2]};
      }
    `,"closeBtn-position-top":t`
      bottom: 0;
      right: ${i[2]};
      transform: translate(0, 100%);
      border-right: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-left: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-top: none;
      border-bottom: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-radius: 0px 0px ${s.radius.sm} ${s.radius.sm};
      padding: ${i[.5]} ${i[1.5]} ${i[1]} ${i[1.5]};

      &::after {
        content: ' ';
        position: absolute;
        bottom: 100%;
        left: -${i[2.5]};
        height: ${i[1.5]};
        width: calc(100% + ${i[5]});
      }

      & svg {
        transform: rotate(180deg);
      }
    `,"closeBtn-position-bottom":t`
      top: 0;
      right: ${i[2]};
      transform: translate(0, -100%);
      border-right: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-left: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-top: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-bottom: none;
      border-radius: ${s.radius.sm} ${s.radius.sm} 0px 0px;
      padding: ${i[1]} ${i[1.5]} ${i[.5]} ${i[1.5]};

      &::after {
        content: ' ';
        position: absolute;
        top: 100%;
        left: -${i[2.5]};
        height: ${i[1.5]};
        width: calc(100% + ${i[5]});
      }
    `,"closeBtn-position-right":t`
      bottom: ${i[2]};
      left: 0;
      transform: translate(-100%, 0);
      border-right: none;
      border-left: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-top: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-bottom: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-radius: ${s.radius.sm} 0px 0px ${s.radius.sm};
      padding: ${i[1.5]} ${i[.5]} ${i[1.5]} ${i[1]};

      &::after {
        content: ' ';
        position: absolute;
        left: 100%;
        height: calc(100% + ${i[5]});
        width: ${i[1.5]};
      }

      & svg {
        transform: rotate(-90deg);
      }
    `,"closeBtn-position-left":t`
      bottom: ${i[2]};
      right: 0;
      transform: translate(100%, 0);
      border-left: none;
      border-right: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-top: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-bottom: ${c(n.gray[400],n.darkGray[300])} 1px solid;
      border-radius: 0px ${s.radius.sm} ${s.radius.sm} 0px;
      padding: ${i[1.5]} ${i[1]} ${i[1.5]} ${i[.5]};

      &::after {
        content: ' ';
        position: absolute;
        right: 100%;
        height: calc(100% + ${i[5]});
        width: ${i[1.5]};
      }

      & svg {
        transform: rotate(90deg);
      }
    `,queriesContainer:t`
      flex: 1 1 700px;
      background-color: ${c(n.gray[50],n.darkGray[700])};
      display: flex;
      flex-direction: column;
      & * {
        font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      }
    `,dragHandle:t`
      position: absolute;
      transition: background-color 0.125s ease;
      &:hover {
        background-color: ${n.purple[400]}${c(``,a[90])};
      }
      &:focus {
        outline: none;
        background-color: ${n.purple[400]}${c(``,a[90])};
      }
      &:focus-visible {
        outline: 2px solid ${n.blue[800]};
        outline-offset: -2px;
        background-color: ${n.purple[400]}${c(``,a[90])};
      }
      z-index: 4;
    `,"dragHandle-position-top":t`
      bottom: 0;
      width: 100%;
      height: 3px;
      cursor: ns-resize;
    `,"dragHandle-position-bottom":t`
      top: 0;
      width: 100%;
      height: 3px;
      cursor: ns-resize;
    `,"dragHandle-position-right":t`
      left: 0;
      width: 3px;
      height: 100%;
      cursor: ew-resize;
    `,"dragHandle-position-left":t`
      right: 0;
      width: 3px;
      height: 100%;
      cursor: ew-resize;
    `,row:t`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${Z.size[2]} ${Z.size[2.5]};
      gap: ${Z.size[2.5]};
      border-bottom: ${c(n.gray[300],n.darkGray[500])} 1px solid;
      align-items: center;
      & > button {
        padding: 0;
        background: transparent;
        border: none;
        display: flex;
        gap: ${i[.5]};
        flex-direction: column;
      }
    `,logoAndToggleContainer:t`
      display: flex;
      gap: ${Z.size[3]};
      align-items: center;
    `,logo:t`
      cursor: pointer;
      display: flex;
      flex-direction: column;
      background-color: transparent;
      border: none;
      gap: ${Z.size[.5]};
      padding: 0px;
      &:hover {
        opacity: 0.7;
      }
      &:focus-visible {
        outline-offset: 4px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
    `,tanstackLogo:t`
      font-size: ${r.size.md};
      font-weight: ${r.weight.bold};
      line-height: ${r.lineHeight.xs};
      white-space: nowrap;
      color: ${c(n.gray[600],n.gray[300])};
    `,queryFlavorLogo:t`
      font-weight: ${r.weight.semibold};
      font-size: ${r.size.xs};
      background: linear-gradient(
        to right,
        ${c(`#ea4037, #ff9b11`,`#dd524b, #e9a03b`)}
      );
      background-clip: text;
      -webkit-background-clip: text;
      line-height: 1;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    `,queryStatusContainer:t`
      display: flex;
      gap: ${Z.size[2]};
      height: min-content;
    `,queryStatusTag:t`
      display: flex;
      gap: ${Z.size[1.5]};
      box-sizing: border-box;
      height: ${Z.size[6.5]};
      background: ${c(n.gray[50],n.darkGray[500])};
      color: ${c(n.gray[700],n.gray[300])};
      border-radius: ${Z.border.radius.sm};
      font-size: ${r.size.sm};
      padding: ${Z.size[1]};
      padding-left: ${Z.size[1.5]};
      align-items: center;
      font-weight: ${r.weight.medium};
      border: ${c(`1px solid `+n.gray[300],`1px solid transparent`)};
      user-select: none;
      position: relative;
      &:focus-visible {
        outline-offset: 2px;
        outline: 2px solid ${n.blue[800]};
      }
    `,queryStatusTagLabel:t`
      font-size: ${r.size.xs};
    `,queryStatusCount:t`
      font-size: ${r.size.xs};
      padding: 0 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${c(n.gray[500],n.gray[400])};
      background-color: ${c(n.gray[200],n.darkGray[300])};
      border-radius: 2px;
      font-variant-numeric: tabular-nums;
      height: ${Z.size[4.5]};
    `,statusTooltip:t`
      position: absolute;
      z-index: 1;
      background-color: ${c(n.gray[50],n.darkGray[500])};
      top: 100%;
      left: 50%;
      transform: translate(-50%, calc(${Z.size[2]}));
      padding: ${Z.size[.5]} ${Z.size[2]};
      border-radius: ${Z.border.radius.sm};
      font-size: ${r.size.xs};
      border: 1px solid ${c(n.gray[400],n.gray[600])};
      color: ${c(n.gray[600],n.gray[300])};

      &::before {
        top: 0px;
        content: ' ';
        display: block;
        left: 50%;
        transform: translate(-50%, -100%);
        position: absolute;
        border-color: transparent transparent
          ${c(n.gray[400],n.gray[600])} transparent;
        border-style: solid;
        border-width: 7px;
        /* transform: rotate(180deg); */
      }

      &::after {
        top: 0px;
        content: ' ';
        display: block;
        left: 50%;
        transform: translate(-50%, calc(-100% + 2px));
        position: absolute;
        border-color: transparent transparent
          ${c(n.gray[100],n.darkGray[500])} transparent;
        border-style: solid;
        border-width: 7px;
      }
    `,filtersContainer:t`
      display: flex;
      gap: ${Z.size[2]};
      & > button {
        cursor: pointer;
        padding: ${Z.size[.5]} ${Z.size[1.5]} ${Z.size[.5]}
          ${Z.size[2]};
        border-radius: ${Z.border.radius.sm};
        background-color: ${c(n.gray[100],n.darkGray[400])};
        border: 1px solid ${c(n.gray[300],n.darkGray[200])};
        color: ${c(n.gray[700],n.gray[300])};
        font-size: ${r.size.xs};
        display: flex;
        align-items: center;
        line-height: ${r.lineHeight.sm};
        gap: ${Z.size[1.5]};
        max-width: 160px;
        &:focus-visible {
          outline-offset: 2px;
          border-radius: ${s.radius.xs};
          outline: 2px solid ${n.blue[800]};
        }
        & svg {
          width: ${Z.size[3]};
          height: ${Z.size[3]};
          color: ${c(n.gray[500],n.gray[400])};
        }
      }
    `,filterInput:t`
      padding: ${i[.5]} ${i[2]};
      border-radius: ${Z.border.radius.sm};
      background-color: ${c(n.gray[100],n.darkGray[400])};
      display: flex;
      box-sizing: content-box;
      align-items: center;
      gap: ${Z.size[1.5]};
      max-width: 160px;
      min-width: 100px;
      border: 1px solid ${c(n.gray[300],n.darkGray[200])};
      height: min-content;
      color: ${c(n.gray[600],n.gray[400])};
      & > svg {
        width: ${i[3]};
        height: ${i[3]};
      }
      & input {
        font-size: ${r.size.xs};
        width: 100%;
        background-color: ${c(n.gray[100],n.darkGray[400])};
        border: none;
        padding: 0;
        line-height: ${r.lineHeight.sm};
        color: ${c(n.gray[700],n.gray[300])};
        &::placeholder {
          color: ${c(n.gray[700],n.gray[300])};
        }
        &:focus {
          outline: none;
        }
      }

      &:focus-within {
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
    `,filterSelect:t`
      padding: ${Z.size[.5]} ${Z.size[2]};
      border-radius: ${Z.border.radius.sm};
      background-color: ${c(n.gray[100],n.darkGray[400])};
      display: flex;
      align-items: center;
      gap: ${Z.size[1.5]};
      box-sizing: content-box;
      max-width: 160px;
      border: 1px solid ${c(n.gray[300],n.darkGray[200])};
      height: min-content;
      & > svg {
        color: ${c(n.gray[600],n.gray[400])};
        width: ${Z.size[2]};
        height: ${Z.size[2]};
      }
      & > select {
        appearance: none;
        color: ${c(n.gray[700],n.gray[300])};
        min-width: 100px;
        line-height: ${r.lineHeight.sm};
        font-size: ${r.size.xs};
        background-color: ${c(n.gray[100],n.darkGray[400])};
        border: none;
        &:focus {
          outline: none;
        }
      }
      &:focus-within {
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
    `,actionsContainer:t`
      display: flex;
      gap: ${Z.size[2]};
    `,actionsBtn:t`
      border-radius: ${Z.border.radius.sm};
      background-color: ${c(n.gray[100],n.darkGray[400])};
      border: 1px solid ${c(n.gray[300],n.darkGray[200])};
      width: ${Z.size[6.5]};
      height: ${Z.size[6.5]};
      justify-content: center;
      display: flex;
      align-items: center;
      gap: ${Z.size[1.5]};
      max-width: 160px;
      cursor: pointer;
      padding: 0;
      &:hover {
        background-color: ${c(n.gray[200],n.darkGray[500])};
      }
      & svg {
        color: ${c(n.gray[700],n.gray[300])};
        width: ${Z.size[3]};
        height: ${Z.size[3]};
      }
      &:focus-visible {
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
    `,actionsBtnOffline:t`
      & svg {
        stroke: ${c(n.yellow[700],n.yellow[500])};
        fill: ${c(n.yellow[700],n.yellow[500])};
      }
    `,overflowQueryContainer:t`
      flex: 1;
      overflow-y: auto;
      & > div {
        display: flex;
        flex-direction: column;
      }
    `,queryRow:t`
      display: flex;
      align-items: center;
      padding: 0;
      border: none;
      cursor: pointer;
      color: ${c(n.gray[700],n.gray[300])};
      background-color: ${c(n.gray[50],n.darkGray[700])};
      line-height: 1;
      &:focus {
        outline: none;
      }
      &:focus-visible {
        outline-offset: -2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
      &:hover .tsqd-query-hash {
        background-color: ${c(n.gray[200],n.darkGray[600])};
      }

      & .tsqd-query-observer-count {
        padding: 0 ${Z.size[1]};
        user-select: none;
        min-width: ${Z.size[6.5]};
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${r.size.xs};
        font-weight: ${r.weight.medium};
        border-bottom-width: 1px;
        border-bottom-style: solid;
        border-bottom: 1px solid ${c(n.gray[300],n.darkGray[700])};
      }
      & .tsqd-query-hash {
        user-select: text;
        font-size: ${r.size.xs};
        display: flex;
        align-items: center;
        min-height: ${Z.size[6]};
        flex: 1;
        padding: ${Z.size[1]} ${Z.size[2]};
        font-family:
          ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
        border-bottom: 1px solid ${c(n.gray[300],n.darkGray[400])};
        text-align: left;
        text-overflow: clip;
        word-break: break-word;
      }

      & .tsqd-query-disabled-indicator {
        align-self: stretch;
        display: flex;
        align-items: center;
        padding: 0 ${Z.size[2]};
        color: ${c(n.gray[800],n.gray[300])};
        background-color: ${c(n.gray[300],n.darkGray[600])};
        border-bottom: 1px solid ${c(n.gray[300],n.darkGray[400])};
        font-size: ${r.size.xs};
      }

      & .tsqd-query-static-indicator {
        align-self: stretch;
        display: flex;
        align-items: center;
        padding: 0 ${Z.size[2]};
        color: ${c(n.teal[800],n.teal[300])};
        background-color: ${c(n.teal[100],n.teal[900])};
        border-bottom: 1px solid ${c(n.teal[300],n.teal[700])};
        font-size: ${r.size.xs};
      }
    `,selectedQueryRow:t`
      background-color: ${c(n.gray[200],n.darkGray[500])};
    `,detailsContainer:t`
      flex: 1 1 700px;
      background-color: ${c(n.gray[50],n.darkGray[700])};
      color: ${c(n.gray[700],n.gray[300])};
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      display: flex;
      text-align: left;
    `,detailsHeader:t`
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: ${c(n.gray[200],n.darkGray[600])};
      padding: ${Z.size[1.5]} ${Z.size[2]};
      font-weight: ${r.weight.medium};
      font-size: ${r.size.xs};
      line-height: ${r.lineHeight.xs};
      text-align: left;
    `,detailsBody:t`
      margin: ${Z.size[1.5]} 0px ${Z.size[2]} 0px;
      & > div {
        display: flex;
        align-items: stretch;
        padding: 0 ${Z.size[2]};
        line-height: ${r.lineHeight.sm};
        justify-content: space-between;
        & > span {
          font-size: ${r.size.xs};
        }
        & > span:nth-child(2) {
          font-variant-numeric: tabular-nums;
        }
      }

      & > div:first-child {
        margin-bottom: ${Z.size[1.5]};
      }

      & code {
        font-family:
          ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
        margin: 0;
        font-size: ${r.size.xs};
        line-height: ${r.lineHeight.xs};
        max-width: 100%;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      & pre {
        margin: 0;
        display: flex;
        align-items: center;
      }
    `,queryDetailsStatus:t`
      border: 1px solid ${n.darkGray[200]};
      border-radius: ${Z.border.radius.sm};
      font-weight: ${r.weight.medium};
      padding: ${Z.size[1]} ${Z.size[2.5]};
    `,actionsBody:t`
      flex-wrap: wrap;
      margin: ${Z.size[2]} 0px ${Z.size[2]} 0px;
      display: flex;
      gap: ${Z.size[2]};
      padding: 0px ${Z.size[2]};
      & > button {
        font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
        font-size: ${r.size.xs};
        padding: ${Z.size[1]} ${Z.size[2]};
        display: flex;
        border-radius: ${Z.border.radius.sm};
        background-color: ${c(n.gray[100],n.darkGray[600])};
        border: 1px solid ${c(n.gray[300],n.darkGray[400])};
        align-items: center;
        gap: ${Z.size[2]};
        font-weight: ${r.weight.medium};
        line-height: ${r.lineHeight.xs};
        cursor: pointer;
        &:focus-visible {
          outline-offset: 2px;
          border-radius: ${s.radius.xs};
          outline: 2px solid ${n.blue[800]};
        }
        &:hover {
          background-color: ${c(n.gray[200],n.darkGray[500])};
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        & > span {
          width: ${i[1.5]};
          height: ${i[1.5]};
          border-radius: ${Z.border.radius.full};
        }
      }
    `,actionsSelect:t`
      font-size: ${r.size.xs};
      padding: ${Z.size[.5]} ${Z.size[2]};
      display: flex;
      border-radius: ${Z.border.radius.sm};
      overflow: hidden;
      background-color: ${c(n.gray[100],n.darkGray[600])};
      border: 1px solid ${c(n.gray[300],n.darkGray[400])};
      align-items: center;
      gap: ${Z.size[2]};
      font-weight: ${r.weight.medium};
      line-height: ${r.lineHeight.sm};
      color: ${c(n.red[500],n.red[400])};
      cursor: pointer;
      position: relative;
      &:hover {
        background-color: ${c(n.gray[200],n.darkGray[500])};
      }
      & > span {
        width: ${i[1.5]};
        height: ${i[1.5]};
        border-radius: ${Z.border.radius.full};
      }
      &:focus-within {
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
      & select {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        appearance: none;
        background-color: transparent;
        border: none;
        color: transparent;
        outline: none;
      }

      & svg path {
        stroke: ${Z.colors.red[400]};
      }
      & svg {
        width: ${Z.size[2]};
        height: ${Z.size[2]};
      }
    `,settingsMenu:t`
      display: flex;
      & * {
        font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      }
      flex-direction: column;
      gap: ${i[.5]};
      border-radius: ${Z.border.radius.sm};
      border: 1px solid ${c(n.gray[300],n.gray[700])};
      background-color: ${c(n.gray[50],n.darkGray[600])};
      font-size: ${r.size.xs};
      color: ${c(n.gray[700],n.gray[300])};
      z-index: 99999;
      min-width: 120px;
      padding: ${i[.5]};
    `,settingsSubTrigger:t`
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: ${Z.border.radius.xs};
      padding: ${Z.size[1]} ${Z.size[1]};
      cursor: pointer;
      background-color: transparent;
      border: none;
      color: ${c(n.gray[700],n.gray[300])};
      & svg {
        color: ${c(n.gray[600],n.gray[400])};
        transform: rotate(-90deg);
        width: ${Z.size[2]};
        height: ${Z.size[2]};
      }
      &:hover {
        background-color: ${c(n.gray[200],n.darkGray[500])};
      }
      &:focus-visible {
        outline-offset: 2px;
        outline: 2px solid ${n.blue[800]};
      }
      &.data-disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,settingsMenuHeader:t`
      padding: ${Z.size[1]} ${Z.size[1]};
      font-weight: ${r.weight.medium};
      border-bottom: 1px solid ${c(n.gray[300],n.darkGray[400])};
      color: ${c(n.gray[500],n.gray[400])};
      font-size: ${r.size.xs};
    `,settingsSubButton:t`
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: ${c(n.gray[700],n.gray[300])};
      font-size: ${r.size.xs};
      border-radius: ${Z.border.radius.xs};
      padding: ${Z.size[1]} ${Z.size[1]};
      cursor: pointer;
      background-color: transparent;
      border: none;
      & svg {
        color: ${c(n.gray[600],n.gray[400])};
      }
      &:hover {
        background-color: ${c(n.gray[200],n.darkGray[500])};
      }
      &:focus-visible {
        outline-offset: 2px;
        outline: 2px solid ${n.blue[800]};
      }
      &[data-checked] {
        background-color: ${c(n.purple[100],n.purple[900])};
        color: ${c(n.purple[700],n.purple[300])};
        & svg {
          color: ${c(n.purple[700],n.purple[300])};
        }
        &:hover {
          background-color: ${c(n.purple[100],n.purple[900])};
        }
      }
    `,viewToggle:t`
      border-radius: ${Z.border.radius.sm};
      background-color: ${c(n.gray[200],n.darkGray[600])};
      border: 1px solid ${c(n.gray[300],n.darkGray[200])};
      display: flex;
      padding: 0;
      font-size: ${r.size.xs};
      color: ${c(n.gray[700],n.gray[300])};
      overflow: hidden;

      &:has(:focus-visible) {
        outline: 2px solid ${n.blue[800]};
      }

      & .tsqd-radio-toggle {
        opacity: 0.5;
        display: flex;
        & label {
          display: flex;
          align-items: center;
          cursor: pointer;
          line-height: ${r.lineHeight.md};
        }

        & label:hover {
          background-color: ${c(n.gray[100],n.darkGray[500])};
        }
      }

      & > [data-checked] {
        opacity: 1;
        background-color: ${c(n.gray[100],n.darkGray[400])};
        & label:hover {
          background-color: ${c(n.gray[100],n.darkGray[400])};
        }
      }

      & .tsqd-radio-toggle:first-child {
        & label {
          padding: 0 ${Z.size[1.5]} 0 ${Z.size[2]};
        }
        border-right: 1px solid ${c(n.gray[300],n.darkGray[200])};
      }

      & .tsqd-radio-toggle:nth-child(2) {
        & label {
          padding: 0 ${Z.size[2]} 0 ${Z.size[1.5]};
        }
      }
    `,devtoolsEditForm:t`
      padding: ${i[2]};
      & > [data-error='true'] {
        outline: 2px solid ${c(n.red[200],n.red[800])};
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
      }
    `,devtoolsEditTextarea:t`
      width: 100%;
      max-height: 500px;
      font-family: 'Fira Code', monospace;
      font-size: ${r.size.xs};
      border-radius: ${s.radius.sm};
      field-sizing: content;
      padding: ${i[2]};
      background-color: ${c(n.gray[100],n.darkGray[800])};
      color: ${c(n.gray[900],n.gray[100])};
      border: 1px solid ${c(n.gray[200],n.gray[700])};
      resize: none;
      &:focus {
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${c(n.blue[200],n.blue[800])};
      }
    `,devtoolsEditFormActions:t`
      display: flex;
      justify-content: space-between;
      gap: ${i[2]};
      align-items: center;
      padding-top: ${i[1]};
      font-size: ${r.size.xs};
    `,devtoolsEditFormError:t`
      color: ${c(n.red[700],n.red[500])};
    `,devtoolsEditFormActionContainer:t`
      display: flex;
      gap: ${i[2]};
    `,devtoolsEditFormAction:t`
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      font-size: ${r.size.xs};
      padding: ${i[1]} ${Z.size[2]};
      display: flex;
      border-radius: ${s.radius.sm};
      background-color: ${c(n.gray[100],n.darkGray[600])};
      border: 1px solid ${c(n.gray[300],n.darkGray[400])};
      align-items: center;
      gap: ${i[2]};
      font-weight: ${r.weight.medium};
      line-height: ${r.lineHeight.xs};
      cursor: pointer;
      &:focus-visible {
        outline-offset: 2px;
        border-radius: ${s.radius.xs};
        outline: 2px solid ${n.blue[800]};
      }
      &:hover {
        background-color: ${c(n.gray[200],n.darkGray[500])};
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `}},wu=e=>Cu(`light`,e),Tu=e=>Cu(`dark`,e);y([`click`,`mousedown`,`keydown`,`input`]);var Eu=e=>{let[t,n]=ve({prefix:`TanstackQueryDevtools`}),r=i(),a=B(()=>{let n=e.theme||t.theme_preference||`system`;return n===`system`?r():n});return T(Se.Provider,{value:e,get children(){return T(Me,{get children(){return T(Te,{get children(){return T(ke,{get children(){return T(Zc,{localStore:t,setLocalStore:n,get children(){return T($c.Provider,{value:a,get children(){return T(cu,{localStore:t,setLocalStore:n})}})}})}})}})}})}})};export{Eu as default};