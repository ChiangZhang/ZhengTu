const ROWS = 6, COLS = 5;

// ========== 卡牌定义 ==========
const CARD_DEFS = {
    iron_sword:   { name:"铁剑攻击", type:"atk", cat:"atk", desc:"对1个目标造成1000伤害", dmg:1000, basic:true },
    sword_rain:   { name:"剑雨",    type:"dmg", cat:"dmg", desc:"对所有敌人造成1500伤害", dmg:1500, basic:false },
    torch:        { name:"火炬",    type:"dmg", cat:"dmg", desc:"十字范围500伤害,持续2回合", dmg:500, basic:false },
    block:        { name:"格挡",    type:"def", cat:"def", desc:"抵挡1次伤害", basic:true },
    immunity:     { name:"免疫",    type:"def", cat:"def", desc:"免疫1次控制效果", basic:true },
    freeze:       { name:"冰冻",    type:"ctrl", cat:"ctrl", desc:"目标下回合无法出牌", basic:true },
    vine:         { name:"藤蔓蔓延", type:"ctrl", cat:"ctrl", desc:"目标下回合无法抽牌", basic:false },
    devour:       { name:"吞噬",    type:"ctrl", cat:"ctrl", desc:"丢弃目标1张手牌", basic:true },
    steal:        { name:"妙手",    type:"ctrl", cat:"ctrl", desc:"偷取目标1张手牌", basic:false },
    disarm:       { name:"缴械",    type:"ctrl", cat:"ctrl", desc:"拆除目标1张装备", basic:true },
    barricade:    { name:"封锁",    type:"ctrl", cat:"ctrl", desc:"封锁1格,持续1回合", basic:false },
    truce:        { name:"休战令",  type:"ctrl", cat:"ctrl", desc:"全场无法使用负面牌,持续1回合", basic:false },
    heal_card:    { name:"恢复",    type:"buff", cat:"buff", desc:"恢复1000血量", heal:1000, basic:true },
    shield_card:  { name:"护盾",    type:"buff", cat:"buff", desc:"获得1000护盾,持续5回合", shieldVal:1000, basic:true },
    supply:       { name:"补给箱",  type:"buff", cat:"buff", desc:"额外抽3张牌", draw:3, basic:false },
    knight_sword: { name:"骑士之剑",type:"equip",cat:"equip",desc:"攻击距离+1（可叠加）", basic:true },
    armor:        { name:"铁甲",    type:"equip",cat:"equip",desc:"手牌≥3时伤害免疫+500（可叠加）", basic:true },
};

const CONTROL_ICONS = {
    freeze: { icon:"❄️", title:"受到冰冻！" },
    vine:   { icon:"🌿", title:"藤蔓蔓延！" },
    devour: { icon:"👹", title:"遭到吞噬！" },
    steal:  { icon:"🤏", title:"遭到偷窃！" },
    disarm: { icon:"🔨", title:"遭到缴械！" },
};

// ========== 共享牌堆 ==========
const CARD_COUNTS = {
    iron_sword:120, sword_rain:10, torch:30,
    block:210, immunity:70,
    freeze:30, vine:20, devour:35, steal:20, disarm:18, barricade:30, truce:5,
    knight_sword:7, armor:6,
    heal_card:60, shield_card:40, supply:15
};

let drawPile = [];

function buildDrawPile() {
    drawPile = [];
    for (let [id, count] of Object.entries(CARD_COUNTS)) {
        for (let i = 0; i < count; i++) drawPile.push(id);
    }
    for (let i = drawPile.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [drawPile[i], drawPile[j]] = [drawPile[j], drawPile[i]];
    }
}

function makeCard(id) {
    return { ...CARD_DEFS[id], id, uid: Math.random().toString(36).slice(2, 8) };
}

function drawFromPile(unit, n) {
    if (unit.noDrawNextTurn) return;
    for (let i = 0; i < n; i++) {
        if (drawPile.length === 0) { addLog("🔄 牌堆已空，重新洗牌！"); buildDrawPile(); }
        unit.hand.push(makeCard(drawPile.pop()));
    }
}

// ========== 反应时间系统 ==========
const REACTION_TIME = 8000;
let reactionTimer = { rafId: null, startTime: 0, barEl: null, onExpire: null };

function startReactionTimer(barElId, onExpire) {
    stopReactionTimer();
    let barEl = document.getElementById(barElId);
    if (!barEl) return;
    barEl.style.width = "100%";
    reactionTimer.startTime = Date.now();
    reactionTimer.barEl = barEl;
    reactionTimer.onExpire = onExpire;

    function tick() {
        let elapsed = Date.now() - reactionTimer.startTime;
        let ratio = Math.max(0, 1 - elapsed / REACTION_TIME);
        reactionTimer.barEl.style.width = (ratio * 100) + "%";
        if (ratio <= 0) {
            stopReactionTimer();
            onExpire();
            return;
        }
        reactionTimer.rafId = requestAnimationFrame(tick);
    }
    reactionTimer.rafId = requestAnimationFrame(tick);
}

function stopReactionTimer() {
    if (reactionTimer.rafId) { cancelAnimationFrame(reactionTimer.rafId); reactionTimer.rafId = null; }
    reactionTimer.barEl = null; reactionTimer.onExpire = null;
}

// ========== 角色初始化 ==========
function initUnits() {
    let u = [
        { name:"玩家1", team:"friend", row:4, col:1, hp:5000, maxHp:5000, shield:0, hand:[], equips:[], effects:[], isPlayer:true, torchBoosted:false },
        { name:"队友2", team:"friend", row:5, col:2, hp:5000, maxHp:5000, shield:0, hand:[], equips:[], effects:[], isPlayer:false, torchBoosted:false },
        { name:"队友3", team:"friend", row:4, col:3, hp:5000, maxHp:5000, shield:0, hand:[], equips:[], effects:[], isPlayer:false, torchBoosted:false },
        { name:"敌人1", team:"enemy",  row:1, col:1, hp:5000, maxHp:5000, shield:0, hand:[], equips:[], effects:[], isPlayer:false, torchBoosted:false },
        { name:"敌人2", team:"enemy",  row:0, col:2, hp:5000, maxHp:5000, shield:0, hand:[], equips:[], effects:[], isPlayer:false, torchBoosted:false },
        { name:"敌人3", team:"enemy",  row:1, col:3, hp:5000, maxHp:5000, shield:0, hand:[], equips:[], effects:[], isPlayer:false, torchBoosted:false },
    ];
    
    u.forEach(x => drawFromPile(x, 5));
    return u;
    
    /*
    // 玩家：测试
    u[0].hand = [
        makeCard("card_name"), makeCard("card_name"), makeCard("card_name"),
        makeCard("card_name"), makeCard("card_name"),
    ];
    // 敌人：测试
    u.filter(x => x.team === "enemy").forEach(x => {
        x.hand = [
            makeCard("card_name"), makeCard("card_name"), makeCard("card_name"),
            makeCard("card_name"), makeCard("card_name"),
        ];
    });
    return u;
    */
}

// ========== 全局状态 ==========
let units, round, turnIdx, phase, selectedCard;
let hasMoved, hasAttacked;
let blockedCells, fireCells;
let pendingAttack, pendingDying, pendingFireDmg, pendingControl;
let pendingTorchCard = null;
let pendingEquipCard = null;
let logLines = [];

function restart() {
    round = 1; turnIdx = 0; phase = "idle"; selectedCard = null;
    hasMoved = false; hasAttacked = false;
    blockedCells = []; fireCells = [];
    pendingAttack = null; pendingDying = null; pendingFireDmg = null; pendingControl = null;
    pendingTorchCard = null; pendingEquipCard = null;
    stopReactionTimer();
    logLines = [];
    buildDrawPile();
    units = initUnits();
    document.getElementById("victoryModal").classList.add("hidden");
    document.getElementById("defeatModal").classList.add("hidden");
    document.getElementById("dyingModal").classList.add("hidden");
    document.getElementById("fireModal").classList.add("hidden");
    document.getElementById("controlModal").classList.add("hidden");
    document.getElementById("torchModal").classList.add("hidden");
    document.getElementById("teammateModal").classList.add("hidden");
    document.getElementById("equipReplaceModal").classList.add("hidden");
    document.getElementById("defendModal").classList.add("hidden");
    addLog("游戏开始！第1回合");
    startTurn();
}

// ========== 工具函数 ==========
function cur() { return units[turnIdx]; }
function alive(t) { return units.filter(x => x.team === t && x.hp > 0); }
function hasEquip(u, id) { return u.equips.some(e => e.id === id); }
function countEquip(u, id) { return u.equips.filter(e => e.id === id).length; }
function removeCard(u, card) { u.hand = u.hand.filter(c => c.uid !== card.uid); }
function territory(r) { return r < 3 ? "enemy" : "friend"; }
function getRange(u) { return 1 + countEquip(u, "knight_sword"); }
function getArmorReduction(u) { let n = countEquip(u, "armor"); return (n > 0 && u.hand.length >= 3) ? 500 * n : 0; }

function addLog(s) {
    logLines.push(s);
    let el = document.getElementById("log");
    el.innerHTML = logLines.map(l => `<div class="log-entry">${l}</div>`).join("");
    el.scrollTop = el.scrollHeight;
}

// ========== 火焰叠加系统 ==========
function getFireTotalStacks(row, col) {
    return fireCells.filter(f => f.row === row && f.col === col).reduce((s, f) => s + f.stacks, 0);
}
function getFireHostileStacks(row, col, unitTeam) {
    return fireCells.filter(f => f.row === row && f.col === col && f.fromTeam !== unitTeam).reduce((s, f) => s + f.stacks, 0);
}
function addFireToCell(row, col, fromTeam) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    let totalStacks = getFireTotalStacks(row, col);
    if (totalStacks >= 3) return;
    let existing = fireCells.find(f => f.row === row && f.col === col && f.fromTeam === fromTeam);
    if (existing) { existing.stacks++; existing.turns += 6; }
    else fireCells.push({ row, col, turns: 12, fromTeam, stacks: 1 });
}

// ========== 移动 ==========
function getMoveTargets(u) {
    let targets = [];
    let maxDist = territory(u.row) === u.team ? 2 : 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        let d = Math.abs(r - u.row) + Math.abs(c - u.col);
        if (d > 0 && d <= maxDist
            && !units.some(x => x.row === r && x.col === c && x.hp > 0)
            && !blockedCells.some(b => b.row === r && b.col === c)) {
            targets.push({ r, c });
        }
    }
    return targets;
}

// ========== 渲染 ==========
function draw() {
    if (alive("enemy").length === 0) { document.getElementById("victoryModal").classList.remove("hidden"); return; }
    if (alive("friend").length === 0) { document.getElementById("defeatModal").classList.remove("hidden"); return; }

    let u = cur();
    document.getElementById("iRound").textContent = round;
    document.getElementById("iName").textContent = u.name;
    document.getElementById("iHp").textContent = u.hp;
    document.getElementById("iShield").textContent = u.shield;
    document.getElementById("iDeck").textContent = drawPile.length;

    let bar = document.getElementById("unitCardsBar");
    bar.innerHTML = "";
    units.forEach((unit, i) => {
        let d = document.createElement("div");
        d.className = `unit-card-item ${unit.team}`;
        if (i === turnIdx) d.classList.add("active");
        if (unit.hp <= 0) d.classList.add("dead");
        let slots = "";
        for (let s = 0; s < 3; s++) {
            if (unit.equips[s]) {
                let ic = unit.equips[s].id === "knight_sword" ? "⚔️" : unit.equips[s].id === "armor" ? "🔰" : "📦";
                slots += `<span style="display:inline-block;width:16px;height:16px;background:#333;border-radius:3px;text-align:center;font-size:10px;line-height:16px;margin-left:1px">${ic}</span>`;
            } else {
                slots += `<span style="display:inline-block;width:16px;height:16px;background:#222;border:1px solid #444;border-radius:3px;text-align:center;font-size:8px;line-height:16px;margin-left:1px;color:#555">·</span>`;
            }
        }
        d.innerHTML = `<span>${unit.name}</span><span>🃏${unit.hand.length}</span><span>❤️${unit.hp}</span><span style="margin-left:2px">${slots}</span>`;
        if (unit.team === "friend" && !unit.isPlayer) {
            d.style.cursor = "pointer"; d.title = "点击查看手牌";
            let ref = unit; d.onclick = () => showTeammateModal(ref);
        }
        bar.appendChild(d);
    });

    let phaseNames = {
        idle: "等待操作", moving: "选择移动目标", targeting: "选择攻击目标",
        targeting_cell: "选择目标格子", playing: "出牌中", ai: "敌方行动",
        discarding: `弃牌阶段（还需弃${u.hand.length - 5}张）`
    };
    document.getElementById("phaseName").textContent = phaseNames[phase] || phase;

    let moveTargets = phase === "moving" ? getMoveTargets(u) : [];
    let atkTargets = (phase === "targeting" && selectedCard) ? getCardTargets(u, selectedCard) : [];

    let map = document.getElementById("map");
    map.innerHTML = "";
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        let d = document.createElement("div");
        d.className = "cell " + (territory(r) === "enemy" ? "enemy-territory" : "friend-territory");

        let unit = units.find(x => x.row === r && x.col === c && x.hp > 0);
        if (unit) {
            d.classList.add(unit.team === "friend" ? "has-friend" : "has-enemy");
            let eff = "";
            if (unit.effects.some(e => e.type === "freeze")) eff += "❄️";
            if (unit.effects.some(e => e.type === "vine")) eff += "🌿";
            if (unit.torchBoosted) eff += "🔥";
            let eqList = unit.equips.map(e => e.id === "knight_sword" ? "⚔️" : e.id === "armor" ? "🔰" : "📦");
            let eqHtml = eqList.length > 0 ? `<div style="position:absolute;bottom:2px;right:2px;display:flex;flex-direction:column;align-items:center;font-size:11px;line-height:1.1">${eqList.map(ic => `<span>${ic}</span>`).join("")}</div>` : "";
            d.innerHTML = `<div style="font-weight:bold;font-size:11px">${unit.name}</div><div>HP:${unit.hp}</div>${unit.shield > 0 ? `<div>盾:${unit.shield}</div>` : ""}<div class="hp-bar"><div class="hp-fill" style="width:${Math.max(0, unit.hp / unit.maxHp * 100)}%;${unit.hp < unit.maxHp * 0.3 ? "background:#e74c3c" : ""}"></div></div>${eff ? `<div class="status-icons">${eff}</div>` : ""}${eqHtml}`;
        }

        if (blockedCells.some(b => b.row === r && b.col === c)) { d.style.background = "#555"; d.innerHTML += `<div style="font-size:16px">🚧</div>`; }

        let friendFire = fireCells.filter(f => f.row === r && f.col === c && f.fromTeam === "friend").reduce((s, f) => s + f.stacks, 0);
        let enemyFire = fireCells.filter(f => f.row === r && f.col === c && f.fromTeam === "enemy").reduce((s, f) => s + f.stacks, 0);
        if (friendFire > 0 || enemyFire > 0) {
            let totalGlow = Math.min(friendFire + enemyFire, 6);
            let glowSize = 8 + totalGlow * 3;
            if (friendFire > 0 && enemyFire > 0) {
                d.style.background = "rgb(200,110,0)";
                d.style.boxShadow = `inset 0 0 ${glowSize}px rgba(255,140,0,0.85)`;
            } else if (friendFire > 0) {
                let i = Math.min(friendFire, 3);
                d.style.background = `rgb(${180+i*15},${160+i*15},0)`;
                d.style.boxShadow = `inset 0 0 ${glowSize}px rgba(255,230,0,${0.5+i*0.15})`;
            } else {
                let i = Math.min(enemyFire, 3);
                d.style.background = `rgb(${100+i*15},20,20)`;
                d.style.boxShadow = `inset 0 0 ${glowSize}px rgba(255,69,0,${0.6+i*0.15})`;
            }
            if (friendFire > 0) {
                let fi = Math.min(friendFire, 3);
                d.innerHTML += `<div style="font-size:11px;position:absolute;bottom:1px;left:2px">${"🔥".repeat(fi)}</div>`;
            }
            if (enemyFire > 0) {
                let ei = Math.min(enemyFire, 3);
                d.innerHTML += `<div style="font-size:11px;position:absolute;top:1px;left:2px">${"🔥".repeat(ei)}</div>`;
            }
        }

        if (moveTargets.some(t => t.r === r && t.c === c)) d.classList.add("move-hint");
        if (atkTargets.some(t => t.row === r && t.col === c)) d.classList.add("target-hint");
        if (phase === "targeting_cell") d.classList.add("target-hint");

        let rr = r, cc = c;
        d.onclick = () => cellClick(rr, cc);
        map.appendChild(d);
    }

    let handEl = document.getElementById("hand");
    handEl.innerHTML = "";
    if (u.isPlayer && u.hp > 0) {
        u.hand.forEach(card => {
            let cd = document.createElement("div");
            cd.className = `card ${card.type}`;
            if (!card.basic) cd.classList.add("advanced");
            let frozen = u.effects.some(e => e.type === "freeze");
            let isBoostedSword = (card.id === "iron_sword" && u.torchBoosted);
            if (isBoostedSword) cd.classList.add("boosted");
            if (phase === "discarding") { cd.style.border = "2px solid #e74c3c"; cd.style.cursor = "pointer"; }
            else if (frozen || (phase !== "idle" && phase !== "playing")) cd.classList.add("disabled");
            if (selectedCard && selectedCard.uid === card.uid) cd.classList.add("selected");
            if (card.cat === "atk" && hasAttacked && phase !== "discarding") cd.classList.add("disabled");
            let catName = { atk:"攻击", dmg:"伤害", def:"防御", ctrl:"控制", buff:"增益", equip:"装备" };
            let displayName = card.name, displayDesc = card.desc;
            if (isBoostedSword) { displayName = "🔥 烈焰铁剑"; displayDesc = "对1个目标造成2000伤害"; }
            cd.innerHTML = `<span class="card-type">${catName[card.cat]}</span><div class="card-name">${displayName}</div><div class="card-desc">${displayDesc}</div>`;
            cd.onclick = () => {
                if (phase === "discarding") { discardCard(card); return; }
                if (!cd.classList.contains("disabled")) selectCard(card);
            };
            handEl.appendChild(cd);
        });
    }

    document.getElementById("btnMove").style.display = (u.isPlayer && phase === "idle" && !hasMoved) ? "" : "none";
    document.getElementById("btnPlay").style.display = "none";
    document.getElementById("btnEnd").style.display = (u.isPlayer && (phase === "idle" || phase === "playing") && u.hp > 0) ? "" : "none";
    document.getElementById("btnCancel").style.display = (phase === "moving" || phase === "targeting" || phase === "targeting_cell") ? "" : "none";
}

// ========== 卡牌目标 ==========
function getCardTargets(u, card) {
    let enemies = alive(u.team === "friend" ? "enemy" : "friend");
    let friends = alive(u.team);
    let range = getRange(u);
    switch (card.id) {
        case "iron_sword": return enemies.filter(e => Math.abs(e.row - u.row) + Math.abs(e.col - u.col) <= range);
        case "sword_rain": return enemies;
        case "freeze": case "vine": case "devour": case "steal": case "disarm":
            return enemies.filter(e => Math.abs(e.row - u.row) + Math.abs(e.col - u.col) <= range);
        case "heal_card": return friends.filter(f => f.hp < f.maxHp);
        case "shield_card": case "supply": return [u];
        default: return [];
    }
}

// ========== 火炬融合弹窗 ==========
function showTorchModal(card) {
    pendingTorchCard = card;
    let u = cur();
    let hasSword = u.hand.some(c => c.id === "iron_sword");
    let fuseBtn = document.getElementById("torchFuseBtn");
    if (hasSword && !u.torchBoosted) { fuseBtn.style.display = ""; fuseBtn.style.opacity = "1"; fuseBtn.disabled = false; }
    else { fuseBtn.style.display = ""; fuseBtn.style.opacity = "0.4"; fuseBtn.disabled = true; }
    document.getElementById("torchModal").classList.remove("hidden");
}

function torchChoice(choice) {
    document.getElementById("torchModal").classList.add("hidden");
    if (!pendingTorchCard) return;
    let card = pendingTorchCard, u = cur();
    pendingTorchCard = null;
    if (choice === "fuse") {
        removeCard(u, card); u.torchBoosted = true;
        addLog(`🔥 ${u.name}将火炬融入铁剑，攻击伤害+1000！`);
        selectedCard = null; phase = "idle"; draw();
    } else if (choice === "throw") { selectedCard = card; phase = "targeting_cell"; draw(); }
    else { selectedCard = null; phase = "idle"; draw(); }
}

// ========== 装备系统 ==========
function equipCard(card) {
    let u = cur();
    if (u.equips.length >= 3) { pendingEquipCard = card; showEquipReplaceModal(u, card); return; }
    removeCard(u, card); u.equips.push(card);
    addLog(`${u.name}装备了${card.name}`);
    selectedCard = null; phase = "idle"; draw();
}

function showEquipReplaceModal(u, newCard) {
    document.getElementById("equipReplaceNewName").textContent = newCard.name;
    let list = document.getElementById("equipReplaceList"); list.innerHTML = "";
    u.equips.forEach((eq, idx) => {
        let ic = eq.id === "knight_sword" ? "⚔️" : eq.id === "armor" ? "🔰" : "📦";
        let btn = document.createElement("button");
        btn.style.cssText = "background:#c0392b;margin:4px;min-width:160px";
        btn.textContent = `弃掉 ${ic} ${eq.name}`;
        btn.onclick = () => equipReplaceChoice(idx);
        list.appendChild(btn);
    });
    document.getElementById("equipReplaceModal").classList.remove("hidden");
}

function equipReplaceChoice(discardIdx) {
    document.getElementById("equipReplaceModal").classList.add("hidden");
    if (pendingEquipCard === null) return;
    let u = cur(), card = pendingEquipCard; pendingEquipCard = null;
    if (discardIdx === -1) { selectedCard = null; phase = "idle"; draw(); return; }
    let removed = u.equips.splice(discardIdx, 1)[0];
    addLog(`${u.name}弃掉了装备${removed.name}`);
    removeCard(u, card); u.equips.push(card);
    addLog(`${u.name}装备了${card.name}`);
    selectedCard = null; phase = "idle"; draw();
}

// ========== 出牌逻辑 ==========
function selectCard(card) {
    let u = cur();
    if (u.effects.some(e => e.type === "freeze")) { addLog("你被冰冻了，无法出牌！"); return; }
    if (card.cat === "atk" && hasAttacked) { addLog("每回合只能打出1张攻击牌"); return; }
    if ((card.cat === "atk" || card.cat === "dmg" || card.cat === "ctrl") && u.effects.some(e => e.type === "truce")) {
        addLog("休战令生效中，无法使用负面牌！"); selectedCard = null; draw(); return;
    }
    selectedCard = card;
    if (["shield_card", "supply"].includes(card.id)) { playCardOnSelf(card); return; }
    if (card.id === "knight_sword" || card.id === "armor") { equipCard(card); return; }
    if (card.cat === "def") { addLog("防御牌在被攻击时自动使用"); selectedCard = null; draw(); return; }
    if (card.id === "barricade") { phase = "targeting_cell"; draw(); return; }
    if (card.id === "torch") { showTorchModal(card); return; }
    if (card.id === "truce") { playTruce(card); return; }
    if (card.id === "sword_rain") { playAoE(card); return; }
    let targets = getCardTargets(u, card);
    if (targets.length === 0) { addLog("没有可攻击的目标"); selectedCard = null; draw(); return; }
    phase = "targeting"; draw();
}

function playCardOnSelf(card) {
    let u = cur(); removeCard(u, card);
    if (card.id === "shield_card") { u.shield += card.shieldVal; addLog(`${u.name}获得${card.shieldVal}护盾`); }
    if (card.id === "supply") { drawFromPile(u, card.draw); addLog(`${u.name}使用补给箱，抽了${card.draw}张牌`); }
    selectedCard = null; phase = "idle"; draw();
}

function playTruce(card) {
    let u = cur(); removeCard(u, card);
    units.forEach(x => x.effects.push({ type: "truce", turns: 1 }));
    addLog(`${u.name}使用休战令！全场无法使用负面牌，持续1回合`);
    selectedCard = null; phase = "idle"; draw();
}

function playAoE(card) {
    let u = cur(), enemies = alive(u.team === "friend" ? "enemy" : "friend");
    removeCard(u, card);
    if (card.cat === "atk") hasAttacked = true;
    enemies.forEach(e => resolveAttack(u, e, card.dmg, card.name));
    addLog(`${u.name}使用${card.name}，攻击所有敌人`);
    selectedCard = null; phase = "idle"; draw();
}

// ========== 投掷火炬 ==========
function throwTorchAt(u, card, r, c) {
    removeCard(u, card);
    let cross = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];
    let cells = cross.map(([dr,dc]) => ({row:r+dr,col:c+dc})).filter(p => p.row>=0&&p.row<ROWS&&p.col>=0&&p.col<COLS);
    cells.forEach(p => addFireToCell(p.row, p.col, u.team));
    cells.forEach(p => {
        let t = units.find(x => x.row===p.row&&x.col===p.col&&x.hp>0&&x.team!==u.team);
        if (t) resolveAttack(u, t, 500, "火炬");
    });
    addLog(`${u.name}在(${r},${c})释放火炬，十字范围燃烧中`);
}

// ========== 地图点击 ==========
function cellClick(r, c) {
    if (phase === "moving") {
        let u = cur(), targets = getMoveTargets(u);
        if (targets.some(t => t.r === r && t.c === c)) {
            u.row = r; u.col = c; hasMoved = true; phase = "idle";
            addLog(`${u.name}移动到(${r},${c})`); draw();
        }
    } else if (phase === "targeting" && selectedCard) {
        let target = units.find(x => x.row === r && x.col === c && x.hp > 0);
        if (!target) return;
        if (!getCardTargets(cur(), selectedCard).some(t => t.row === r && t.col === c)) return;
        playCardOnTarget(target);
    } else if (phase === "targeting_cell" && selectedCard) {
        let u = cur();
        if (selectedCard.id === "barricade") {
            if (units.some(x => x.row === r && x.col === c && x.hp > 0)) return;
            removeCard(u, selectedCard);
            blockedCells.push({ row: r, col: c, turns: 6 });
            addLog(`${u.name}封锁了(${r},${c})`);
        } else if (selectedCard.id === "torch") { throwTorchAt(u, selectedCard, r, c); }
        selectedCard = null; phase = "idle"; draw();
    }
}

function playCardOnTarget(target) {
    let u = cur(), card = selectedCard;
    removeCard(u, card);
    if (card.cat === "atk") hasAttacked = true;
    switch (card.id) {
        case "iron_sword":
            let dmg = card.dmg, cn = card.name;
            if (u.torchBoosted) { dmg += 1000; cn = "烈焰铁剑"; u.torchBoosted = false; }
            resolveAttack(u, target, dmg, cn); break;
        case "freeze": resolveControl(u, target, "freeze", "冰冻", "下回合无法出牌"); break;
        case "vine": resolveControl(u, target, "vine", "藤蔓蔓延", "下回合无法抽牌"); break;
        case "devour": resolveControl(u, target, "devour", "吞噬", "丢弃1张手牌"); break;
        case "steal": resolveControl(u, target, "steal", "妙手", "偷取1张手牌"); break;
        case "disarm": resolveControl(u, target, "disarm", "缴械", "拆除1件装备"); break;
        case "heal_card": target.hp = Math.min(target.maxHp, target.hp + card.heal); addLog(`${u.name}为${target.name}恢复了${card.heal}HP`); break;
    }
    selectedCard = null; phase = "idle"; draw();
}

// ========== 战斗结算 ==========
function resolveAttack(attacker, target, dmg, cardName) {
    if (!target.isPlayer) {
        let blockIdx = target.hand.findIndex(c => c.id === "block");
        if (blockIdx >= 0 && Math.random() < 0.6) {
            target.hand.splice(blockIdx, 1);
            addLog(`${target.name}使用格挡抵消了${cardName}！`); return;
        }
        applyDamage(target, dmg, attacker);
        addLog(`${attacker.name}用${cardName}对${target.name}造成${dmg}伤害`); return;
    }
    pendingAttack = { attacker, target, dmg, cardName };
    showDefendModal(target, dmg, cardName);
}

function applyDamage(target, dmg, attacker) {
    let armorReduce = getArmorReduction(target);
    if (armorReduce > 0) dmg = Math.max(0, dmg - armorReduce);
    if (round <= 3 && target.hp <= 1000) return;
    if (target.shield > 0) { let a = Math.min(target.shield, dmg); target.shield -= a; dmg -= a; }
    target.hp -= dmg;
    if (target.hp <= 0) { target.hp = 0; checkDying(target); }
}

// ========== 防御弹窗（带读条） ==========
function showDefendModal(target, dmg, cardName) {
    document.getElementById("defendText").textContent = `${cardName}即将对你造成${dmg}伤害！`;
    let dc = document.getElementById("defendCards"); dc.innerHTML = "";
    let blockCard = target.hand.find(c => c.id === "block");
    if (blockCard) {
        let btn = document.createElement("button");
        btn.style.background = "#27ae60";
        btn.textContent = `使用格挡 (剩${target.hand.filter(c => c.id === "block").length}张)`;
        btn.onclick = () => defendChoice(true, "block");
        dc.appendChild(btn);
    }
    document.getElementById("defendModal").classList.remove("hidden");
    startReactionTimer("defendTimerFill", () => defendChoice(false));
}

function defendChoice(useDefense, cardId) {
    stopReactionTimer();
    document.getElementById("defendModal").classList.add("hidden");
    if (!pendingAttack) return;
    let { attacker, target, dmg, cardName } = pendingAttack;
    if (useDefense && cardId) {
        let idx = target.hand.findIndex(c => c.id === cardId);
        if (idx >= 0) {
            target.hand.splice(idx, 1);
            addLog(`${target.name}使用格挡抵消了攻击！`);
            pendingAttack = null; draw();
            if (!cur().isPlayer) setTimeout(endTurn, 400); return;
        }
    }
    applyDamage(target, dmg, attacker);
    addLog(`${attacker.name}用${cardName}对${target.name}造成${dmg}伤害`);
    pendingAttack = null; draw();
    if (!cur().isPlayer) setTimeout(endTurn, 400);
}

// ========== 控制结算（带读条+动态图标） ==========
function resolveControl(attacker, target, type, name, desc) {
    if (target.isPlayer) {
        let immIdx = target.hand.findIndex(c => c.id === "immunity");
        if (immIdx >= 0) { pendingControl = { attacker, target, type, name, desc }; showControlModal(target, type, name, desc); return; }
    } else {
        let immIdx = target.hand.findIndex(c => c.id === "immunity");
        if (immIdx >= 0) { target.hand.splice(immIdx, 1); addLog(`${target.name}使用免疫抵消了${name}！`); return; }
    }
    applyControl(attacker, target, type, name, desc);
}

function applyControl(attacker, target, type, name, desc) {
    switch (type) {
        case "devour":
            if (target.hand.length > 0) { let ri = Math.floor(Math.random()*target.hand.length); let rm = target.hand.splice(ri,1)[0]; addLog(`${attacker.name}吞噬了${target.name}的${rm.name}`); }
            else addLog(`${target.name}没有手牌可吞噬`); return;
        case "steal":
            if (target.hand.length > 0) { let ri = Math.floor(Math.random()*target.hand.length); let st = target.hand.splice(ri,1)[0]; attacker.hand.push(st); addLog(`${attacker.name}偷取了${target.name}的${st.name}`); }
            else addLog(`${target.name}没有手牌可偷`); return;
        case "disarm":
            if (target.equips.length > 0) { let rm = target.equips.pop(); addLog(`${attacker.name}拆除了${target.name}的${rm.name}`); }
            else addLog(`${target.name}没有装备可拆`); return;
        default: target.effects.push({ type, turns: 1 }); addLog(`${attacker.name}对${target.name}施加了${name}(${desc})`);
    }
}

function showControlModal(target, type, name, desc) {
    let ci = CONTROL_ICONS[type] || { icon:"🧊", title:"受到控制！" };
    document.getElementById("controlTitle").textContent = `${ci.icon} ${ci.title}`;
    document.getElementById("controlText").textContent = `${name}即将对你生效：${desc}！`;
    let dc = document.getElementById("controlCards"); dc.innerHTML = "";
    let immCount = target.hand.filter(c => c.id === "immunity").length;
    let btn = document.createElement("button");
    btn.style.background = "#2980b9";
    btn.textContent = `使用免疫抵消 (剩${immCount}张)`;
    btn.onclick = () => controlChoice(true);
    dc.appendChild(btn);
    document.getElementById("controlModal").classList.remove("hidden");
    startReactionTimer("controlTimerFill", () => controlChoice(false));
}

function controlChoice(useImmunity) {
    stopReactionTimer();
    document.getElementById("controlModal").classList.add("hidden");
    if (!pendingControl) return;
    let { attacker, target, type, name, desc } = pendingControl;
    if (useImmunity) {
        let idx = target.hand.findIndex(c => c.id === "immunity");
        if (idx >= 0) { target.hand.splice(idx, 1); addLog(`${target.name}使用免疫抵消了${name}！`); }
    } else { applyControl(attacker, target, type, name, desc); }
    pendingControl = null; draw();
    if (!cur().isPlayer) setTimeout(endTurn, 400);
}

// ========== 濒死求援 ==========
function checkDying(target) {
    let allies = units.filter(x => x.team === target.team && x.hp > 0);
    let healers = allies.filter(x => x.hand.some(c => c.id === "heal_card"));
    if (target.hand.some(c => c.id === "heal_card") && !healers.includes(target)) healers.push(target);
    if (healers.length === 0) { addLog(`💀 ${target.name}无人救援，已阵亡！`); return; }
    if (target.team === "friend") { pendingDying = { target, healers }; showDyingModal(target, healers); }
    else {
        let healer = healers[0], hc = healer.hand.find(c => c.id === "heal_card");
        removeCard(healer, hc); target.hp = 1000;
        addLog(`🍑 ${healer.name}对${target.name}使用恢复，救回至1000HP！`); draw();
    }
}

function showDyingModal(target, healers) {
    document.getElementById("dyingText").textContent = `${target.name}濒死！(HP:0) 是否使用恢复卡救援？`;
    let dc = document.getElementById("dyingCards"); dc.innerHTML = "";
    healers.forEach(healer => {
        let btn = document.createElement("button");
        btn.style.background = "#27ae60"; btn.style.margin = "4px";
        let isSelf = healer === target;
        btn.textContent = isSelf
            ? `自己使用恢复自救 (🃏${healer.hand.filter(c=>c.id==="heal_card").length}张)`
            : `${healer.name}使用恢复救援 (🃏${healer.hand.filter(c=>c.id==="heal_card").length}张)`;
        btn.onclick = () => dyingChoice(true, healer);
        dc.appendChild(btn);
    });
    document.getElementById("dyingModal").classList.remove("hidden");
    startReactionTimer("dyingTimerFill", () => dyingChoice(false));
}

function dyingChoice(save, healer) {
    stopReactionTimer();
    document.getElementById("dyingModal").classList.add("hidden");
    if (!pendingDying) return;
    let { target } = pendingDying;
    if (save && healer) {
        let hc = healer.hand.find(c => c.id === "heal_card");
        if (hc) { removeCard(healer, hc); target.hp = 1000; addLog(`🍑 ${healer.name}对${target.name}使用恢复，救回至1000HP！`); }
    } else { addLog(`💀 ${target.name}无人救援，已阵亡！`); }
    let wasFireDmg = pendingDying.fromFireDmg;
    pendingDying = null; draw();
    if (wasFireDmg) { continueStartTurn(cur()); return; }
    if (!cur().isPlayer && cur().hp > 0) setTimeout(endTurn, 400);
}

// ========== 火焰伤害（带读条） ==========
function showFireModal(target, fireDmg, stacks) {
    document.getElementById("fireText").textContent = `${target.name}站在${stacks>1?stacks+"层":""}火焰上，即将受到${fireDmg}伤害！`;
    let dc = document.getElementById("fireCards"); dc.innerHTML = "";
    let blockCard = target.hand.find(c => c.id === "block");
    if (blockCard) {
        let btn = document.createElement("button");
        btn.style.background = "#27ae60";
        btn.textContent = `使用格挡 (剩${target.hand.filter(c=>c.id==="block").length}张)`;
        btn.onclick = () => fireChoice(true);
        dc.appendChild(btn);
    }
    document.getElementById("fireModal").classList.remove("hidden");
    startReactionTimer("fireTimerFill", () => fireChoice(false));
}

function fireChoice(useBlock) {
    stopReactionTimer();
    document.getElementById("fireModal").classList.add("hidden");
    if (!pendingFireDmg) return;
    let { target, dmg } = pendingFireDmg;
    if (useBlock) {
        let idx = target.hand.findIndex(c => c.id === "block");
        if (idx >= 0) { target.hand.splice(idx, 1); addLog(`🔥 ${target.name}使用格挡抵消了火焰伤害！`); }
    } else {
        applyDamage(target, dmg, null);
        if (pendingDying) pendingDying.fromFireDmg = true;
        addLog(`🔥 ${target.name}站在火焰中，受到${dmg}伤害`);
    }
    pendingFireDmg = null; draw();
    if (!pendingDying) continueStartTurn(cur());
}

// ========== 回合效果处理 ==========
function processStartEffects(u) {
    u.noDrawNextTurn = u.effects.some(e => e.type === "vine");
    let hostileStacks = getFireHostileStacks(u.row, u.col, u.team);
    if (hostileStacks > 0 && u.hp > 0) {
        let fireDmg = 500 * Math.min(hostileStacks, 3);
        if (u.isPlayer) { pendingFireDmg = { target: u, dmg: fireDmg }; }
        else {
            let blockIdx = u.hand.findIndex(c => c.id === "block");
            if (blockIdx >= 0 && Math.random() < 0.6) {
                u.hand.splice(blockIdx, 1);
                addLog(`🔥 ${u.name}站在${hostileStacks>1?hostileStacks+"层":""}火焰中，使用格挡抵消！`);
            } else {
                applyDamage(u, fireDmg, null);
                addLog(`🔥 ${u.name}站在${hostileStacks>1?hostileStacks+"层":""}火焰中，受到${fireDmg}伤害`);
            }
        }
    }
    u.effects = u.effects.filter(e => { if (e.type === "truce") { e.turns--; return e.turns > 0; } return true; });
    blockedCells = blockedCells.filter(b => { b.turns--; return b.turns > 0; });
    fireCells = fireCells.filter(f => { f.turns--; return f.turns > 0; });
}

// ========== 回合流程 ==========
function startTurn() {
    let u = cur();
    while (u.hp <= 0) { nextTurnIdx(); u = cur(); }
    hasMoved = false; hasAttacked = false; selectedCard = null; phase = "idle";
    processStartEffects(u);
    if (pendingFireDmg) {
        let stacks = getFireHostileStacks(pendingFireDmg.target.row, pendingFireDmg.target.col, pendingFireDmg.target.team);
        showFireModal(pendingFireDmg.target, pendingFireDmg.dmg, Math.max(stacks, 1)); return;
    }
    continueStartTurn(u);
}

function continueStartTurn(u) {
    if (round > 0) {
        let isDrought = (round >= 16 && round <= 17) || (round >= 21 && round <= 23);
        if (!isDrought && !u.noDrawNextTurn) drawFromPile(u, 2);
        if (u.noDrawNextTurn) { addLog(`🌿 ${u.name}被藤蔓缠绕，无法抽牌！`); u.noDrawNextTurn = false; }
    }
    if (u.isPlayer) { addLog(`--- 你的回合 (第${round}回合) ---`); draw(); }
    else { draw(); setTimeout(() => aiTurn(u), 600); }
}

function nextTurnIdx() {
    turnIdx++;
    if (turnIdx >= units.length) { turnIdx = 0; round++; addLog(`=== 第${round}回合 ===`); }
}

function endTurn() {
    let u = cur();
    u.effects = u.effects.filter(e => { if (e.type==="freeze"||e.type==="vine") { e.turns--; return e.turns>0; } return true; });
    if (u.isPlayer && u.hand.length > 5) { phase = "discarding"; addLog(`手牌超过5张，请弃掉${u.hand.length-5}张牌`); draw(); return; }
    while (u.hand.length > 5) u.hand.pop();
    nextTurnIdx(); startTurn();
}

function discardCard(card) {
    let u = cur();
    if (phase !== "discarding") return;
    removeCard(u, card); addLog(`弃掉了${card.name}`);
    if (u.hand.length <= 5) { phase = "idle"; addLog("弃牌完成"); nextTurnIdx(); startTurn(); } else draw();
}

// ========== AI ==========
function aiTurn(u) {
    if (u.hp <= 0) { endTurn(); return; }
    phase = "ai";
    let enemies = alive(u.team === "friend" ? "enemy" : "friend");
    if (enemies.length === 0) { endTurn(); return; }
    let frozen = u.effects.some(e => e.type === "freeze");

    let nearest = enemies.reduce((a,b) => (Math.abs(a.row-u.row)+Math.abs(a.col-u.col)) < (Math.abs(b.row-u.row)+Math.abs(b.col-u.col)) ? a : b);
    let moves = getMoveTargets(u);
    if (moves.length > 0) {
        let best = moves.reduce((a,b) => (Math.abs(a.r-nearest.row)+Math.abs(a.c-nearest.col)) < (Math.abs(b.r-nearest.row)+Math.abs(b.c-nearest.col)) ? a : b);
        u.row = best.r; u.col = best.c;
    }
    draw();

    if (frozen) { addLog(`${u.name}被冰冻，无法出牌，但仍可移动`); setTimeout(endTurn, 600); return; }

    let hasTruce = u.effects.some(e => e.type === "truce");
    let range = getRange(u);

    setTimeout(() => {
        if (!hasTruce) {
            let torchCard = u.hand.find(c => c.id === "torch");
            let hasSword = u.hand.some(c => c.id === "iron_sword");
            if (torchCard && hasSword && !u.torchBoosted && Math.random() < 0.5) {
                removeCard(u, torchCard); u.torchBoosted = true;
                addLog(`🔥 ${u.name}将火炬融入铁剑，攻击伤害+1000！`); draw();
            }
            let atkCard = u.hand.find(c => c.id === "iron_sword");
            if (atkCard) {
                let target = enemies.find(e => Math.abs(e.row-u.row)+Math.abs(e.col-u.col) <= range);
                if (target) {
                    removeCard(u, atkCard);
                    let ad = atkCard.dmg, an = atkCard.name;
                    if (u.torchBoosted) { ad += 1000; an = "烈焰铁剑"; u.torchBoosted = false; }
                    resolveAttack(u, target, ad, an); draw();
                }
            }
            let dmgCard = u.hand.find(c => c.cat === "dmg");
            if (dmgCard) {
                if (dmgCard.id === "sword_rain") { removeCard(u, dmgCard); enemies.forEach(e => resolveAttack(u, e, dmgCard.dmg, dmgCard.name)); }
                else if (dmgCard.id === "torch" && enemies.length > 0) { let t = enemies[0]; throwTorchAt(u, dmgCard, t.row, t.col); }
                draw();
            }
            let ctrlCard = u.hand.find(c => c.cat === "ctrl" && c.id !== "barricade" && c.id !== "truce");
            if (ctrlCard && enemies.length > 0) {
                let inRange = enemies.filter(e => Math.abs(e.row-u.row)+Math.abs(e.col-u.col) <= range);
                if (inRange.length > 0) {
                    let t = inRange[Math.floor(Math.random()*inRange.length)];
                    removeCard(u, ctrlCard); resolveControl(u, t, ctrlCard.id, ctrlCard.name, ""); draw();
                }
            }
        }
        // 补给箱：手牌少于2张时使用
        let supplyCard = u.hand.find(c => c.id === "supply");
        if (supplyCard && u.hand.length <= 2) {
            removeCard(u, supplyCard);
            drawFromPile(u, supplyCard.draw);
            addLog(`${u.name}使用补给箱，抽了${supplyCard.draw}张牌`);
            draw();
        }
        // 休战令：己方血量普遍较低且敌方手牌多时使用
        if (!hasTruce) {
            let truceCard = u.hand.find(c => c.id === "truce");
            if (truceCard) {
                let myTeamHp = alive(u.team).reduce((s, x) => s + x.hp / x.maxHp, 0) / Math.max(alive(u.team).length, 1);
                if (myTeamHp < 0.4) {
                    removeCard(u, truceCard);
                    units.forEach(x => x.effects.push({ type: "truce", turns: 1 }));
                    addLog(`${u.name}使用休战令！全场无法使用负面牌，持续1回合`);
                    draw();
                }
            }
        }

        if (u.hp < u.maxHp * 0.7) {
            let hc = u.hand.find(c => c.id === "heal_card");
            if (hc) { removeCard(u, hc); u.hp = Math.min(u.maxHp, u.hp + hc.heal); addLog(`${u.name}恢复了${hc.heal}HP`); }
        }
        let sc = u.hand.find(c => c.id === "shield_card");
        if (sc && u.shield < 1000) { removeCard(u, sc); u.shield += sc.shieldVal; addLog(`${u.name}获得${sc.shieldVal}护盾`); }
        let ec = u.hand.find(c => c.cat === "equip");
        if (ec && u.equips.length < 3) { removeCard(u, ec); u.equips.push(ec); addLog(`${u.name}装备了${ec.name}`); }
        draw();
        if (!document.getElementById("defendModal").classList.contains("hidden")) return;
        if (!document.getElementById("controlModal").classList.contains("hidden")) return;
        setTimeout(endTurn, 400);
    }, 500);
}

// ========== 队友手牌弹窗 ==========
function showTeammateModal(unit) {
    document.getElementById("teammateTitle").textContent = `${unit.name} 的信息`;
    let eqHtml = "";
    for (let s = 0; s < 3; s++) {
        if (unit.equips[s]) {
            let ic = unit.equips[s].id === "knight_sword" ? "⚔️" : unit.equips[s].id === "armor" ? "🔰" : "📦";
            eqHtml += `<div style="display:inline-block;padding:4px 10px;margin:2px;background:#2a2a4a;border-radius:5px;font-size:12px">${ic} ${unit.equips[s].name}</div>`;
        } else eqHtml += `<div style="display:inline-block;padding:4px 10px;margin:2px;background:#1a1a2a;border:1px dashed #444;border-radius:5px;font-size:12px;color:#555">空槽</div>`;
    }
    document.getElementById("teammateEquips").innerHTML = eqHtml;
    let catName = { atk:"攻击", dmg:"伤害", def:"防御", ctrl:"控制", buff:"增益", equip:"装备" };
    let handHtml = "";
    unit.hand.forEach(card => {
        handHtml += `<div class="card ${card.type}${card.basic ? "" : " advanced"}" style="cursor:default;transform:none"><span class="card-type">${catName[card.cat]}</span><div class="card-name">${card.name}</div><div class="card-desc">${card.desc}</div></div>`;
    });
    if (unit.hand.length === 0) handHtml = `<p style="color:#888">没有手牌</p>`;
    document.getElementById("teammateHand").innerHTML = handHtml;
    document.getElementById("teammateModal").classList.remove("hidden");
}
function closeTeammateModal() { document.getElementById("teammateModal").classList.add("hidden"); }

// ========== 按钮绑定 ==========
document.getElementById("btnMove").onclick = () => { phase = "moving"; draw(); };
document.getElementById("btnEnd").onclick = endTurn;
document.getElementById("btnCancel").onclick = () => { phase = "idle"; selectedCard = null; draw(); };

// ========== 启动 ==========
restart();
