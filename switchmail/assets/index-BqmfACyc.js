(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))r(t);new MutationObserver(t=>{for(const d of t)if(d.type==="childList")for(const p of d.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&r(p)}).observe(document,{childList:!0,subtree:!0});function o(t){const d={};return t.integrity&&(d.integrity=t.integrity),t.referrerPolicy&&(d.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?d.credentials="include":t.crossOrigin==="anonymous"?d.credentials="omit":d.credentials="same-origin",d}function r(t){if(t.ep)return;t.ep=!0;const d=o(t);fetch(t.href,d)}})();function P(e,i){switch(i){case"up":return{x:e.x,y:e.y-1};case"down":return{x:e.x,y:e.y+1};case"left":return{x:e.x-1,y:e.y};case"right":return{x:e.x+1,y:e.y};case"wait":return e}}function H(e,i){return e.x>=0&&e.x<i&&e.y>=0&&e.y<i}function $(e,i){return e.x===i.x&&e.y===i.y}function q(e){return{tick:0,packages:new Map,failed:!1,failureReason:null,won:!1}}function M(e,i,o){if(i.failed||i.won)return i;const r=new Map(i.packages);for(const n of e.packages)n.spawnTick===i.tick&&!i.packages.has(n.id)&&r.set(n.id,{pos:n.spawn,direction:n.direction,delivered:!1,waitUntilTick:null});const t={tick:i.tick+1,packages:r,failed:!1,failureReason:null,won:!1};if(t.tick>e.maxTicks)return t.failed=!0,t.failureReason="超时：包裹未能在规定时间内送达",t;const d=[];for(const[n,a]of t.packages.entries()){if(a.delivered)continue;let l=!1;if(a.waitUntilTick!==null)if(t.tick<=a.waitUntilTick){d.push({pkgId:n,from:a.pos,to:a.pos,dir:"wait"});continue}else a.waitUntilTick=null,l=!0;const u=o[a.pos.y][a.pos.x];let y=a.direction;if(u.direction&&u.direction!=="wait")y=u.direction;else if(u.direction==="wait"&&!l){a.waitUntilTick=t.tick,d.push({pkgId:n,from:a.pos,to:a.pos,dir:"wait"});continue}const B=P(a.pos,y);d.push({pkgId:n,from:a.pos,to:B,dir:y})}for(const n of d){if(t.packages.get(n.pkgId),n.dir==="wait")continue;if(!H(n.to,e.gridSize))return t.failed=!0,t.failureReason=`包裹 ${n.pkgId} 移出边界`,t;if(o[n.to.y][n.to.x].type==="wall")return t.failed=!0,t.failureReason=`包裹 ${n.pkgId} 撞墙`,t}const p=new Map;for(const n of d){if(n.dir==="wait")continue;const a=`${n.to.x},${n.to.y}`;p.has(a)||p.set(a,[]),p.get(a).push(n.pkgId)}for(const[n,a]of p.entries())if(a.length>1)return t.failed=!0,t.failureReason=`包裹碰撞于 (${n})`,t;for(let n=0;n<d.length;n++)for(let a=n+1;a<d.length;a++){const l=d[n],u=d[a];if(!(l.dir==="wait"||u.dir==="wait")&&$(l.from,u.to)&&$(l.to,u.from))return t.failed=!0,t.failureReason=`包裹 ${l.pkgId} 和 ${u.pkgId} 迎面碰撞`,t}for(const n of d){const a=t.packages.get(n.pkgId);if(n.dir==="wait")continue;a.pos=n.to,a.direction=n.dir;const l=e.packages.find(u=>u.id===n.pkgId);$(n.to,l.destination)&&(a.delivered=!0)}return e.packages.every(n=>{const a=t.packages.get(n.id);return a&&a.delivered})&&(t.won=!0),t}function U(e,i){let o=q();for(;!o.failed&&!o.won&&o.tick<e.maxTicks+10;)o=M(e,o,i);return o}function E(e,i){const o=e.grid.map(r=>r.map(t=>({...t})));for(const r of i){const t=o[r.pos.y][r.pos.x];(t.editableDirection||t.editableWait)&&(t.direction=r.direction)}return o}function N(e,i){return i==="wait"?e.editableWait:e.editableDirection}function G(e,i){if(i.length>e.editBudget)return{valid:!1,reason:`编辑次数 ${i.length} 超过预算 ${e.editBudget}`};const o=E(e,i),r=U(e,o);return r.failed?{valid:!1,reason:r.failureReason||"模拟失败"}:r.won?{valid:!0}:{valid:!1,reason:"包裹未全部送达"}}function b(e){return Array.from({length:e},()=>Array.from({length:e},()=>({type:"empty",direction:null,editableDirection:!1,editableWait:!1})))}const T=[{id:1,name:"放手试跑",description:'点击"运行"观看包裹自动送达',gridSize:5,editBudget:0,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"}]},{id:2,name:"拐弯到站",description:"放置方向箭头引导包裹转弯",gridSize:5,editBudget:2,maxTicks:20,grid:(()=>{const e=b(5);return e[0][0].type="spawn",e[0][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][3].type="wall",e[0][2].editableDirection=!0,e[2][2].editableDirection=!0,e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:0},destination:{x:4,y:2},spawnTick:0,direction:"right"}],solution:[{pos:{x:2,y:0},direction:"down"},{pos:{x:2,y:2},direction:"right"}]},{id:3,name:"修坏路标",description:"找到错误的路标并修正",gridSize:5,editBudget:1,maxTicks:20,grid:(()=>{const e=b(5);return e[0][0].type="spawn",e[0][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][3].type="wall",e[0][2].editableDirection=!0,e[0][2].direction="down",e[2][2].editableDirection=!0,e[2][2].direction="left",e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:0},destination:{x:4,y:2},spawnTick:0,direction:"right"}],solution:[{pos:{x:2,y:2},direction:"right"}]},{id:4,name:"保留正确部分",description:"不要改动已经正确的路标",gridSize:5,editBudget:1,maxTicks:20,grid:(()=>{const e=b(5);return e[0][0].type="spawn",e[0][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][3].type="wall",e[0][1].editableDirection=!0,e[0][2].editableDirection=!0,e[0][2].direction="down",e[2][2].editableDirection=!0,e[2][2].direction="left",e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:0},destination:{x:4,y:2},spawnTick:0,direction:"right"}],solution:[{pos:{x:2,y:2},direction:"right"}]},{id:5,name:"同拍碰撞",description:"使用等待标记避免包裹碰撞",gridSize:5,editBudget:1,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][2].type="spawn",e[0][2].packageId="B",e[4][2].type="destination",e[4][2].packageId="B",e[2][1].editableWait=!0,e[2][1].editableDirection=!1,e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"},{id:"B",shape:"square",color:"#4ecdc4",spawn:{x:2,y:0},destination:{x:2,y:4},spawnTick:0,direction:"down"}],solution:[{pos:{x:1,y:2},direction:"wait"}]},{id:6,name:"不要过度干预",description:"有时不编辑就是最好的解法",gridSize:5,editBudget:0,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][2].type="spawn",e[0][2].packageId="B",e[4][2].type="destination",e[4][2].packageId="B",e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"},{id:"B",shape:"square",color:"#4ecdc4",spawn:{x:2,y:0},destination:{x:2,y:4},spawnTick:1,direction:"down"}],solution:[]},{id:7,name:"空间换时间",description:"通过绕路避免碰撞",gridSize:5,editBudget:4,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][2].type="spawn",e[0][2].packageId="B",e[4][2].type="destination",e[4][2].packageId="B",e[2][1].editableDirection=!0,e[1][1].editableDirection=!0,e[1][3].editableDirection=!0,e[2][3].editableDirection=!0,e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"},{id:"B",shape:"square",color:"#4ecdc4",spawn:{x:2,y:0},destination:{x:2,y:4},spawnTick:0,direction:"down"}],solution:[{pos:{x:1,y:2},direction:"up"},{pos:{x:1,y:1},direction:"right"},{pos:{x:3,y:1},direction:"down"},{pos:{x:3,y:2},direction:"right"}]},{id:8,name:"一个规则服务两件",description:"共享的路标会影响所有经过的包裹",gridSize:5,editBudget:1,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][2].type="spawn",e[0][2].packageId="B",e[2][4].type="destination",e[2][4].packageId="B",e[2][2].editableDirection=!0,e[2][2].direction="down",e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"},{id:"B",shape:"square",color:"#4ecdc4",spawn:{x:2,y:0},destination:{x:4,y:2},spawnTick:3,direction:"down"}],solution:[{pos:{x:2,y:2},direction:"right"}]},{id:9,name:"桥有方向",description:"某些通道只能单向通行",gridSize:5,editBudget:5,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][2].type="spawn",e[0][2].packageId="B",e[4][2].type="destination",e[4][2].packageId="B",e[2][2].type="empty",e[2][1].editableWait=!0,e[1][2].editableDirection=!0,e[1][3].editableDirection=!0,e[3][3].editableDirection=!0,e[3][2].editableDirection=!0,e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"},{id:"B",shape:"square",color:"#4ecdc4",spawn:{x:2,y:0},destination:{x:2,y:4},spawnTick:0,direction:"down"}],solution:[{pos:{x:1,y:2},direction:"wait"},{pos:{x:2,y:1},direction:"right"},{pos:{x:3,y:1},direction:"down"},{pos:{x:3,y:3},direction:"left"},{pos:{x:2,y:3},direction:"down"}]},{id:10,name:"综合考试",description:"运用所学知识完成最终挑战",gridSize:5,editBudget:2,maxTicks:20,grid:(()=>{const e=b(5);return e[2][0].type="spawn",e[2][0].packageId="A",e[2][4].type="destination",e[2][4].packageId="A",e[0][2].type="spawn",e[0][2].packageId="B",e[4][2].type="destination",e[4][2].packageId="B",e[1][1].type="wall",e[3][3].type="wall",e[2][1].editableDirection=!0,e[2][1].direction="up",e[2][3].editableDirection=!0,e[2][3].direction="right",e})(),packages:[{id:"A",shape:"circle",color:"#ff6b6b",spawn:{x:0,y:2},destination:{x:4,y:2},spawnTick:0,direction:"right"},{id:"B",shape:"square",color:"#4ecdc4",spawn:{x:2,y:0},destination:{x:2,y:4},spawnTick:0,direction:"down"}],solution:[{pos:{x:1,y:2},direction:"wait"},{pos:{x:2,y:3},direction:"down"}]}];let h=0,c=T[h],w=[],f=[],v=[],s=null,g=!1,m=300,S=null,I=null,z=!1,k=0,R;function C(){R=document.getElementById("app"),W(0),x()}function W(e){h=Math.max(0,Math.min(e,T.length-1)),c=T[h],w=c.grid.map(i=>i.map(o=>({...o}))),f=[],v=[{edits:[],usedBudget:0}],s=null,g=!1,I=null,z=!1,k=0,D()}function F(){w=c.grid.map(e=>e.map(i=>({...i}))),f=[],v=[{edits:[],usedBudget:0}],s=null,g=!1,I=null,z=!1,D(),x()}function V(e,i){const o=w[e.y][e.x];N(o,i)&&(f=f.filter(r=>!$(r.pos,e)),f.push({pos:e,direction:i}),o.direction=i,v.push({edits:[...f],usedBudget:f.length}),x())}function K(){if(v.length<=1)return;v.pop(),f=[...v[v.length-1].edits],w=E(c,f),x()}function O(){g||(w=E(c,f),s=q(),g=!0,z=!1,x(),S=window.setInterval(()=>{if(!s||s.failed||s.won){D();return}s=M(c,s,w),x()},m))}function J(){g&&S||(s||(w=E(c,f),s=q()),!(s.failed||s.won)&&(s=M(c,s,w),x()))}function D(){g=!1,S!==null&&(clearInterval(S),S=null)}function Q(){m===300?m=150:m===150?m=50:m=300,g&&S&&(D(),O()),x()}function X(){z=!0,k=Math.min(k+1,3),x()}function Y(){h<T.length-1&&(W(h+1),x())}function Z(){h>0&&(W(h-1),x())}function x(){const e=f.length,i=v.length>1,o=s!==null;R.innerHTML=`
    <div style="flex: 1; display: flex; flex-direction: column; padding: 16px; gap: 12px; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button onclick="window.gameActions.home()" style="padding: 8px 16px; background: #6b4423; border: none; border-radius: 4px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
          ← 返回大厅
        </button>
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 20px; font-weight: bold; color: #ffb366;">关卡 ${c.id}: ${c.name}</div>
          <div style="font-size: 13px; color: #c9b18a; margin-top: 4px;">${c.description}</div>
        </div>
        <div style="width: 100px;"></div>
      </div>

      <!-- Status Bar -->
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; font-size: 14px;">
        <div style="background: #4a3222; padding: 8px 16px; border-radius: 4px;">
          <span style="color: #c9b18a;">编辑：</span>
          <span style="color: ${e>c.editBudget?"#ff6b6b":"#7bd389"}; font-weight: bold;">
            ${e} / ${c.editBudget}
          </span>
        </div>
        ${o?`
          <div style="background: #4a3222; padding: 8px 16px; border-radius: 4px;">
            <span style="color: #c9b18a;">时刻：</span>
            <span style="color: #ffb366; font-weight: bold;">${s.tick}</span>
          </div>
        `:""}
        <div style="background: #4a3222; padding: 8px 16px; border-radius: 4px;">
          <span style="color: #c9b18a;">待发车：</span>
          <span style="color: #ffb366; font-weight: bold;">
            ${c.packages.filter(r=>!s||!s.packages.has(r.id)&&!s.won).length}
          </span>
        </div>
      </div>

      <!-- Game Board -->
      <div id="game-board" style="
        display: grid;
        grid-template-columns: repeat(${c.gridSize}, 1fr);
        gap: 4px;
        margin: 0 auto;
        max-width: min(500px, 90vw);
        aspect-ratio: 1;
        background: #2a1810;
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        ${_()}
      </div>

      <!-- Legend -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 16px; height: 16px; background: #ff6b6b; border-radius: 50%;"></div>
          <span>包裹A</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 16px; height: 16px; background: #4ecdc4;"></div>
          <span>包裹B</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 16px; height: 16px; background: #5b4433; border: 2px solid #8b7355;"></div>
          <span>墙</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 16px;">↑↓←→</span>
          <span>方向</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 16px;">⏸</span>
          <span>等待</span>
        </div>
      </div>

      <!-- Control Buttons -->
      <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
        ${g?`
          <button onclick="window.gameActions.stop()" style="padding: 12px 24px; background: #ff6b6b; border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; font-size: 16px; min-width: 100px;">
            ⏹ 停止
          </button>
        `:`
          <button onclick="window.gameActions.run()" style="padding: 12px 24px; background: #7bd389; border: none; border-radius: 6px; color: #1a1a1a; font-weight: bold; cursor: pointer; font-size: 16px; min-width: 100px;">
            ▶ 运行
          </button>
          <button onclick="window.gameActions.step()" style="padding: 12px 24px; background: #ffc857; border: none; border-radius: 6px; color: #1a1a1a; font-weight: bold; cursor: pointer; font-size: 16px;">
            ⏩ 单步
          </button>
        `}
        ${i&&!g?`
          <button onclick="window.gameActions.undo()" style="padding: 12px 20px; background: #b388ff; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px;">
            ↶ 撤销
          </button>
        `:""}
        <button onclick="window.gameActions.reset()" style="padding: 12px 20px; background: #6b4423; border: none; border-radius: 6px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
          ⟲ 重置
        </button>
        <button onclick="window.gameActions.toggleSpeed()" style="padding: 12px 20px; background: #5b8def; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px;">
          ${m===300?"1×":m===150?"2×":"4×"}
        </button>
      </div>

      <!-- Hint and Navigation -->
      <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
        <button onclick="window.gameActions.hint()" style="padding: 10px 20px; background: #ff9f43; border: none; border-radius: 6px; color: #1a1a1a; cursor: pointer; font-size: 14px;">
          💡 提示 ${k>0?`(${k}/3)`:""}
        </button>
        ${h>0?`
          <button onclick="window.gameActions.prev()" style="padding: 10px 20px; background: #6b4423; border: none; border-radius: 6px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
            ← 上一关
          </button>
        `:""}
        ${h<T.length-1?`
          <button onclick="window.gameActions.next()" style="padding: 10px 20px; background: #6b4423; border: none; border-radius: 6px; color: #f5e6d3; cursor: pointer; font-size: 14px;">
            下一关 →
          </button>
        `:""}
      </div>

      ${te()}
    </div>
  `,ne()}function _(){let e="";for(let i=0;i<c.gridSize;i++)for(let o=0;o<c.gridSize;o++){const r=w[i][o],t={x:o,y:i},d=I&&$(I,t);let p=null;if(s){for(const[j,L]of s.packages.entries())if(!L.delivered&&$(L.pos,t)){p=j;break}}const A=r.type==="spawn",n=r.type==="destination",a=r.type==="wall",l=r.editableDirection||r.editableWait,u=r.direction!==null;let y="#4a3222";a&&(y="#5b4433"),A&&(y="#3d5a3d"),n&&(y="#5a3d3d"),l&&(y="#5a4d3d"),d&&(y="#7a6d5d");let B="2px solid #6b5444";a&&(B="2px solid #8b7355"),l&&(B="2px solid #ffb366"),z&&c.solution&&k>=2&&c.solution.some(L=>$(L.pos,t))&&(B="3px solid #ffc857"),e+=`
        <div 
          data-x="${o}" 
          data-y="${i}" 
          class="game-cell"
          style="
            background: ${y};
            border: ${B};
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: ${l&&!g?"pointer":"default"};
            min-height: 50px;
          "
        >
          ${a?'<div style="font-size: 24px;">🧱</div>':""}
          ${A&&!p?'<div style="font-size: 20px; opacity: 0.5;">📬</div>':""}
          ${n&&!p?'<div style="font-size: 20px; opacity: 0.5;">📪</div>':""}
          ${u&&!p?ee(r.direction):""}
          ${p?ie(p):""}
          ${l&&!u&&!p&&!g?`
            <div style="position: absolute; top: 2px; right: 2px; font-size: 10px; opacity: 0.5;">✏️</div>
          `:""}
        </div>
      `}return e}function ee(e){return`<div style="font-size: 28px; color: #ffb366; font-weight: bold;">${{up:"↑",down:"↓",left:"←",right:"→",wait:"⏸"}[e]}</div>`}function ie(e){const i=c.packages.find(r=>r.id===e),o={circle:"●",square:"■",triangle:"▲",diamond:"◆"};return`<div style="font-size: 32px; color: ${i.color};">${o[i.shape]}</div>`}function te(){let e="";if(s&&s.won&&(e+=`
      <div style="background: #7bd389; color: #1a1a1a; padding: 16px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px;">
        🎉 恭喜通关！所有包裹准时送达！
      </div>
    `),s&&s.failed&&(e+=`
      <div style="background: #ff6b6b; color: #fff; padding: 16px; border-radius: 8px; text-align: center; font-weight: bold;">
        ❌ ${s.failureReason||"失败"}
      </div>
    `),z&&c.solution){if(k===1){const i=G(c,f);i.valid?e+=`
          <div style="background: #7bd389; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
            💡 当前方案可行！点击运行验证。
          </div>
        `:e+=`
          <div style="background: #ff9f43; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
            💡 提示：${i.reason}
          </div>
        `}else if(k===2)e+=`
        <div style="background: #ff9f43; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
          💡 提示：高亮的格子需要编辑
        </div>
      `;else if(k===3){const i=c.solution.map(o=>{const r={up:"↑",down:"↓",left:"←",right:"→",wait:"⏸"};return`(${o.pos.x+1},${o.pos.y+1}): ${r[o.direction]}`}).join("；");e+=`
        <div style="background: #ffc857; color: #1a1a1a; padding: 12px; border-radius: 8px; font-size: 14px;">
          💡 参考解：${i||"不需要编辑"}
        </div>
      `}}return e}function ne(){document.querySelectorAll(".game-cell").forEach(i=>{const o=i,r=parseInt(o.dataset.x),t=parseInt(o.dataset.y),d={x:r,y:t},p=w[t][r];(p.editableDirection||p.editableWait)&&!g&&o.addEventListener("click",()=>{if(!g)if(I&&$(I,d)){const A=p.direction,n=[];if(p.editableDirection&&n.push("up","down","left","right"),p.editableWait&&n.push("wait"),n.length===0)return;const l=((A?n.indexOf(A):-1)+1)%n.length,u=n[l];V(d,u),I=null}else I=d,x()})})}window.gameActions={run:O,step:J,stop:()=>{D(),x()},undo:K,reset:F,toggleSpeed:Q,hint:X,next:Y,prev:Z,home:()=>{window.location.href="../"}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",C):C();
