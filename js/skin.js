'use strict';
// =====================================================================
// 아바타 스킨: 마인크래프트 64x64 스킨 형식(전개도) + 캐릭터 만들기 + 3D 소품
//  - 모든 스킨은 64x64 RGBA. 기본 층(피부)과 바깥 층(모자·겉옷) 두 겹
//  - 모델은 -Z 방향을 바라보고, 캐릭터의 오른쪽은 +X
// =====================================================================
const SKIN_W = 64;
// 부위: 텍스처 시작 위치(u,v), 크기(w,h,d), 바깥 층 위치(ou,ov)
const SKIN_PARTS = {
  head: { u: 0, v: 0, w: 8, h: 8, d: 8, ou: 32, ov: 0, name: '머리' },
  body: { u: 16, v: 16, w: 8, h: 12, d: 4, ou: 16, ov: 32, name: '몸' },
  rarm: { u: 40, v: 16, w: 4, h: 12, d: 4, ou: 40, ov: 32, name: '오른팔' },
  larm: { u: 32, v: 48, w: 4, h: 12, d: 4, ou: 48, ov: 48, name: '왼팔' },
  rleg: { u: 0, v: 16, w: 4, h: 12, d: 4, ou: 0, ov: 32, name: '오른다리' },
  lleg: { u: 16, v: 48, w: 4, h: 12, d: 4, ou: 0, ov: 48, name: '왼다리' },
};
const SKIN_PART_KEYS = ['head', 'body', 'rarm', 'larm', 'rleg', 'lleg'];
const SKIN_FACES = ['top', 'bottom', 'right', 'front', 'left', 'back'];
const SKIN_FACE_NAMES = { top: '위', bottom: '아래', right: '오른쪽', front: '앞', left: '왼쪽', back: '뒤' };
const SKIN_MIRROR_PART = { head: 'head', body: 'body', rarm: 'larm', larm: 'rarm', rleg: 'lleg', lleg: 'rleg' };
const SKIN_MIRROR_FACE = { top: 'top', bottom: 'bottom', right: 'left', left: 'right', front: 'front', back: 'back' };

function skinPartDims(part, slim) {
  const P = SKIN_PARTS[part];
  if (slim && (part === 'rarm' || part === 'larm')) return Object.assign({}, P, { w: 3 });
  return P;
}
// 면의 텍스처 사각형 [x, y, w, h]
function skinFaceRect(part, face, over, slim) {
  const P = skinPartDims(part, slim);
  const u = over ? P.ou : P.u, v = over ? P.ov : P.v, w = P.w, h = P.h, d = P.d;
  switch (face) {
    case 'top': return [u + d, v, w, d];
    case 'bottom': return [u + d + w, v, w, d];
    case 'right': return [u, v + d, d, h];
    case 'front': return [u + d, v + d, w, h];
    case 'left': return [u + d + w, v + d, d, h];
    case 'back': return [u + 2 * d + w, v + d, w, h];
  }
}
// 면의 네 꼭짓점 (바깥에서 봤을 때 왼위, 오른위, 오른아래, 왼아래) — 상자 [x0,y0,z0,x1,y1,z1]
function skinFaceCorners(face, b) {
  const [x0, y0, z0, x1, y1, z1] = b;
  switch (face) {
    case 'front': return [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]];
    case 'back': return [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]];
    case 'right': return [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]];
    case 'left': return [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]];
    case 'top': return [[x1, y1, z1], [x0, y1, z1], [x0, y1, z0], [x1, y1, z0]];
    case 'bottom': return [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]];
  }
}
const SKIN_FACE_N = { front: [0, 0, -1], back: [0, 0, 1], right: [1, 0, 0], left: [-1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0] };

// 텍셀 → (부위, 층, 면, 면 안 좌표) 표. 슬림/보통 따로
const SKIN_OWNER = {};
function skinOwnerTable(slim) {
  const key = slim ? 's' : 'c';
  if (SKIN_OWNER[key]) return SKIN_OWNER[key];
  const t = new Array(SKIN_W * SKIN_W).fill(null);
  for (const part of SKIN_PART_KEYS) for (const over of [0, 1]) for (const face of SKIN_FACES) {
    const [x, y, w, h] = skinFaceRect(part, face, over, slim);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) t[(y + j) * SKIN_W + x + i] = { part, over, face, i, j, w, h };
  }
  return (SKIN_OWNER[key] = t);
}
// 좌우 대칭 텍셀
function skinMirrorTexel(x, y, slim) {
  const o = skinOwnerTable(slim)[y * SKIN_W + x];
  if (!o) return null;
  const r = skinFaceRect(SKIN_MIRROR_PART[o.part], SKIN_MIRROR_FACE[o.face], o.over, slim);
  return [r[0] + (r[2] - 1 - o.i), r[1] + o.j];
}

// ---------------- 색 도우미 ----------------
function hexRgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function rgbHex(c) { return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1); }
function shadeCol(c, k) {
  if (typeof c === 'string') c = hexRgb(c);
  if (k >= 1) { const t = k - 1; return [c[0] + (255 - c[0]) * t | 0, c[1] + (255 - c[1]) * t | 0, c[2] + (255 - c[2]) * t | 0, 255]; }
  return [c[0] * k | 0, c[1] * k | 0, c[2] * k | 0, 255];
}

// ---------------- 스킨 그리기 도구 ----------------
class SkinPainter {
  constructor(px, slim) { this.p = px || new Uint8ClampedArray(SKIN_W * SKIN_W * 4); this.slim = !!slim; }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= SKIN_W || y >= SKIN_W || !c) return;
    if (typeof c === 'string') c = hexRgb(c);
    const o = (y * SKIN_W + x) * 4; this.p[o] = c[0]; this.p[o + 1] = c[1]; this.p[o + 2] = c[2]; this.p[o + 3] = c[3] === undefined ? 255 : c[3];
  }
  // 면 안 좌표 (i: 바깥에서 봤을 때 왼→오, j: 위→아래)
  px(part, face, over, i, j, c) {
    const r = skinFaceRect(part, face, over, this.slim);
    if (i < 0 || j < 0 || i >= r[2] || j >= r[3]) return;
    this.set(r[0] + i, r[1] + j, c);
  }
  face(part, face, over, c) { const r = skinFaceRect(part, face, over, this.slim); for (let j = 0; j < r[3]; j++) for (let i = 0; i < r[2]; i++) this.set(r[0] + i, r[1] + j, typeof c === 'function' ? c(i, j, r[2], r[3]) : c); }
  rect(part, face, over, i0, j0, w, h, c) { for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) this.px(part, face, over, i, j, typeof c === 'function' ? c(i, j) : c); }
  // 옆면 4개의 j 줄 (front,right,back,left)
  band(part, over, j0, j1, c, faces) {
    for (const f of faces || ['front', 'right', 'back', 'left']) {
      const r = skinFaceRect(part, f, over, this.slim);
      for (let j = j0; j <= j1; j++) for (let i = 0; i < r[2]; i++) this.px(part, f, over, i, j, typeof c === 'function' ? c(i, j, f) : c);
    }
  }
  // 옆면에서 '앞에서부터 f번째' 칸
  side(part, which, over, f, j, c) { const d = skinPartDims(part, this.slim).d; this.px(part, which, over, which === 'right' ? d - 1 - f : f, j, c); }
  part(part, over, c) { for (const f of SKIN_FACES) this.face(part, f, over, c); }
}

// ---------------- 캐릭터 만들기 선택지 ----------------
const AV_OPTS = {
  skinTone: ['#ffe3d3', '#f9d2bb', '#efbf9e', '#dca47f', '#bb7f58', '#8a5a3c'],
  hairCol: ['#7a4a2e', '#4a2e24', '#2e2733', '#f3d27a', '#ff9fc0', '#9fd4ff', '#b89cf0', '#8fe0c4', '#f39a60', '#f5f1ee'],
  eyeCol: ['#4a2f26', '#2f4a8a', '#3b8a5c', '#8a44b8', '#d4507e', '#26222c'],
  cloth: ['#ff9dbd', '#ffc2d4', '#9fd0ff', '#7fb2f0', '#a8e6c4', '#6fcf97', '#ffe08a', '#ffb37d', '#c7aef5', '#9b7fe0', '#ffffff', '#f06a7a', '#4d5b8c', '#3a3a44'],
  hair: [['short', '짧은 머리'], ['bob', '단발'], ['long', '긴 생머리'], ['twin', '양갈래'], ['pony', '포니테일'], ['bun', '똥머리'], ['wave', '웨이브'], ['spiky', '삐죽 머리']],
  eyes: [['lash', '속눈썹 눈'], ['sparkle', '반짝 눈'], ['round', '동글 눈'], ['smile', '웃는 눈'], ['cat', '고양이 눈'], ['sleepy', '졸린 눈']],
  mouth: [['smile', '미소'], ['open', '활짝'], ['cat', '고양이 입'], ['small', '쪼끄만 입']],
  top: [['tee', '티셔츠'], ['hoodie', '후드티'], ['dress', '원피스'], ['sailor', '세일러복'], ['overall', '멜빵'], ['stripe', '줄무늬 티'], ['labcoat', '과학 가운'], ['cardigan', '가디건']],
  bottom: [['pants', '긴바지'], ['shorts', '반바지'], ['skirt', '치마'], ['leggings', '레깅스'], ['bare', '맨다리']],
  shoes: [['sneakers', '운동화'], ['mary', '구두'], ['boots', '부츠'], ['socks', '양말만']],
  deco: [['none', '없음'], ['glasses', '안경'], ['heart', '하트 볼'], ['star', '별 핀'], ['freckle', '주근깨']],
};
// 3D 소품
const AV_ACC = {
  head: [['none', '없음'], ['ribbon', '뒤 리본'], ['sideribbon', '옆 리본'], ['headband', '머리띠'], ['flower', '꽃핀'], ['crown', '왕관'], ['cat', '고양이 귀'], ['bunny', '토끼 귀'], ['bear', '곰 귀'], ['sprout', '새싹'], ['goggles', '과학 고글']],
  hair: [['none', '없음'], ['twin', '양갈래'], ['pony', '포니테일'], ['bun', '똥머리'], ['twinbun', '양쪽 똥머리'], ['longback', '긴 뒷머리']],
  skirt: [['none', '없음'], ['short', '짧은 치마'], ['long', '긴 드레스']],
  back: [['none', '없음'], ['wings', '요정 날개'], ['cape', '망토'], ['backpack', '책가방'], ['tail', '고양이 꼬리']],
};
const AV_DEFAULT = {
  slim: true, skinTone: '#f9d2bb', hair: 'long', hairCol: '#7a4a2e', eyes: 'lash', eyeCol: '#4a2f26', mouth: 'smile', blush: true,
  top: 'dress', topCol: '#ff9dbd', topCol2: '#ffffff', bottom: 'bare', bottomCol: '#7fb2f0', shoes: 'mary', shoeCol: '#f06a7a', deco: 'none',
};
const AV_ACC_DEFAULT = { head: 'ribbon', headCol: '#ff6f9a', hair: 'none', hairCol: '', skirt: 'short', skirtCol: '#ff9dbd', back: 'none', backCol: '#c7aef5' };
// 예시 캐릭터
const AV_PRESETS = [
  { n: '분홍 원피스', o: {}, a: {} },
  { n: '양갈래 세일러', o: { hair: 'twin', hairCol: '#f3d27a', top: 'sailor', topCol: '#7fb2f0', topCol2: '#f06a7a', bottom: 'skirt', bottomCol: '#7fb2f0', eyes: 'sparkle', eyeCol: '#2f4a8a', shoes: 'mary', shoeCol: '#4a2e24' }, a: { head: 'none', hair: 'twin', hairCol: '#f3d27a', skirt: 'short', skirtCol: '#7fb2f0' } },
  { n: '토끼 후드', o: { hair: 'bob', hairCol: '#2e2733', top: 'hoodie', topCol: '#ffffff', topCol2: '#ffc2d4', bottom: 'shorts', bottomCol: '#ffc2d4', eyes: 'round', shoes: 'sneakers', shoeCol: '#ff9dbd' }, a: { head: 'bunny', headCol: '#ffffff', skirt: 'none' } },
  { n: '꼬마 과학자', o: { hair: 'pony', hairCol: '#b89cf0', top: 'labcoat', topCol: '#c7aef5', topCol2: '#ffffff', bottom: 'skirt', bottomCol: '#9b7fe0', deco: 'glasses', eyes: 'sparkle', eyeCol: '#8a44b8', shoes: 'boots', shoeCol: '#9b7fe0' }, a: { head: 'goggles', headCol: '#9fd0ff', hair: 'pony', hairCol: '#b89cf0', skirt: 'none' } },
  { n: '요정 공주', o: { hair: 'wave', hairCol: '#ff9fc0', top: 'dress', topCol: '#c7aef5', topCol2: '#ffe08a', eyes: 'sparkle', eyeCol: '#d4507e', shoes: 'mary', shoeCol: '#ffe08a' }, a: { head: 'crown', headCol: '#ffd84a', skirt: 'long', skirtCol: '#c7aef5', back: 'wings', backCol: '#bfe8ff' } },
  { n: '고양이 가디건', o: { hair: 'bun', hairCol: '#f39a60', top: 'cardigan', topCol: '#ffe08a', topCol2: '#ffffff', bottom: 'skirt', bottomCol: '#6fcf97', eyes: 'cat', eyeCol: '#3b8a5c', mouth: 'cat', shoes: 'sneakers', shoeCol: '#ffffff' }, a: { head: 'cat', headCol: '#f39a60', hair: 'bun', hairCol: '#f39a60', skirt: 'short', skirtCol: '#6fcf97', back: 'tail', backCol: '#f39a60' } },
  { n: '민트 곰돌이', o: { hair: 'short', hairCol: '#8fe0c4', top: 'overall', topCol: '#9fd0ff', topCol2: '#ffffff', bottom: 'pants', bottomCol: '#9fd0ff', eyes: 'round', eyeCol: '#26222c', shoes: 'sneakers', shoeCol: '#ffb37d' }, a: { head: 'bear', headCol: '#8fe0c4', skirt: 'none', back: 'backpack', backCol: '#ffb37d' } },
  { n: '기본 소년', o: { slim: false, hair: 'spiky', hairCol: '#4a2e24', top: 'tee', topCol: '#7fb2f0', topCol2: '#ffe08a', bottom: 'pants', bottomCol: '#4d5b8c', eyes: 'round', eyeCol: '#4a2f26', blush: false, shoes: 'sneakers', shoeCol: '#3a3a44' }, a: { head: 'none', skirt: 'none' } },
  { n: '과학 소년', o: { slim: false, hair: 'short', hairCol: '#2e2733', top: 'labcoat', topCol: '#6fcf97', topCol2: '#ffffff', bottom: 'pants', bottomCol: '#4d5b8c', eyes: 'round', eyeCol: '#26222c', blush: false, deco: 'glasses', shoes: 'sneakers', shoeCol: '#f06a7a' }, a: { head: 'sprout', headCol: '#6fcf97', skirt: 'none', back: 'backpack', backCol: '#7fb2f0' } },
];

// ---------------- 캐릭터 만들기 → 64x64 스킨 ----------------
function composeSkin(opts) {
  const o = Object.assign({}, AV_DEFAULT, opts || {});
  const S = new SkinPainter(null, o.slim);
  const sk = hexRgb(o.skinTone), skD = shadeCol(sk, 0.9), skDD = shadeCol(sk, 0.8);
  const hc = hexRgb(o.hairCol), hD = shadeCol(hc, 0.82), hL = shadeCol(hc, 1.18), hDD = shadeCol(hc, 0.68);
  const hairAt = (i, j) => ((i * 7 + j * 3) % 5 === 0 ? hD : (i + j * 2) % 7 === 0 ? hL : hc);
  const c1 = hexRgb(o.topCol), c1D = shadeCol(c1, 0.85), c1L = shadeCol(c1, 1.15);
  const c2 = hexRgb(o.topCol2), c2D = shadeCol(c2, 0.85);
  const bc = hexRgb(o.bottomCol), bcD = shadeCol(bc, 0.82), bcL = shadeCol(bc, 1.15);
  const shc = hexRgb(o.shoeCol), shD = shadeCol(shc, 0.75);
  const white = [255, 255, 255, 255], ink = [58, 40, 52, 255];
  // 1) 피부
  for (const p of SKIN_PART_KEYS) S.part(p, 0, (i, j) => sk);
  for (const p of SKIN_PART_KEYS) S.face(p, 'bottom', 0, skD);
  // 2) 하의 + 신발
  const legs = ['rleg', 'lleg'];
  const legFill = (j0, j1, c, over) => { for (const L of legs) S.band(L, over ? 1 : 0, j0, j1, typeof c === 'function' ? c : (i, j) => c); };
  if (o.bottom === 'pants') { legFill(0, 11, (i, j) => (j === 11 ? bcD : bc)); for (const L of legs) { S.face(L, 'top', 0, bc); S.px(L, 'front', 0, 1, 2, bcD); } }
  else if (o.bottom === 'leggings') { legFill(0, 11, (i, j) => (j < 1 ? bc : bcD)); for (const L of legs) S.face(L, 'top', 0, bc); }
  else if (o.bottom === 'shorts') { legFill(0, 4, (i, j) => (j === 4 ? bcD : bc)); for (const L of legs) S.face(L, 'top', 0, bc); }
  else if (o.bottom === 'skirt') {
    legFill(0, 3, (i, j) => (j === 3 ? bcD : (i % 2 ? bc : bcL)), true);
    legFill(0, 0, bc); for (const L of legs) S.face(L, 'top', 0, bc);
  }
  // 신발
  const shoe = o.shoes;
  if (shoe === 'boots') { legFill(7, 11, (i, j) => (j === 7 ? shadeCol(shc, 1.15) : j === 11 ? shD : shc)); }
  else if (shoe === 'sneakers') { legFill(9, 11, (i, j) => (j === 11 ? white : j === 9 && i % 2 ? white : shc)); legFill(8, 8, (i, j) => [250, 250, 250, 255]); }
  else if (shoe === 'mary') { legFill(8, 9, [255, 255, 255, 255]); legFill(10, 11, (i, j) => (j === 11 ? shD : shc)); for (const L of legs) S.px(L, 'front', 0, 1, 10, shadeCol(shc, 1.3)); }
  else if (shoe === 'socks') { legFill(8, 11, (i, j) => (j === 8 ? shadeCol(shc, 1.2) : shc)); }
  for (const L of legs) S.face(L, 'bottom', 0, shoe === 'socks' ? shc : shD);
  // 3) 상의
  const arms = ['rarm', 'larm'];
  const armFill = (j0, j1, c, over) => { for (const A of arms) S.band(A, over ? 1 : 0, j0, j1, typeof c === 'function' ? c : (i, j) => c); };
  const armTop = (c, over) => { for (const A of arms) S.face(A, 'top', over ? 1 : 0, c); };
  const bodyAll = (c) => { for (const f of SKIN_FACES) S.face('body', f, 0, c); };
  const waist = () => {
    if (o.bottom === 'pants' || o.bottom === 'shorts' || o.bottom === 'leggings') { S.band('body', 0, 10, 11, (i, j) => (j === 10 ? bcD : bc)); S.face('body', 'bottom', 0, bc); }
    else if (o.bottom === 'skirt') { S.band('body', 0, 9, 11, (i, j) => (j === 9 ? bcD : i % 2 ? bc : bcL)); S.face('body', 'bottom', 0, bc); }
  };
  const heart = (face, i0, j0, c) => { for (const [i, j] of [[0, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2]]) S.px('body', face, 0, i0 + i, j0 + j, c); };
  switch (o.top) {
    case 'tee':
      bodyAll(c1); S.rect('body', 'front', 0, 3, 0, 2, 1, sk); S.px('body', 'front', 0, 2, 0, c1D); S.px('body', 'front', 0, 5, 0, c1D);
      heart('front', 2, 3, c2); armFill(0, 3, (i, j) => (j === 3 ? c1D : c1)); armTop(c1); waist(); break;
    case 'stripe':
      bodyAll((i, j) => (j % 3 === 2 ? c2 : c1)); S.rect('body', 'front', 0, 3, 0, 2, 1, sk);
      armFill(0, 4, (i, j) => (j === 4 ? c1D : j % 3 === 2 ? c2 : c1)); armTop(c1); waist(); break;
    case 'hoodie':
      bodyAll(c1); S.face('body', 'back', 0, (i, j) => (j < 3 ? c1D : c1));
      S.rect('body', 'front', 0, 2, 0, 4, 1, c1D); S.px('body', 'front', 0, 3, 1, c2); S.px('body', 'front', 0, 4, 1, c2); S.px('body', 'front', 0, 3, 2, c2); S.px('body', 'front', 0, 4, 3, c2);
      S.rect('body', 'front', 0, 1, 7, 6, 3, c1D); S.rect('body', 'front', 0, 2, 7, 4, 1, c1);
      S.face('body', 'back', 1, (i, j) => (j < 2 ? c1L : null)); for (let i = 1; i < 7; i++) S.px('body', 'back', 1, i, 2, c1D);
      armFill(0, 10, (i, j) => (j === 10 ? c1D : c1)); armTop(c1); waist(); break;
    case 'cardigan':
      bodyAll(c2); S.face('body', 'back', 0, c1); S.band('body', 0, 0, 11, c1, ['right', 'left']);
      S.face('body', 'front', 0, (i, j) => (i < 2 || i > 5 ? c1 : i === 2 || i === 5 ? c1D : c2));
      for (const j of [2, 5, 8]) S.px('body', 'front', 0, 2, j, [255, 240, 200, 255]);
      S.rect('body', 'front', 0, 3, 0, 2, 1, sk);
      armFill(0, 10, (i, j) => (j === 10 ? c1D : (i + j) % 4 === 0 ? c1L : c1)); armTop(c1); waist(); break;
    case 'dress':
      bodyAll(c1); S.rect('body', 'front', 0, 3, 0, 2, 1, sk);
      S.rect('body', 'front', 0, 2, 0, 1, 2, c2); S.rect('body', 'front', 0, 5, 0, 1, 2, c2); S.rect('body', 'front', 0, 3, 1, 2, 1, c2);
      S.band('body', 0, 6, 6, (i, j, f) => c2D);
      S.px('body', 'front', 0, 3, 6, c2); S.px('body', 'front', 0, 4, 6, c2); S.px('body', 'front', 0, 2, 5, c2); S.px('body', 'front', 0, 5, 5, c2); S.px('body', 'front', 0, 2, 7, c2); S.px('body', 'front', 0, 5, 7, c2);
      S.band('body', 0, 7, 11, (i, j) => (i % 2 ? c1 : c1L));
      S.band('body', 1, 9, 11, (i, j) => (j === 11 ? c2 : i % 2 ? c1 : c1L));
      legFill(0, 3, (i, j) => (j === 3 ? c2 : i % 2 ? c1 : c1L), true); for (const L of legs) S.face(L, 'top', 1, c1);
      armFill(0, 2, (i, j) => (j === 2 ? c2 : c1L)); armFill(0, 1, (i, j) => c1L, true); armTop(c1L); armTop(c1L, true);
      S.face('body', 'bottom', 0, c1); break;
    case 'sailor':
      bodyAll(white); S.face('body', 'back', 0, (i, j) => (j < 4 ? (j === 3 ? white : c1) : white));
      S.rect('body', 'front', 0, 0, 0, 8, 1, c1); S.rect('body', 'front', 0, 0, 1, 2, 1, c1); S.rect('body', 'front', 0, 6, 1, 2, 1, c1);
      S.rect('body', 'front', 0, 3, 0, 2, 1, sk); S.px('body', 'front', 0, 2, 1, c1); S.px('body', 'front', 0, 5, 1, c1);
      S.rect('body', 'front', 0, 3, 2, 2, 2, c2); S.px('body', 'front', 0, 2, 3, c2); S.px('body', 'front', 0, 5, 3, c2); S.px('body', 'front', 0, 3, 4, shadeCol(c2, 0.8)); S.px('body', 'front', 0, 4, 4, shadeCol(c2, 0.8));
      S.band('body', 0, 0, 0, c1, ['right', 'left']);
      armFill(0, 4, (i, j) => (j >= 3 ? c1 : white)); armTop(white); waist(); break;
    case 'overall':
      bodyAll(c2); S.rect('body', 'front', 0, 3, 0, 2, 1, sk);
      S.band('body', 0, 5, 11, c1); S.rect('body', 'front', 0, 1, 3, 6, 2, c1); S.rect('body', 'back', 0, 1, 3, 6, 2, c1);
      for (const i of [1, 6]) { S.rect('body', 'front', 0, i, 0, 1, 3, c1D); S.rect('body', 'back', 0, i, 0, 1, 3, c1D); S.px('body', 'front', 0, i, 3, [255, 215, 90, 255]); }
      S.rect('body', 'front', 0, 3, 6, 2, 2, c1D);
      if (o.bottom !== 'skirt') { legFill(0, Math.min(9, o.shoes === 'boots' ? 6 : 9), (i, j) => (j === 0 ? c1D : c1)); for (const L of legs) S.face(L, 'top', 0, c1); }
      armFill(0, 3, (i, j) => (j === 3 ? c2D : c2)); armTop(c2); S.face('body', 'bottom', 0, c1); break;
    case 'labcoat':
      bodyAll(white); S.face('body', 'front', 0, (i, j) => (i === 3 || i === 4 ? (j < 1 ? sk : c1) : i === 2 || i === 5 ? [226, 230, 238, 255] : white));
      S.px('body', 'front', 0, 1, 5, [200, 205, 215, 255]); S.px('body', 'front', 0, 1, 4, [240, 90, 90, 255]); S.px('body', 'front', 0, 0, 4, [80, 130, 230, 255]);
      S.band('body', 1, 9, 11, (i, j) => (j === 11 ? [220, 224, 232, 255] : white));
      legFill(0, 3, (i, j) => (j === 3 ? [220, 224, 232, 255] : white), true);
      armFill(0, 10, (i, j) => (j === 10 ? c1 : white)); armTop(white); waist();
      S.band('body', 0, 10, 11, (i, j) => white, ['front']); S.rect('body', 'front', 0, 3, 10, 2, 2, o.bottom === 'skirt' ? bc : c1); break;
  }
  // 4) 머리카락
  const hs = o.hair;
  const longish = hs === 'long' || hs === 'twin' || hs === 'wave' || hs === 'bob' || hs === 'pony';
  S.face('head', 'top', 0, hairAt); S.face('head', 'back', 0, hairAt);
  for (const sd of ['right', 'left']) for (let f = 0; f < 8; f++) for (let j = 0; j < 8; j++) {
    let hair = j < 3 || f >= 3;
    if (hs === 'short' || hs === 'spiky' || hs === 'bun') hair = j < 3 || (f >= 3 && j < 7) || (f === 2 && j < 5);
    if (longish) hair = !(f === 0 && j >= 3 && j <= 6) || hs === 'wave';
    if (hair) S.side('head', sd, 0, f, j, hairAt(f, j));
  }
  // 앞머리
  const front = (i, j) => S.px('head', 'front', 0, i, j, hairAt(i, j));
  for (let i = 0; i < 8; i++) { front(i, 0); front(i, 1); }
  const fringe = { short: [0, 1, 3, 6, 7], spiky: [0, 2, 4, 5, 7], bob: [0, 1, 2, 5, 6, 7], long: [0, 1, 2, 6, 7], twin: [0, 1, 2, 3, 4, 5, 6, 7], pony: [0, 1, 2, 3, 6, 7], bun: [0, 1, 6, 7], wave: [0, 1, 2, 5, 6, 7] }[hs] || [0, 7];
  for (const i of fringe) front(i, 2);
  if (longish) for (let j = 3; j < 8; j++) { front(0, j); front(7, j); }
  if (hs === 'spiky') { front(1, 2); }
  // 바깥 층: 머리 부피
  S.face('head', 'top', 1, (i, j) => (hs === 'bun' && i >= 2 && i <= 5 && j >= 2 && j <= 5 ? ((i + j) % 2 ? hD : hc) : hairAt(i + 1, j)));
  S.face('head', 'back', 1, (i, j) => (j < (longish ? 8 : 5) ? hairAt(i, j + 1) : null));
  for (const sd of ['right', 'left']) for (let f = 0; f < 8; f++) for (let j = 0; j < 8; j++) {
    const on = longish ? (f >= 1 || j < 2) : (j < 2 || (f >= 4 && j < 5));
    if (on) S.side('head', sd, 1, f, j, hairAt(f + 2, j));
  }
  for (let i = 0; i < 8; i++) S.px('head', 'front', 1, i, 0, hairAt(i, 3));
  for (const i of fringe) if (i === 0 || i === 7 || hs === 'twin') S.px('head', 'front', 1, i, 1, hairAt(i, 1));
  if (longish) for (let j = 2; j < 8; j++) { S.px('head', 'front', 1, 0, j, hairAt(0, j + 1)); S.px('head', 'front', 1, 7, j, hairAt(7, j + 1)); }
  // 엔젤링 (빛나는 머리결)
  for (const i of [1, 2, 5, 6]) S.px('head', 'front', 0, i, 1, hL);
  if (hs === 'spiky') for (const i of [0, 2, 4, 6]) S.px('head', 'front', 1, i, 1, hc);
  // 긴 머리는 등으로 내려옴
  if (hs === 'long' || hs === 'wave') S.face('body', 'back', 1, (i, j) => (j < 7 || (j === 7 && i % 2 === 0) ? (hs === 'wave' && (i + j) % 3 === 0 ? hD : hairAt(i, j)) : null));
  if (hs === 'bob') S.face('body', 'back', 1, (i, j) => (j < 2 ? hairAt(i, j) : null));
  if (hs === 'twin') for (const i of [0, 1, 6, 7]) for (let j = 0; j < 9; j++) S.px('body', 'back', 1, i, j, j === 8 && (i === 0 || i === 7) ? null : hairAt(i, j));
  if (hs === 'pony') { for (let j = 0; j < 7; j++) { S.px('body', 'back', 1, 3, j, hairAt(3, j)); S.px('body', 'back', 1, 4, j, hairAt(4, j)); } S.px('head', 'back', 1, 3, 4, c2); S.px('head', 'back', 1, 4, 4, c2); }
  if (hs === 'twin') { S.side('head', 'right', 1, 4, 4, c2); S.side('head', 'left', 1, 4, 4, c2); }
  // 5) 얼굴
  const ec = hexRgb(o.eyeCol), eL = shadeCol(ec, 1.35), lash = [45, 30, 40, 255];
  const eye = (x, flip) => {
    const a = flip ? x + 1 : x, b = flip ? x : x + 1; // a: 바깥쪽, b: 안쪽
    const F = (i, j, c) => S.px('head', 'front', 0, i, j, c);
    switch (o.eyes) {
      case 'lash': F(a, 3, lash); F(b, 3, lash); F(a, 4, white); F(b, 4, ec); F(a, 5, ec); F(b, 5, eL); break;
      case 'sparkle': F(a, 3, ec); F(b, 3, ec); F(a, 4, white); F(b, 4, ec); F(a, 5, ec); F(b, 5, eL); break;
      case 'round': F(a, 4, ec); F(b, 4, eL); F(a, 5, ec); F(b, 5, ec); break;
      case 'smile': F(a, 5, lash); F(b, 4, lash); break;
      case 'cat': F(a, 3, lash); F(b, 4, ec); F(a, 4, ec); F(b, 5, lash); F(a, 5, eL); break;
      case 'sleepy': F(a, 5, lash); F(b, 5, lash); F(a, 4, skD); F(b, 4, skD); break;
    }
  };
  eye(1, false); eye(5, true);
  const mc = [214, 92, 116, 255], md = [150, 50, 70, 255];
  switch (o.mouth) {
    case 'smile': S.px('head', 'front', 0, 3, 6, mc); S.px('head', 'front', 0, 4, 6, mc); break;
    case 'open': S.px('head', 'front', 0, 3, 6, md); S.px('head', 'front', 0, 4, 6, md); S.px('head', 'front', 0, 3, 7, [255, 140, 150, 255]); S.px('head', 'front', 0, 4, 7, [255, 140, 150, 255]); break;
    case 'cat': S.px('head', 'front', 0, 2, 6, md); S.px('head', 'front', 0, 5, 6, md); S.px('head', 'front', 0, 3, 7, md); S.px('head', 'front', 0, 4, 7, md); break;
    case 'small': S.px('head', 'front', 0, 4, 6, mc); break;
  }
  if (o.blush && o.deco !== 'freckle') { const bl = [255, 150, 170, 255]; S.px('head', 'front', 0, 1, 6, bl); S.px('head', 'front', 0, 6, 6, bl); }
  // 6) 장식
  if (o.deco === 'glasses') {
    const fr = [70, 60, 90, 255];
    for (const x0 of [0, 4]) { S.rect('head', 'front', 1, x0, 2, 4, 1, fr); for (const j of [3, 4, 5]) { S.px('head', 'front', 1, x0, j, fr); S.px('head', 'front', 1, x0 + 3, j, fr); } S.rect('head', 'front', 1, x0, 6, 4, 1, fr); }
    for (const sd of ['right', 'left']) for (let f = 0; f < 3; f++) S.side('head', sd, 1, f, 4, fr);
  } else if (o.deco === 'heart') { const hr = [255, 100, 145, 255]; S.px('head', 'front', 0, 1, 6, hr); S.px('head', 'front', 0, 6, 6, hr); S.px('head', 'front', 1, 1, 6, hr); S.px('head', 'front', 1, 6, 6, hr); }
  else if (o.deco === 'star') { const st = [255, 220, 80, 255]; S.px('head', 'front', 1, 6, 1, st); S.px('head', 'front', 1, 5, 1, st); S.px('head', 'front', 1, 6, 0, st); S.px('head', 'front', 1, 7, 1, st); S.px('head', 'front', 1, 6, 2, st); }
  else if (o.deco === 'freckle') { const fk = shadeCol(sk, 0.78); S.px('head', 'front', 0, 1, 6, fk); S.px('head', 'front', 0, 2, 7, fk); S.px('head', 'front', 0, 6, 6, fk); S.px('head', 'front', 0, 5, 7, fk); }
  // 손
  for (const A of arms) { S.face(A, 'bottom', 0, skD); }
  return S.p;
}

// ---------------- 아바타 데이터 ----------------
// av = { png: dataURL, slim, acc, pixels(로컬), key }
function avatarKey(png, slim, acc) {
  let h = 2166136261 >>> 0;
  const s = png + '|' + (slim ? 1 : 0) + '|' + JSON.stringify(acc || {});
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
function pixelsToPng(px) {
  const c = document.createElement('canvas'); c.width = c.height = SKIN_W;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), SKIN_W, SKIN_W), 0, 0);
  return c.toDataURL('image/png');
}
// PNG(64x64 또는 옛 64x32) → 64x64 픽셀
function imageToPixels(img) {
  const c = document.createElement('canvas'); c.width = c.height = SKIN_W;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sc = W / 64;
  if (Math.abs(H / W - 0.5) < 0.01) {
    // 옛 형식: 왼팔·왼다리를 오른쪽에서 거울로 복사
    g.drawImage(img, 0, 0, W, H, 0, 0, 64, 32);
    const px = g.getImageData(0, 0, 64, 64).data;
    const cp = (sx, sy, w, h, dx, dy, flip) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const s = ((sy + j) * 64 + sx + (flip ? w - 1 - i : i)) * 4, d = ((dy + j) * 64 + dx + i) * 4; for (let k = 0; k < 4; k++) px[d + k] = px[s + k]; } };
    const mirrorPart = (su, sv, du, dv) => {
      cp(su + 4, sv, 4, 4, du + 4, dv, true); cp(su + 8, sv, 4, 4, du + 8, dv, true);
      cp(su + 8, sv + 4, 4, 12, du, dv + 4, true); cp(su + 4, sv + 4, 4, 12, du + 4, dv + 4, true);
      cp(su, sv + 4, 4, 12, du + 8, dv + 4, true); cp(su + 12, sv + 4, 4, 12, du + 12, dv + 4, true);
    };
    mirrorPart(0, 16, 16, 48); mirrorPart(40, 16, 32, 48);
    return new Uint8ClampedArray(px);
  }
  g.drawImage(img, 0, 0, W, H, 0, 0, 64, 64);
  return new Uint8ClampedArray(g.getImageData(0, 0, 64, 64).data);
}
function pngToPixels(png) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { try { res(imageToPixels(img)); } catch (e) { rej(e); } };
    img.onerror = () => rej(new Error('그림을 읽을 수 없어요'));
    img.src = png;
  });
}
// 받은 아바타 데이터 검사
function sanitizeAvatar(a) {
  if (!a || typeof a !== 'object') return null;
  const png = typeof a.png === 'string' && a.png.startsWith('data:image/png;base64,') && a.png.length < 80000 ? a.png : null;
  if (!png) return null;
  const acc = {};
  const src = a.acc && typeof a.acc === 'object' ? a.acc : {};
  for (const k of ['head', 'hair', 'skirt', 'back']) { const v = String(src[k] || 'none'); acc[k] = AV_ACC[k].some(x => x[0] === v) ? v : 'none'; }
  for (const k of ['headCol', 'hairCol', 'skirtCol', 'backCol']) { const v = String(src[k] || ''); acc[k] = /^#[0-9a-fA-F]{6}$/.test(v) ? v : ''; }
  return { png, slim: !!a.slim, acc };
}
// 디코딩 캐시 (key → {pixels, face, body})
const AVATAR_CACHE = new Map();
function ensureAvatarPixels(av) {
  if (!av || av.pixels) return;
  if (!av.key) av.key = avatarKey(av.png, av.slim, av.acc);
  const c = AVATAR_CACHE.get(av.key);
  if (c) { if (c.pixels) av.pixels = c.pixels; return; }
  const ent = { pixels: null };
  AVATAR_CACHE.set(av.key, ent);
  pngToPixels(av.png).then(px => { ent.pixels = px; av.pixels = px; }).catch(() => { });
}
// 2D 미리보기 그림 (얼굴/전신 정면)
function skinFaceDataUrl(px, size) {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d'); const id = g.createImageData(8, 8);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const o = (j * 8 + i) * 4;
    const b = ((8 + j) * 64 + 8 + i) * 4, t = ((8 + j) * 64 + 40 + i) * 4;
    const ta = px[t + 3] / 255;
    for (let k = 0; k < 3; k++) id.data[o + k] = px[b + k] * (1 - ta) + px[t + k] * ta;
    id.data[o + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  if (!size) return c.toDataURL();
  const c2 = document.createElement('canvas'); c2.width = c2.height = size;
  const g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(c, 0, 0, size, size);
  return c2.toDataURL();
}
function skinBodyCanvas(px, slim, scale) {
  const s = scale || 4, W = 16, H = 33;
  const c = document.createElement('canvas'); c.width = W * s; c.height = H * s;
  const g = c.getContext('2d');
  const put = (part, dx, dy) => {
    for (const over of [0, 1]) {
      const r = skinFaceRect(part, 'front', over, slim);
      const inf = over ? (part === 'head' ? 0.5 : 0.25) : 0;
      for (let j = 0; j < r[3]; j++) for (let i = 0; i < r[2]; i++) {
        const o = ((r[1] + j) * 64 + r[0] + i) * 4;
        if (over && px[o + 3] < 128) continue;
        g.fillStyle = `rgb(${px[o]},${px[o + 1]},${px[o + 2]})`;
        g.fillRect((dx + i - inf * (1 - 2 * i / r[2])) * s, (dy + j - inf * (1 - 2 * j / r[3])) * s, s + 0.5, s + 0.5);
      }
    }
  };
  const aw = slim ? 3 : 4;
  put('head', 4, 0.5); put('body', 4, 8.5); put('rarm', 4 - aw, 8.5); put('larm', 12, 8.5); put('rleg', 4, 20.5); put('lleg', 8, 20.5);
  return c;
}

// ---------------- 3D 그리기 ----------------
// 스킨 상자 묶음: pos3 nrm3 uv2 layer1 light2 tint3 = 14 floats
class SkinBatch {
  constructor() { this.cap = 2048; this.f32 = new Float32Array(this.cap * 14); this.n = 0; }
  reset() { this.n = 0; }
  _grow() { const nf = new Float32Array(this.cap * 2 * 14); nf.set(this.f32); this.f32 = nf; this.cap *= 2; }
  addPart(m, part, over, slim, box, layer, sky, blk, tint) {
    if (this.n + 24 > this.cap) this._grow();
    const f = this.f32, L = layer + (over ? 0 : 1000);
    for (const face of SKIN_FACES) {
      const r = skinFaceRect(part, face, over, slim);
      const C = skinFaceCorners(face, box), N = SKIN_FACE_N[face];
      const wn = [m[0] * N[0] + m[4] * N[1] + m[8] * N[2], m[1] * N[0] + m[5] * N[1] + m[9] * N[2], m[2] * N[0] + m[6] * N[1] + m[10] * N[2]];
      const l = Math.hypot(wn[0], wn[1], wn[2]) || 1;
      const uvs = [[r[0], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]], [r[0] + r[2], r[1]]];
      const ord = [0, 3, 2, 1];
      for (let k = 0; k < 4; k++) {
        const p = C[ord[k]], uv = uvs[k], o = this.n * 14;
        f[o] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
        f[o + 1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
        f[o + 2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
        f[o + 3] = wn[0] / l; f[o + 4] = wn[1] / l; f[o + 5] = wn[2] / l;
        f[o + 6] = uv[0] / 64; f[o + 7] = uv[1] / 64; f[o + 8] = L;
        f[o + 9] = sky; f[o + 10] = blk;
        f[o + 11] = tint[0]; f[o + 12] = tint[1]; f[o + 13] = tint[2];
        this.n++;
      }
    }
  }
}
// 부위 상자 (로컬 좌표, 1/16 단위)
function avatarBoxes(slim) {
  const P = 1 / 16, aw = slim ? 1.5 : 2;
  return {
    head: [-4 * P, 0, -4 * P, 4 * P, 8 * P, 4 * P],
    body: [-4 * P, 12 * P, -2 * P, 4 * P, 24 * P, 2 * P],
    rarm: [-aw * P, -10 * P, -2 * P, aw * P, 2 * P, 2 * P],
    larm: [-aw * P, -10 * P, -2 * P, aw * P, 2 * P, 2 * P],
    rleg: [-2 * P, -12 * P, -2 * P, 2 * P, 0, 2 * P],
    lleg: [-2 * P, -12 * P, -2 * P, 2 * P, 0, 2 * P],
  };
}
function inflateBox(b, e) { return [b[0] - e, b[1] - e, b[2] - e, b[3] + e, b[4] + e, b[5] + e]; }
// 자세 → 부위별 행렬
function avatarMatrices(base, pose, slim) {
  const P = 1 / 16, t = M4.create();
  const sw = pose.sw || 0;
  const mk = (px, py, pz, ax, az) => { const m = new Float32Array(base); const tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); if (ax) M4.mul(m, m, M4.rotX(t, ax)); if (az) M4.mul(m, m, M4.rotZ(t, az)); return m; };
  const ax = slim ? 5.5 : 6;
  const arm = pose.armsOut || 0;
  return {
    body: new Float32Array(base),
    head: mk(0, 24 * P, 0, pose.headPitch || 0, 0),
    rarm: mk(ax * P, 22 * P, 0, sw - (pose.extraSwing ? pose.extraSwing * 1.4 : 0), arm),
    larm: mk(-ax * P, 22 * P, 0, -sw, -arm),
    rleg: mk(2 * P, 12 * P, 0, -sw, 0),
    lleg: mk(-2 * P, 12 * P, 0, sw, 0),
  };
}
// 스킨 모델 + 소품. out.skin: SkinBatch, out.ent: EntityBatch
function renderAvatarModel(skinB, entB, base, pose, av, layer, light, hurt, showOver) {
  const slim = !!(av && av.slim);
  const tint = hurt ? [1.35, 0.55, 0.55] : [1, 1, 1];
  const M = avatarMatrices(base, pose, slim);
  const B = avatarBoxes(slim);
  const P = 1 / 16;
  for (const part of SKIN_PART_KEYS) {
    skinB.addPart(M[part], part, 0, slim, B[part], layer, light[0], light[1], tint);
    if (showOver !== false) skinB.addPart(M[part], part, 1, slim, inflateBox(B[part], (part === 'head' ? 0.5 : 0.25) * P + 0.0005), layer, light[0], light[1], tint);
  }
  if (av && av.acc && entB) renderAvatarAcc(entB, M, av.acc, pose, light, hurt);
  return M;
}
function renderAvatarAcc(eb, M, acc, pose, L, hurt) {
  const P = 1 / 16;
  const tintC = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const col = (h, def) => { const c = hexRgb(h || def); return [c[0] / 255, c[1] / 255, c[2] / 255]; };
  const box = (m, x0, y0, z0, x1, y1, z1, c) => eb.addBox(m, x0 * P, y0 * P, z0 * P, x1 * P, y1 * P, z1 * P, tintC(c), L[0], L[1]);
  const sub = (m, px, py, pz, ax, ay, az) => { const r = new Float32Array(m), t = M4.create(), tr = M4.create(); M4.translate(tr, px * P, py * P, pz * P); M4.mul(r, r, tr); if (ay) M4.mul(r, r, M4.rotY(t, ay)); if (ax) M4.mul(r, r, M4.rotX(t, ax)); if (az) M4.mul(r, r, M4.rotZ(t, az)); return r; };
  const hd = M.head, bd = M.body;
  const time = pose.time || 0, spd = pose.speed || 0;
  const light = (c, k) => [Math.min(1, c[0] + (1 - c[0]) * k), Math.min(1, c[1] + (1 - c[1]) * k), Math.min(1, c[2] + (1 - c[2]) * k)];
  const dark = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const white = [1, 1, 1], pink = [1, 0.66, 0.74], gold = [1, 0.85, 0.3];
  // 머리 소품
  const hc = col(acc.headCol, '#ff6f9a');
  switch (acc.head) {
    case 'ribbon': {
      const m = sub(hd, 0, 5.2, 4.3);
      box(m, -0.8, -0.8, 0, 0.8, 0.8, 1, dark(hc, 0.85));
      box(m, -4, -1.6, 0.1, -0.8, 1.6, 0.8, hc); box(m, 0.8, -1.6, 0.1, 4, 1.6, 0.8, hc);
      box(m, -2.2, -3.6, 0.2, -0.9, -0.8, 0.7, hc); box(m, 0.9, -3.6, 0.2, 2.2, -0.8, 0.7, hc);
      break;
    }
    case 'sideribbon': {
      const m = sub(hd, -3, 8.2, -1, 0, 0, 0.25);
      box(m, -0.7, -0.5, -0.7, 0.7, 0.9, 0.7, dark(hc, 0.85));
      box(m, -3, -0.4, -0.6, -0.7, 2.2, 0.6, hc); box(m, 0.7, -0.4, -0.6, 3, 2.2, 0.6, hc);
      break;
    }
    case 'headband': {
      box(hd, -4.4, 7.5, -1.6, 4.4, 8.5, -0.4, hc);
      box(hd, -4.5, 3.5, -1.6, -4.0, 8.5, -0.4, hc); box(hd, 4.0, 3.5, -1.6, 4.5, 8.5, -0.4, hc);
      const m = sub(hd, 2.2, 8.6, -1);
      box(m, -0.5, -0.1, -0.5, 0.5, 0.9, 0.5, dark(hc, 0.85)); box(m, -2, 0, -0.4, -0.5, 1.6, 0.4, light(hc, 0.2)); box(m, 0.5, 0, -0.4, 2, 1.6, 0.4, light(hc, 0.2));
      break;
    }
    case 'flower': {
      const m = sub(hd, -4.3, 6.3, -1.8);
      box(m, -0.6, -0.6, -0.6, 0.4, 0.6, 0.6, [1, 0.9, 0.35]);
      for (const [dy, dz] of [[1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]]) box(m, -0.5, dy - 0.6, dz - 0.6, 0.3, dy + 0.6, dz + 0.6, hc);
      break;
    }
    case 'crown': {
      const g2 = col(acc.headCol, '#ffd84a');
      box(hd, -3, 8, -3, 3, 9.2, 3, g2);
      for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2], [-0.5, -3], [-0.5, 2], [-3, -0.5], [2, -0.5]]) box(hd, x, 9.2, z, x + 1, 10.6, z + 1, g2);
      box(hd, -0.6, 8.2, -3.3, 0.6, 9, -3, [1, 0.35, 0.55]);
      box(hd, -2.4, 8.3, -3.2, -1.6, 8.9, -3, [0.45, 0.8, 1]); box(hd, 1.6, 8.3, -3.2, 2.4, 8.9, -3, [0.45, 0.8, 1]);
      break;
    }
    case 'cat': case 'bear': {
      const bear = acc.head === 'bear';
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -3.8 : 1.4, x1 = s < 0 ? -1.4 : 3.8;
        if (bear) { box(hd, x0, 7.6, -0.8, x1, 10, 0.8, hc); box(hd, x0 + 0.6, 8.2, -0.95, x1 - 0.6, 9.4, -0.8, pink); }
        else { box(hd, x0, 8, -0.6, x1, 9.4, 0.6, hc); box(hd, x0 + 0.5, 9.4, -0.5, x1 - 0.5, 10.6, 0.5, hc); box(hd, x0 + 0.5, 8.2, -0.75, x1 - 0.5, 9.8, -0.6, pink); }
      }
      break;
    }
    case 'bunny': {
      const wob = Math.sin(time * 3) * 0.08 + spd * 0.2;
      for (const s of [-1, 1]) {
        const m = sub(hd, s * 1.7, 8, 0, 0.1 + wob, 0, s * 0.12);
        box(m, -0.9, 0, -0.5, 0.9, 6, 0.5, hc); box(m, -0.45, 0.6, -0.62, 0.45, 5.2, -0.5, pink);
      }
      break;
    }
    case 'sprout': {
      const m = sub(hd, 0, 8, 0, 0, 0, Math.sin(time * 2) * 0.12);
      const gc = col(acc.headCol, '#6fcf97');
      box(m, -0.3, 0, -0.3, 0.3, 2.4, 0.3, dark(gc, 0.8));
      box(m, -2.6, 2, -0.6, -0.2, 3, 0.6, gc); box(m, 0.2, 2.4, -0.6, 2.4, 3.4, 0.6, light(gc, 0.15));
      break;
    }
    case 'goggles': {
      box(hd, -4.35, 5.6, -4.35, 4.35, 6.6, 4.35, [0.3, 0.28, 0.36]);
      for (const x of [-3.4, 0.6]) { box(hd, x, 5.1, -4.8, x + 2.8, 7.3, -4.2, [0.35, 0.33, 0.42]); box(hd, x + 0.4, 5.5, -4.95, x + 2.4, 6.9, -4.7, hc); }
      break;
    }
  }
  // 3D 머리카락
  const hairC = col(acc.hairCol, '#7a4a2e');
  const sway = Math.sin(time * 2.2) * 0.06 + Math.sin(pose.walk || 0) * 0.12 * Math.min(1, spd);
  switch (acc.hair) {
    case 'twin':
      for (const s of [-1, 1]) {
        const m = sub(hd, s * 4.4, 5.6, 1.2, sway * 0.6, 0, s * (0.18 + sway * 0.4));
        box(m, -0.9, -0.8, -0.9, 0.9, 0.8, 0.9, col(acc.headCol, '#ff6f9a'));
        box(m, -1.3, -7, -1.2, 1.3, -0.6, 1.3, hairC); box(m, -1, -9, -0.9, 1, -7, 1, dark(hairC, 0.9));
      }
      break;
    case 'pony': {
      const m = sub(hd, 0, 5.4, 4.4, -(0.35 + sway), 0, 0);
      box(m, -0.9, -0.9, -0.4, 0.9, 0.9, 0.9, col(acc.headCol, '#ff6f9a'));
      box(m, -1.4, -8, 0.2, 1.4, -0.4, 2.4, hairC); box(m, -1, -10, 0.4, 1, -8, 2.1, dark(hairC, 0.9));
      break;
    }
    case 'bun': box(hd, -2, 8, -0.5, 2, 10.6, 3.5, hairC); box(hd, -2.2, 8, 0.5, 2.2, 8.8, 2.5, col(acc.headCol, '#ff6f9a')); break;
    case 'twinbun': for (const s of [-1, 1]) { box(hd, s < 0 ? -4.6 : 1.6, 7.2, -0.5, s < 0 ? -1.6 : 4.6, 10, 2.5, hairC); } break;
    case 'longback': { const m = sub(hd, 0, 1, 4, -(0.08 + sway * 0.4)); box(m, -4.2, -9, -0.2, 4.2, 7, 1, hairC); box(m, -3.6, -10.5, 0, 3.6, -9, 0.9, dark(hairC, 0.9)); break; }
  }
  // 치마
  const sc = col(acc.skirtCol, '#ff9dbd');
  if (acc.skirt === 'short' || acc.skirt === 'long') {
    box(bd, -4.4, 10.5, -2.4, 4.4, 13, 2.4, sc);
    box(bd, -5, 7.8, -3, 5, 10.6, 3, light(sc, 0.12));
    if (acc.skirt === 'long') { box(bd, -5.5, 4.6, -3.5, 5.5, 7.9, 3.5, sc); box(bd, -5.9, 2.6, -3.9, 5.9, 4.7, 3.9, light(sc, 0.12)); box(bd, -5.95, 2.5, -3.95, 5.95, 3, 3.95, white); }
    else box(bd, -5.05, 7.7, -3.05, 5.05, 8.3, 3.05, white);
  }
  // 등
  const bc = col(acc.backCol, '#c7aef5');
  switch (acc.back) {
    case 'wings': {
      const flap = Math.sin(time * (spd > 0.2 ? 9 : 3)) * 0.18;
      for (const s of [-1, 1]) {
        const m = sub(bd, s * 1, 19, 2.3, 0, -s * (0.5 + flap), 0);
        box(m, s < 0 ? -9 : 0, 0, 0, s < 0 ? 0 : 9, 8, 0.5, light(bc, 0.35));
        box(m, s < 0 ? -8.5 : 0.5, 0.5, 0.1, s < 0 ? -0.5 : 8.5, 7.5, 0.55, bc);
        box(m, s < 0 ? -6 : 0, -5, 0, s < 0 ? 0 : 6, 0, 0.5, light(bc, 0.5));
      }
      break;
    }
    case 'cape': { const m = sub(bd, 0, 24, 2, -(0.08 + Math.min(0.9, spd * 0.6) + Math.sin(time * 2) * 0.03)); box(m, -4.6, -21, 0, 4.6, 0, 0.6, bc); box(m, -4.6, -1, -0.2, 4.6, 0, 0.7, dark(bc, 0.8)); break; }
    case 'backpack': box(bd, -3.4, 14, 2, 3.4, 22.5, 4.8, bc); box(bd, -2.4, 14.6, 4.8, 2.4, 18.5, 5.6, light(bc, 0.2)); box(bd, -3.5, 21, -2.2, -2.5, 22.2, 2, dark(bc, 0.8)); box(bd, 2.5, 21, -2.2, 3.5, 22.2, 2, dark(bc, 0.8)); break;
    case 'tail': { const m = sub(bd, 0, 13, 2, -0.9 + Math.sin(time * 3) * 0.15, 0, Math.sin(time * 2.3) * 0.3); box(m, -0.7, -0.7, 0, 0.7, 0.7, 7, bc); box(m, -0.8, -0.8, 6.5, 0.8, 0.8, 8.5, dark(bc, 0.85)); break; }
  }
}

// ---------------- 저장 ----------------
const AVATAR_STORE_KEY = 'scicraft.avatar.v1';
function loadAvatarStore() {
  try { const j = JSON.parse(localStorage.getItem(AVATAR_STORE_KEY) || 'null'); if (j && j.cur && j.cur.png) return j; } catch (e) { }
  return null;
}
function saveAvatarStore(st) { try { localStorage.setItem(AVATAR_STORE_KEY, JSON.stringify(st)); } catch (e) { } }
function makeAvatar(pixels, slim, acc, opts) {
  const png = pixelsToPng(pixels);
  const a = { png, slim: !!slim, acc: Object.assign({}, AV_ACC_DEFAULT, acc || {}), opts: opts || null, pixels };
  a.key = avatarKey(a.png, a.slim, a.acc);
  AVATAR_CACHE.set(a.key, { pixels });
  return a;
}
function defaultAvatar() {
  const o = Object.assign({}, AV_DEFAULT);
  return makeAvatar(composeSkin(o), o.slim, Object.assign({}, AV_ACC_DEFAULT), o);
}
function avatarNet(a) { return a ? { png: a.png, slim: a.slim, acc: a.acc } : null; }
