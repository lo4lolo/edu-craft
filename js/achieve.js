'use strict';
// =====================================================================
// 에듀 크래프트: 도전 과제 2판 (v1.4)
//  - 10장(첫걸음 → 광부 → 농부·동물 → 모험가 → 용사 → 지옥·엔드 → 점프맵 → 전설의 생물 → 빌더봇·코딩 → 전설)
//  - 등급: 일반(1점) · 심화(2점) · 영웅(4점) · 전설(10점) — 점수로 칭호(새싹 → 전설)
//  - 진행 막대(광석 23/50), 단계별 팁, 먼저 깨야 할 과제(🔒), 숨은 전설(???)
//  - 등급별 보상(경험치·아이템)과 축하 연출, 「다음 목표」 고정(📌 화면 왼쪽 위)
//  - 통계(rec.stats): 캔 광석·다이아·물리친 몹·낚시·거래·이동 거리·가장 깊은 곳·견딘 밤·생물군계·만난 동물…
// =====================================================================
const TIERS = {
  basic: { k: '일반', pt: 1, col: '#5bbf6a', xp: 3, rew: null },
  hard: { k: '심화', pt: 2, col: '#4a8fe0', xp: 8, rew: [['iron_ingot', 4], ['bread', 6], ['arrow', 16], ['torch', 16]] },
  hero: { k: '영웅', pt: 4, col: '#9a5ae0', xp: 20, rew: [['diamond', 2], ['golden_apple', 1], ['emerald', 4], ['experience_bottle', 3]] },
  legend: { k: '전설', pt: 10, col: '#e0a020', xp: 50, rew: [['diamond_block', 1], ['phoenix_totem', 1], ['golden_apple', 3]] },
};
const RANKS = [[0, '🌱 새싹'], [8, '🧭 탐험가'], [25, '🔨 장인'], [55, '🛡 영웅'], [100, '👑 전설']];
const CHAPTERS = [
  ['start', '🌱 1장 · 첫걸음', '나무를 베고 도구를 만들어 첫날 밤을 견뎌요'],
  ['mine', '⛏ 2장 · 광부', '땅속 깊이 내려가 광석을 모아요'],
  ['farm', '🌾 3장 · 농부와 동물 친구', '기르고, 낚고, 길들여요'],
  ['explore', '🏘 4장 · 모험가', '마을을 찾고 세계를 여행해요'],
  ['fight', '⚔ 5장 · 용사', '몬스터를 물리치고 튼튼한 갑옷을 입어요'],
  ['dim', '🔥 6장 · 지옥과 엔드', '지옥문을 열고 엔더 드래곤에 도전해요'],
  ['parkour', '🏃 7장 · 점프맵', '점프맵을 만들고 기록을 깨요'],
  ['myth', '🦄 8장 · 전설의 생물', '유니콘·불사조·구름 양·아기 용을 만나요'],
  ['code', '🤖 9장 · 빌더봇과 코딩', '빌더봇과 코딩 마스터 단계를 이어 가요'],
  ['legend', '👑 10장 · 살아 있는 전설', '진짜 전설만 오를 수 있어요'],
];
// [id, 장, 등급, 아이콘, 이름, 설명, 팁, { items(하나라도) | all(모두) | stat:[키, 목표] | need:[먼저] | any(크리에이티브도) | hide(숨김) | rew }]
const ACH_LIST = [
  ['wood', 'start', 'basic', 'oak_log', '나무 베기', '원목을 처음 얻어요', '나무 밑동을 왼쪽 버튼으로 꾹! 맨손도 돼요.', { items: ['#log'] }],
  ['bench', 'start', 'basic', 'crafting_table', '작업 시작', '제작대를 만들어요', 'E 키 → 원목을 판자로 → 판자 4개로 제작대.', { items: ['crafting_table'], need: ['wood'] }],
  ['pick', 'start', 'basic', 'wood_pickaxe', '광부의 첫걸음', '곡괭이를 만들어요', '제작대에서 판자 3 + 막대기 2.', { items: ['#pickaxe'], need: ['bench'] }],
  ['stone', 'start', 'basic', 'cobblestone', '석기 시대', '조약돌을 얻어요', '곡괭이로 돌을 캐요 (맨손도 되지만 느려요).', { items: ['cobblestone', 'cobbled_deepslate'] }],
  ['furnace', 'start', 'basic', 'furnace', '뜨거운 화로', '화로를 만들어요', '조약돌 8개를 테두리로.', { items: ['furnace'], need: ['stone'] }],
  ['food', 'start', 'basic', 'bread', '냠냠', '음식을 먹어요', '음식을 들고 오른쪽 버튼을 꾹.', {}],
  ['bed', 'start', 'basic', 'bed', '잘 자요', '침대를 만들어요', '양털 3 + 판자 3. 밤에 누우면 아침이 돼요.', { items: ['bed'] }],
  ['night3', 'start', 'hard', 'torch', '밤을 이겨낸 아이', '밤 3번을 견뎌요', '횃불로 집을 밝히면 몬스터가 안 생겨요.', { stat: ['nights', 3] }],
  ['coal', 'mine', 'basic', 'coal', '까만 보물', '석탄을 얻어요', '검은 점이 박힌 돌이 석탄 광석!', { items: ['#coal'] }],
  ['iron', 'mine', 'basic', 'iron_ingot', '철을 얻다', '철 주괴를 만들어요', '철 원석을 화로에서 녹여요.', { items: ['iron_ingot'], need: ['furnace'] }],
  ['redstone', 'mine', 'basic', 'redstone', '전기의 시작', '레드스톤 가루를 얻어요', '깊은 곳의 빨간 광석. 철 곡괭이가 필요해요.', { items: ['redstone'] }],
  ['deep', 'mine', 'hard', 'cobbled_deepslate', '땅속 탐험가', '높이 Y 12 아래까지 내려가요', '계단처럼 파 내려가면 안전해요. 용암 조심!', { stat: ['minYReached', 1] }],
  ['diamond', 'mine', 'hard', 'diamond', '다이아몬드!', '다이아몬드를 찾아요', 'Y 20 아래에서 반짝이는 하늘색 광석.', { items: ['diamond'], need: ['iron'] }],
  ['ore50', 'mine', 'hard', 'iron_ore', '부지런한 광부', '광석 50개를 캐요', '광맥은 한 번에 캐져요.', { stat: ['ore', 50] }],
  ['diamond10', 'mine', 'hero', 'diamond_ore', '다이아 사냥꾼', '다이아몬드 광석 10개를 캐요', '동굴 바닥을 횃불로 밝히며 찾아요.', { stat: ['diamonds', 10], need: ['diamond'] }],
  ['ore500', 'mine', 'legend', 'diamond_block', '광산왕', '광석 500개를 캐요', '효율 마법을 건 곡괭이가 최고!', { stat: ['ore', 500], need: ['ore50'], hide: true }],
  ['farm', 'farm', 'basic', 'wheat', '농부', '밀·당근·감자를 얻어요', '괭이로 흙을 갈고 씨앗을 심어요.', { items: ['wheat', 'carrot', 'potato'] }],
  ['fish', 'farm', 'basic', 'cod', '낚시꾼', '물고기나 보물을 낚아요', '찌가 쏙 들어가면 바로 우클릭!', {}],
  ['tame', 'farm', 'basic', 'bone', '최고의 친구', '동물을 처음 길들여요', '늑대에게 뼈, 말에게 사과.', {}],
  ['honey', 'farm', 'basic', 'honey_bottle', '달콤한 꿀', '벌집에서 꿀이나 밀랍을 모아요', '꿀이 5/5가 되면 빈 병이나 가위.', {}],
  ['ride', 'farm', 'hard', 'saddle', '이랴!', '말·낙타·기린·유니콘을 타요', '길들이고 → 안장(가죽 3 + 철 1) → 우클릭.', { need: ['tame'] }],
  ['fish20', 'farm', 'hard', 'cooked_cod', '바다의 친구', '20번 낚아요', '바다의 행운 마법이면 보물이 더 잘 나와요.', { stat: ['fish', 20], need: ['fish'] }],
  ['scute', 'farm', 'hard', 'turtle_scute', '바닷가 친구', '거북 껍데기 조각을 얻어요', '해변의 거북 곁에서 기다려요.', { items: ['turtle_scute'] }],
  ['tame5', 'farm', 'hero', 'lead', '동물 친구 다섯', '서로 다른 동물 5종을 길들여요', '늑대·말·낙타·기린·앵무새·유니콘·아기 용…', { stat: ['tamedKinds', 5], need: ['tame'] }],
  ['zoo', 'farm', 'legend', 'golden_carrot', '동물의 왕', '서로 다른 동물 8종을 길들여요', '모든 생물군계를 돌아다녀 봐요.', { stat: ['tamedKinds', 8], need: ['tame5'], hide: true }],
  ['village', 'explore', 'basic', 'emerald', '마을 발견', '마을을 찾아요', '/locate village 로 방향을 알 수 있어요.', {}],
  ['trade', 'explore', 'basic', 'emerald', '거래 성사', '주민과 거래해요', '주민을 우클릭!', { need: ['village'] }],
  ['level5', 'explore', 'basic', 'experience_bottle', '경험 많은', '레벨 5에 올라요', '광석 캐기·몹 물리치기·화로·낚시로 경험치.', {}],
  ['enchant', 'explore', 'hard', 'enchanting_table', '마법사', '마법을 부여해요', '책 + 다이아 2 + 흑요석 4 = 마법 부여대.', {}],
  ['travel', 'explore', 'hard', 'compass', '여행자', '1000칸을 이동해요', '말을 타면 금방이에요.', { stat: ['travel', 1000] }],
  ['trade20', 'explore', 'hard', 'emerald_block', '단골손님', '20번 거래해요', '농부에게 밀을 팔면 에메랄드가 모여요.', { stat: ['trades', 20], need: ['trade'] }],
  ['biome8', 'explore', 'hero', 'map', '세계 탐험가', '생물군계 8곳을 가 봐요', '미니맵 색이 바뀌는 곳을 찾아가요.', { stat: ['biomes', 8] }],
  ['level30', 'explore', 'hero', 'experience_bottle', '마법 박사', '레벨 30에 올라요', '경험치 병을 마을 사서에게 사요.', { stat: ['level', 30], need: ['level5'] }],
  ['biome_all', 'explore', 'legend', 'map', '모든 땅을 밟은 자', '생물군계 14곳을 모두 가 봐요', 'v1.3 이후 새로 만든 세계에서만 모두 있어요.', { stat: ['biomes', 14], need: ['biome8'], hide: true }],
  ['hunter', 'fight', 'basic', 'stone_sword', '몬스터 사냥꾼', '적대적 몹을 물리쳐요', '검을 들고 왼쪽 클릭.', {}],
  ['armor', 'fight', 'basic', 'iron_chestplate', '튼튼한 옷', '갑옷을 얻어요', '가죽·철·금·다이아로 만들어요.', { items: ['#armor'] }],
  ['kill50', 'fight', 'hard', 'iron_sword', '마을 지킴이', '몬스터 50마리를 물리쳐요', '활로 멀리서!', { stat: ['kills', 50], need: ['hunter'] }],
  ['ironset', 'fight', 'hard', 'iron_helmet', '철의 기사', '철 갑옷 네 부위를 모두 입어요', '투구·흉갑·레깅스·부츠.', { stat: ['ironSet', 1], need: ['armor'] }],
  ['kill200', 'fight', 'hero', 'diamond_sword', '몬스터 헌터', '몬스터 200마리를 물리쳐요', '날카로움 마법 검이면 빨라요.', { stat: ['kills', 200], need: ['kill50'] }],
  ['diaset', 'fight', 'hero', 'diamond_chestplate', '다이아 기사', '다이아 갑옷 네 부위를 모두 입어요', '다이아몬드 24개가 필요해요.', { stat: ['diaSet', 1], need: ['ironset'] }],
  ['survivor', 'fight', 'legend', 'golden_apple', '불사신', '서바이벌에서 7일 동안 한 번도 안 쓰러져요', '배고픔·밤·높은 곳을 조심!', { stat: ['daysAlive', 7], hide: true }],
  ['obsidian', 'dim', 'basic', 'obsidian', '단단한 돌', '흑요석을 얻어요', '용암 원천에 물을 부어 만들어요.', { items: ['obsidian'] }],
  ['nether', 'dim', 'basic', 'netherrack', '지옥으로', '지옥에 들어가요', '흑요석 4×5 틀 + 부싯돌과 부시.', { need: ['obsidian'] }],
  ['blaze', 'dim', 'hard', 'blaze_rod', '불꽃 사냥', '블레이즈 막대를 얻어요', '지옥 요새의 블레이즈를 물리쳐요.', { items: ['blaze_rod'], need: ['nether'] }],
  ['eye', 'dim', 'hard', 'eye_of_ender', '엔더의 눈', '엔더의 눈을 만들어요', '엔더 진주 + 블레이즈 가루.', { items: ['eye_of_ender'], need: ['blaze'] }],
  ['end', 'dim', 'hero', 'end_stone', '끝의 세계', '엔드에 들어가요', '엔더의 눈을 던져 요새를 찾아요.', { need: ['eye'] }],
  ['dragon', 'dim', 'legend', 'dragon_egg', '드래곤 사냥꾼', '엔더 드래곤을 물리쳐요', '수정부터 활로 부숴요!', { need: ['end'], rew: [['dragon_egg', 0]] }],
  ['pk_build', 'parkour', 'basic', 'parkour_start', '코스 설계자', '출발 발판과 도착 발판을 직접 놓아요', '슬라임 볼로 점프 발판도 만들어 봐요.', { stat: ['pkBuilt', 1], any: true }],
  ['parkour', 'parkour', 'basic', 'parkour_finish', '점프왕', '점프맵을 완주해요', '출발 발판을 밟으면 ⏱ 시작!', { any: true }],
  ['parkour_clean', 'parkour', 'hard', 'jump_pad', '한 번도 안 떨어졌어!', '떨어지지 않고 완주해요', '체크포인트를 믿고 침착하게.', { need: ['parkour'], any: true }],
  ['pk30', 'parkour', 'hard', 'speed_pad', '날쌘돌이', '30초 안에 완주해요', '대시 발판을 놓치지 마요.', { stat: ['pkBest', 30, 'less'], need: ['parkour'], any: true }],
  ['pk10', 'parkour', 'hero', 'parkour_checkpoint', '점프 중독', '점프맵을 10번 완주해요', '친구 코스도 도전!', { stat: ['pkRuns', 10], need: ['parkour'], any: true }],
  ['pk_legend', 'parkour', 'legend', 'rainbow_block', '번개 발', '떨어지지 않고 20초 안에 완주해요', '발판 15개 이상 코스에서 도전해 봐요.', { stat: ['pkBestClean', 20, 'less'], need: ['pk30'], hide: true, any: true }],
  ['mythseen', 'myth', 'basic', 'feather', '신비로운 만남', '상상의 동물을 처음 만나요', '산·벚꽃 숲·메사를 찾아가요.', { stat: ['mythSeen', 1] }],
  ['cloud', 'myth', 'hard', 'cloud_block', '구름 위로', '구름 블록을 얻어요', '산의 구름 양을 가위로.', { items: ['cloud_block'] }],
  ['phoenix', 'myth', 'hard', 'phoenix_feather', '불사조의 선물', '불사조 깃털을 얻어요', '불사조는 사람을 피해요. 깃털을 떨어뜨리길 기다려요.', { items: ['phoenix_feather'] }],
  ['rainbow', 'myth', 'hard', 'rainbow_mane', '무지개 손질', '유니콘의 무지개 갈기를 얻어요', '길들인 유니콘을 가위로 빗어요.', {}],
  ['dragon_pet', 'myth', 'hero', 'golden_apple', '용의 친구', '아기 용을 길들여요', '황금 사과를 줘요.', {}],
  ['unicorn_ride', 'myth', 'hero', 'saddle', '무지개 기수', '유니콘을 타요', '공중에서 Space를 한 번 더!', { need: ['ride'] }],
  ['myth_all', 'myth', 'legend', 'phoenix_totem', '전설의 수집가', '유니콘·불사조·구름 양·아기 용을 모두 만나요', '각자 사는 곳이 달라요.', { stat: ['mythSeen', 4], need: ['mythseen'], hide: true }],
  ['totem_saved', 'myth', 'legend', 'phoenix_totem', '불사조의 가호', '불사조 토템으로 되살아나요', '토템을 가방에 넣고 다녀요.', { hide: true }],
  ['bot', 'code', 'basic', 'builder_remote', '빌더봇 첫 작품', '빌더봇이 무언가를 완성해요', 'B 키로 코딩 창 → ▶ 실행.', { any: true }],
  ['cm1', 'code', 'basic', 'book', '코딩 마스터 1장', '「차례대로」 단계를 모두 깨요', '코딩 창의 🎓 코딩 마스터.', { stat: ['cmChapter', 1], any: true }],
  ['cm2', 'code', 'hard', 'book', '코딩 마스터 2장', '「반복」 단계를 모두 깨요', '같은 일을 여러 번 → 반복 블록!', { stat: ['cmChapter', 2], need: ['cm1'], any: true }],
  ['cm3', 'code', 'hard', 'book', '코딩 마스터 3장', '「변수」 단계를 모두 깨요', 'i 를 바꾸며 반복하면 모양이 달라져요.', { stat: ['cmChapter', 3], need: ['cm2'], any: true }],
  ['cm4', 'code', 'hero', 'bookshelf', '코딩 마스터 4장', '「조건」 단계를 모두 깨요', '만약 ~이면 / 아니면.', { stat: ['cmChapter', 4], need: ['cm3'], any: true }],
  ['cm5', 'code', 'hero', 'bookshelf', '코딩 마스터 5장', '「함수」 단계를 모두 깨요', '자주 쓰는 블록 묶음에 이름을!', { stat: ['cmChapter', 5], need: ['cm4'], any: true }],
  ['bot1000', 'code', 'hard', 'stone_bricks', '부지런한 로봇', '빌더봇으로 블록 1000칸을 놓아요', '큰 건물을 지어 봐요.', { stat: ['botBlocks', 1000], need: ['bot'], any: true }],
  ['bot10000', 'code', 'hero', 'quartz_block', '도시 건설자', '빌더봇으로 블록 10000칸을 놓아요', '함수와 반복으로 도시를!', { stat: ['botBlocks', 10000], need: ['bot1000'], any: true }],
  ['cm_master', 'code', 'legend', 'enchanting_table', '코딩 마스터', '코딩 마스터 모든 단계를 깨요', '마지막 장은 재귀·효율·나만의 점프맵!', { stat: ['cmChapter', 6], need: ['cm5'], hide: true, any: true }],
  ['legend3', 'legend', 'legend', 'nether_star', '살아 있는 전설', '전설 도전 과제 3개를 깨요', '전설은 각 장의 마지막에 숨어 있어요.', { stat: ['legends', 3], hide: true, any: true }],
  ['complete', 'legend', 'legend', 'dragon_egg', '에듀 크래프트 정복', '다른 도전 과제를 모두 깨요', '정말 대단해요!', { stat: ['allDone', 1], need: ['legend3'], hide: true, any: true }],
];
const ACH = {};
for (const a of ACH_LIST) ACH[a[0]] = { id: a[0], ch: a[1], tier: a[2], icon: a[3], name: a[4], desc: a[5], tip: a[6], o: a[7] };
// 옛 형식(ADV 배열)을 쓰는 코드와 맞추기: [id, 아이콘, 이름, 설명, 아이템]
ADV.length = 0;
for (const a of ACH_LIST) ADV.push([a[0], a[3], a[4], a[5], null]);   // 아이템 확인은 achTick 이 함 (옛 확인 코드는 비워 둠)
const MYTHS = ['unicorn', 'phoenix', 'cloud_sheep', 'baby_dragon'];

function achIcon(name) { try { return I(name); } catch (e) { return I('book'); } }
function achItemSet(list) {
  const out = new Set();
  for (const n of list) {
    if (n === '#log') GROUPS.log.forEach(i => out.add(i));
    else if (n === '#coal') GROUPS.coal.forEach(i => out.add(i));
    else if (n === '#pickaxe') ITEMS.forEach(d => d && d.tool && d.tool.kind === 'pick' && out.add(d.id));
    else if (n === '#armor') ITEMS.forEach(d => d && d.armor && out.add(d.id));
    else { try { out.add(I(n)); } catch (e) { } }
  }
  return out;
}
function newStats() { return { ore: 0, diamonds: 0, kills: 0, fish: 0, trades: 0, travel: 0, nights: 0, daysAlive: 0, pkRuns: 0, pkBest: 0, pkBestClean: 0, botBlocks: 0, deaths: 0, tamed: [], biomes: [], myths: [], minY: 999 }; }
// 진행 값 (막대)
function achProgress(g, a) {
  const st = g.stats || newStats(), s = a.o.stat; if (!s) return null;
  const v = {
    nights: st.nights, ore: st.ore, diamonds: st.diamonds, fish: st.fish, trades: st.trades, travel: Math.floor(st.travel), kills: st.kills,
    tamedKinds: (st.tamed || []).length, biomes: (st.biomes || []).length, mythSeen: (st.myths || []).length, level: g.player ? g.player.xpLv || 0 : 0,
    daysAlive: st.daysAlive, pkRuns: st.pkRuns, botBlocks: st.botBlocks, minYReached: st.minY <= 12 ? 1 : 0, pkBuilt: st.pkBuilt ? 1 : 0,
    ironSet: st.ironSet ? 1 : 0, diaSet: st.diaSet ? 1 : 0, cmChapter: codeMasterChapters(), legends: [...(g.adv || [])].filter(id => ACH[id] && ACH[id].tier === 'legend' && id !== 'legend3' && id !== 'complete').length,
    allDone: ACH_LIST.every(x => x[0] === 'complete' || (g.adv && g.adv.has(x[0]))) ? 1 : 0,
    pkBest: st.pkBest || 0, pkBestClean: st.pkBestClean || 0,
  }[s[0]] || 0;
  if (s[2] === 'less') return { v, n: s[1], done: v > 0 && v <= s[1], txt: v ? `최고 ${v.toFixed(1)}초 / 목표 ${s[1]}초` : `목표 ${s[1]}초` };
  return { v: Math.min(v, s[1]), n: s[1], done: v >= s[1], txt: `${Math.min(v, s[1]).toLocaleString()} / ${s[1].toLocaleString()}` };
}
function codeMasterChapters() { return typeof cmChaptersDone === 'function' ? cmChaptersDone() : 0; }
function achLocked(g, a) { return (a.o.need || []).filter(n => !(g.adv && g.adv.has(n))); }
function achPoints(g) { let p = 0; for (const id of g.adv || []) if (ACH[id]) p += TIERS[ACH[id].tier].pt; return p; }
function achRank(pts) { let r = RANKS[0]; for (const x of RANKS) if (pts >= x[0]) r = x; return r; }
function achMaxPoints() { return ACH_LIST.reduce((s, a) => s + TIERS[a[2]].pt, 0); }

// ---------------- 게임: 주기 · 통계 · 달성 ----------------
{
  const G = Game.prototype;
  // 달성 (모든 곳에서 부름). 같은 일이 또 일어나면 통계만 셈
  G.advGrant = function (id) {
    const st = this.stats || (this.stats = newStats());
    if (id === 'fish') st.fish++; else if (id === 'trade') st.trades++; else if (id === 'parkour') st.pkRuns++;
    if (id === 'ride' && this.player && this.player.riding && this.player.riding.sub === 'unicorn') this.advGrant('unicorn_ride');
    if (!this.adv || this.adv.has(id) || !this.player) return;
    const a = ACH[id]; if (!a) return;
    if (this.player.creative && !a.o.any) return;
    this.adv.add(id);
    const T = TIERS[a.tier], p = this.player;
    // 보상
    this.spawnXP(p.x, p.y + 1, p.z, T.xp);
    let rew = a.o.rew || (T.rew ? [T.rew[(this.adv.size * 7) % T.rew.length]] : null), got = '';
    if (rew && !p.creative) for (const [n, c] of rew) if (c > 0) { const iid = I(n), left = p.give(iid, c); if (left) this.dropItem(p.x, p.y + 1, p.z, { id: iid, n: left }); got += ` · 🎁 ${itemName(iid)} ×${c}`; }
    // 알림 (등급마다 다르게)
    const pts = achPoints(this), rank = achRank(pts), before = achRank(pts - T.pt);
    this.ui.chatLine(`🏆 [${T.k}] 「${a.name}」 — ${a.desc}${got}`, a.tier === 'legend' ? '#ffd24a' : a.tier === 'hero' ? '#d8a8ff' : '#ffe27a');
    this.ui.achBanner(a, got);
    if (a.tier === 'legend' || a.tier === 'hero') {
      this.sound.play(a.tier === 'legend' ? 'victory' : 'levelup');
      const cols = a.tier === 'legend' ? [[1, 0.85, 0.3], [1, 0.6, 0.2], [1, 1, 0.6]] : [[0.75, 0.5, 1], [0.6, 0.8, 1]];
      for (let k = 0; k < (a.tier === 'legend' ? 6 : 3); k++) this.particles.smoke(p.x, p.y + 1.6, p.z, 10, cols[k % cols.length], true);
    } else this.sound.play('levelup');
    if (rank !== before) setTimeout(() => this.ui.toast(`✨ 새 칭호: ${rank[1]} (도전 점수 ${pts})`, 4000), 1500);
    if (this.net && this.net.connected && (a.tier === 'legend' || a.tier === 'hero')) this.net.sendChat(`🏆 ${p.name}님이 [${T.k}] 「${a.name}」을(를) 달성했어요!`);
    if (this.achPin === id) this.achPin = null;
    this.ui.refreshHotbar();
    this.achCheckMeta();
  };
  G.achCheckMeta = function () {
    for (const id of ['legend3', 'complete']) { const a = ACH[id], pr = achProgress(this, a); if (pr && pr.done && !achLocked(this, a).length) this.advGrant(id); }
  };
  // 1초마다: 아이템·통계·진행 확인
  G.achTick = function (dt) {
    const p = this.player, w = this.world, st = this.stats || (this.stats = newStats());
    // 이동 거리 (순간이동은 빼고)
    if (this._achLast) { const d = Math.hypot(p.x - this._achLast[0], p.z - this._achLast[1]); if (d < 30 && !p.creative) st.travel += d; }
    this._achLast = [p.x, p.z];
    this._achT = (this._achT || 0) - dt; if (this._achT > 0) return; this._achT = 1;
    if (!p.creative && !p.dead) {
      if (p.y < st.minY) st.minY = Math.floor(p.y);
      // 밤 · 날짜
      const t = w.time, lt = this._achTime === undefined ? t : this._achTime; this._achTime = t;
      if (w.dim === 'overworld' && lt < 18000 && t >= 18000) st.nights++;
      if (t < lt - 12000) { st.daysAlive++; }
      // 생물군계·만난 동물·길들인 동물
      if (w.dim === 'overworld') { const b = w.biomeAt(Math.floor(p.x), Math.floor(p.z)); if (!st.biomes.includes(b)) st.biomes.push(b); }
      for (const e of this.ents.list) {
        if (e.dead || e.type !== 'mob') continue;
        if (MYTHS.includes(e.sub) && !st.myths.includes(e.sub) && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < 900) st.myths.push(e.sub);
        if (e.tamed && e.owner === p.name && !st.tamed.includes(e.sub)) { st.tamed.push(e.sub); this.advGrant('tame'); }
      }
      if (st.myths.length) this.advGrant('mythseen');
      // 갑옷 세트
      const arm = (p.armor || []).map(a => a && ITEMS[a.id] ? ITEMS[a.id].name : '');
      if (arm.every(n => n.startsWith('iron_'))) st.ironSet = 1;
      if (arm.every(n => n.startsWith('diamond_'))) st.diaSet = 1;
      // 아이템 과제
      if (this.found) for (const a of ACH_LIST) {
        const o = a[7]; if (this.adv.has(a[0])) continue;
        if (o.items) { const set = a._set || (a._set = achItemSet(o.items)); for (const f of set) if (this.found.has(f)) { this.advGrant(a[0]); break; } }
      }
      if (w.dim === 'nether') this.advGrant('nether');
      if (w.dim === 'end') this.advGrant('end');
      if (this.dragon && this.dragon.dead) this.advGrant('dragon');
      if ((p.xpLv || 0) >= 5) this.advGrant('level5');
    }
    // 통계 과제 (크리에이티브는 any 인 것만 advGrant 에서 걸러짐)
    for (const a of ACH_LIST) {
      if (!a[7].stat || this.adv.has(a[0])) continue;
      const A = ACH[a[0]], pr = achProgress(this, A);
      if (pr && pr.done && !achLocked(this, A).length) this.advGrant(a[0]);
    }
    this.updateAchPin();
  };
  // 📌 고정한 목표
  G.updateAchPin = function () {
    const el = this._pinEl || (this._pinEl = (() => { const d = document.createElement('div'); d.id = 'ach-pin'; d.title = 'L 키로 도전 과제'; d.onclick = () => this.ui.showAdvancements(); document.getElementById('hud').appendChild(d); return d; })());
    let id = this.achPin;
    if (!id || this.adv.has(id)) id = this.achPin = null;
    const a = id ? ACH[id] : achSuggest(this, 1)[0];
    if (!a) { if (el._k) { el._k = ''; el.classList.remove('show'); } return; }
    const pr = achProgress(this, a);
    const k = a.id + '|' + (pr ? pr.txt : '') + '|' + !!this.achPin;
    if (el._k === k) return;
    el._k = k; el.classList.add('show');
    el.innerHTML = `<span class="ap-tag" style="background:${TIERS[a.tier].col}">${this.achPin ? '📌' : '🎯 다음'}</span> <b>${esc(a.name)}</b> <small>${esc(pr ? pr.txt : a.desc)}</small>`;
  };
  const _update = G.update;
  G.update = function (dt) { _update.call(this, dt); if (this.state === 'play' && this.adv) this.achTick(dt); };
  // 통계 모으기
  const _pb = G.playerBreak;
  G.playerBreak = function (hit) {
    const w = this.world, id = w.getBlock(hit.x, hit.y, hit.z), p = this.player, held = p.held, tool = held && ITEMS[held.id] && ITEMS[held.id].tool;
    _pb.call(this, hit);
    const d = BLOCKS[id];
    if (!p.creative && d && /_ore$/.test(d.name) && w.getBlock(hit.x, hit.y, hit.z) !== id && (!d.lvl || (tool && tool.kind === 'pick' && tool.tier >= d.lvl))) {
      const st = this.stats; st.ore++; if (id === BL.diamond_ore) st.diamonds++;
    }
  };
  const _dmg = G.damageEntity;
  G.damageEntity = function (e, dmg, kx, kz, src) {
    const was = e && e.dead;
    _dmg.call(this, e, dmg, kx, kz, src);
    if (e && !was && e.dead && e.type === 'mob' && e.def && e.def.hostile && (src === 'player' || src === 'arrow' || src === 'pet') && this.stats) { this.stats.kills++; this.advGrant('hunter'); }
  };
  const _death = G.onPlayerDeath;
  G.onPlayerDeath = function (src) { if (this.stats) { this.stats.deaths++; this.stats.daysAlive = 0; } return _death.call(this, src); };
  const _place = G.placeBlock;
  G.placeBlock = function (hit, bid, held) {
    _place.call(this, hit, bid, held);
    if ((bid === PK.start || bid === PK.finish) && this.stats) { this.stats['pk_' + bid] = 1; if (this.stats['pk_' + PK.start] && this.stats['pk_' + PK.finish]) this.stats.pkBuilt = 1; }
  };
  const _pkf = G.pkFinish;
  G.pkFinish = function (key, t, r) {
    const st = this.stats;
    if (st) { st.pkBest = st.pkBest ? Math.min(st.pkBest, t) : t; if (!r.falls) st.pkBestClean = st.pkBestClean ? Math.min(st.pkBestClean, t) : t; }
    return _pkf.call(this, key, t, r);
  };
  // 저장
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    const rec = opt.rec;
    this.stats = Object.assign(newStats(), rec && rec.stats ? JSON.parse(JSON.stringify(rec.stats)) : {});
    this._achLast = null; this._achTime = undefined;
    try { this.achPin = localStorage.getItem('educraft.achPin') || null; } catch (e) { this.achPin = null; }
    const r = await _sw.call(this, opt);
    // 옛 이름 정리
    if (this.adv) { this.adv.delete('coder'); }
    return r;
  };
  const _ser = G.serializeWorld;
  G.serializeWorld = function () { const r = _ser.call(this); r.stats = this.stats || newStats(); return r; };
}
// 빌더봇이 놓은 블록 수
{
  const B = Builder.prototype;
  const count = (b) => { const g = b.g, d = b.placed - (b._counted || 0); if (d > 0 && g.stats) g.stats.botBlocks += d; b._counted = b.placed; };
  const _run = B.run; B.run = function (opt) { this._counted = 0; return _run.call(this, opt); };
  const _fin = B.finishRun; B.finishRun = function () { count(this); return _fin.call(this); };
  const _stop = B.stop; B.stop = function (q) { if (this.running) count(this); return _stop.call(this, q); };
}
// 다음에 하면 좋은 목표: 앞 장부터, 먼저 할 것이 끝난 것, 쉬운 등급부터
function achSuggest(g, n) {
  const order = { basic: 0, hard: 1, hero: 2, legend: 3 }, out = [];
  for (const [ch] of CHAPTERS) {
    const list = ACH_LIST.filter(a => a[1] === ch && !g.adv.has(a[0]) && !achLocked(g, ACH[a[0]]).length && !(g.player && g.player.creative && !a[7].any)).sort((a, b) => order[a[2]] - order[b[2]]);
    for (const a of list) { if (out.length >= n) return out; if (a[2] === 'legend' && out.length) continue; out.push(ACH[a[0]]); }
    if (out.length >= n) break;
  }
  return out;
}

// ---------------- 화면 ----------------
UI.prototype.achBanner = function (a, got) {
  const T = TIERS[a.tier];
  const d = document.createElement('div'); d.className = 'ach-banner t-' + a.tier;
  d.innerHTML = `<i class="ic"></i><div><small>${a.tier === 'legend' ? '✨ 전설 도전 과제 달성! ✨' : '도전 과제 달성'} · ${T.k}</small><b>${esc(a.name)}</b><span>${esc(a.desc)}${esc(got || '')}</span></div>`;
  applyIcon(d.querySelector('i'), achIcon(a.icon));
  document.getElementById('toasts').appendChild(d);
  setTimeout(() => d.classList.add('out'), a.tier === 'legend' ? 6000 : 3500);
  setTimeout(() => d.remove(), a.tier === 'legend' ? 6800 : 4200);
};
UI.prototype.showAdvancements = function (back) {
  const g = this.g;
  this.modal = 'settings'; document.body.classList.add('modal'); g.input.releaseLock();
  const have = g.adv || new Set(), pts = achPoints(g), rank = achRank(pts), next = RANKS.find(r => r[0] > pts);
  const total = ACH_LIST.length;
  const tabs = CHAPTERS.map(([id, name]) => { const list = ACH_LIST.filter(a => a[1] === id), d = list.filter(a => have.has(a[0])).length; return `<button data-ch="${id}" class="${d === list.length ? 'full' : ''}">${name.split(' · ')[0]} <small>${d}/${list.length}</small></button>`; }).join('');
  const s = this.screen('menu-adv', `<div class="panel adv-panel">
      <div class="adv-head"><div><h2>🏆 도전 과제</h2><div class="adv-rank">${rank[1]} · 도전 점수 <b>${pts}</b> / ${achMaxPoints()}${next ? ` <small>(다음 칭호 ${next[1]}까지 ${next[0] - pts}점)</small>` : ''}</div></div>
        <div class="adv-total"><b>${have.size}</b> / ${total}<div class="adv-bar"><i style="width:${have.size / total * 100}%"></i></div></div></div>
      <div class="adv-legend"><span class="tb t-basic">일반 1점</span><span class="tb t-hard">심화 2점</span><span class="tb t-hero">영웅 4점</span><span class="tb t-legend">전설 10점</span><span class="muted">카드를 누르면 📌 화면에 고정돼요 · L 키</span></div>
      <div class="adv-next" id="adv-next"></div>
      <div class="adv-tabs" id="adv-tabs">${tabs}</div>
      <div id="adv-body"></div>
      <div class="row"><span style="flex:1"></span><button class="btn primary" id="adv-back">돌아가기</button></div></div>`);
  const draw = (ch) => {
    $$('#adv-tabs button', s).forEach(b => b.classList.toggle('on', b.dataset.ch === ch));
    const C = CHAPTERS.find(c => c[0] === ch);
    const cards = ACH_LIST.filter(a => a[1] === ch).map(a => {
      const A = ACH[a[0]], done = have.has(a[0]), lock = achLocked(g, A), hidden = A.o.hide && !done && lock.length, pr = achProgress(g, A);
      const creativeBlock = g.player && g.player.creative && !A.o.any && !done;
      return `<div class="adv-card t-${A.tier} ${done ? 'done' : ''} ${lock.length && !done ? 'locked' : ''} ${g.achPin === A.id ? 'pinned' : ''}" data-id="${A.id}">
        <i class="ic adv-ic" data-icon="${A.icon}"></i><div class="ac-body">
        <div class="ac-top"><span class="tb t-${A.tier}">${TIERS[A.tier].k}</span>${done ? ' ✅' : lock.length ? ' 🔒' : ''}</div>
        <b>${hidden ? '??? 숨은 전설' : esc(A.name)}</b><small>${hidden ? '먼저 「' + esc(ACH[lock[0]].name) + '」을(를) 깨면 보여요' : esc(A.desc)}</small>
        ${!done && !hidden && lock.length ? `<small class="ac-need">먼저: ${lock.map(n => '「' + esc(ACH[n].name) + '」').join(' ')}</small>` : ''}
        ${!done && !hidden && pr ? `<div class="ac-bar"><i style="width:${Math.min(100, pr.n ? (pr.v / pr.n) * 100 : 0)}%"></i></div><small>${pr.txt}</small>` : ''}
        ${!done && !hidden ? `<small class="ac-tip">💡 ${esc(A.tip)}</small>` : ''}
        ${creativeBlock ? '<small class="ac-need">서바이벌에서 깰 수 있어요</small>' : ''}
        ${done && A.id === 'cm_master' ? '<small class="ac-tip">🏅 눌러서 디지털 배지 받기</small>' : ''}
        </div></div>`;
    }).join('');
    $('#adv-body', s).innerHTML = `<p class="muted adv-chdesc">${esc(C[2])}</p><div class="adv-grid">${cards}</div>`;
    $$('.adv-ic', s).forEach(el => applyIcon(el, achIcon(el.dataset.icon)));
    $$('.adv-card', s).forEach(el => el.onclick = () => {
      const id = el.dataset.id;
      if (have.has(id) && id === 'cm_master' && g.state === 'play') { this.closeModal(true); setTimeout(() => { this.openCode(); const b = document.getElementById('cd-mis'); if (b) b.click(); }, 50); return; }   // 🏅 배지 받으러
      if (have.has(id)) return;
      g.achPin = g.achPin === id ? null : id;
      try { if (g.achPin) localStorage.setItem('educraft.achPin', g.achPin); else localStorage.removeItem('educraft.achPin'); } catch (e) { }
      this.toast(g.achPin ? `📌 「${ACH[id].name}」을(를) 화면에 고정했어요` : '고정을 풀었어요', 1500);
      draw(ch);
    });
  };
  const sug = achSuggest(g, 3);
  $('#adv-next', s).innerHTML = sug.length ? '🎯 다음 추천: ' + sug.map(a => `<button class="an" data-id="${a.id}" data-ch="${a.ch}"><span class="tb t-${a.tier}">${TIERS[a.tier].k}</span> ${esc(a.name)}</button>`).join('') : '🎉 지금 할 수 있는 도전을 모두 깼어요!';
  $$('#adv-next .an', s).forEach(b => b.onclick = () => draw(b.dataset.ch));
  $$('#adv-tabs button', s).forEach(b => b.onclick = () => draw(b.dataset.ch));
  draw(sug.length ? sug[0].ch : 'start');
  $('#adv-back', s).onclick = () => { if (back) back(); else this.closeModal(); };
  this.show('menu-adv');
};
