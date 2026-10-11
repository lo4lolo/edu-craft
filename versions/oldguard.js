'use strict';
// 에듀 크래프트 — 보관한 이전 버전(versions/vX.Y/)에 붙는 안내 (올리기 도구가 versions/oldguard.js 로 복사하고 index.html 에 넣음)
//  - 화면 위 띠: 「이전 버전이에요 · ⭐ 최신 버전으로」
//  - 새 버전에서 저장한 세계를 열면: 사본으로 열지 물어봄 (이전 버전에서 저장하면 새 블록·물건이 사라질 수 있어서)
(function () {
  const vnum = (v) => String(v || '').replace(/[^0-9.]/g, '').split('.').map(Number);
  const newer = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) { const p = x[i] || 0, q = y[i] || 0; if (p !== q) return p > q; } return false; };
  const root = new URL('../../', location.href).href;
  window.addEventListener('DOMContentLoaded', () => {
    const v = typeof VERSION !== 'undefined' ? VERSION : '';
    const b = document.createElement('a');
    b.href = root; b.textContent = `⏪ 이전 버전 ${v} 이에요 · ⭐ 최신 버전으로 가기`;
    b.style.cssText = 'position:fixed;left:50%;top:4px;transform:translateX(-50%);z-index:9998;background:#fff6d6;border:1.5px solid #f2d27a;color:#7a5a10;border-radius:999px;padding:3px 14px;font:600 13px Pretendard,"Malgun Gothic",sans-serif;text-decoration:none;box-shadow:0 3px 10px rgba(0,0,0,.15)';
    document.body.appendChild(b);
  });
  window.addEventListener('load', () => {
    if (typeof Game === 'undefined' || typeof DB === 'undefined') return;
    const G = Game.prototype, _sw = G.startWorld;
    G.startWorld = async function (opt) {
      const rec = opt && opt.rec, here = typeof VERSION !== 'undefined' ? VERSION : '';
      const fromNew = rec && (rec.ver ? newer(rec.ver, here) : !!(rec.mc2 || (rec.gen || 0) >= 3 || (rec.player && rec.player.offhand)));
      if (fromNew && !opt._ecCopy) {
        const yes = confirm(`이 세계는 새 버전${rec.ver ? '(' + rec.ver + ')' : ''}에서 저장했어요.\n이전 버전 ${here}에서 저장하면 새로 생긴 블록·물건이 사라질 수 있어요.\n\n[확인] 사본을 만들어 열기 (추천 — 원래 세계는 그대로)\n[취소] 그대로 열기`);
        if (yes) {
          const copy = JSON.parse(JSON.stringify(rec));
          copy.id = 'w' + Date.now().toString(36) + (Math.random() * 1e4 | 0); copy.name = rec.name + ` (${here} 사본)`; copy.created = Date.now();
          try { await DB.put(copy); } catch (e) { alert('사본을 만들지 못했어요: ' + e.message); return; }
          return _sw.call(this, Object.assign({}, opt, { id: copy.id, rec: copy, _ecCopy: true }));
        }
      }
      return _sw.call(this, opt);
    };
  });
})();
