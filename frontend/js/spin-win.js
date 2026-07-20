/**
 * CloudCrackers — Spin & Win
 * Vanilla JS: wheel rendering, spin logic, confetti, fireworks, localStorage
 */

/* ==========================================================================
   CONFIG
   ========================================================================== */

const SEGMENTS = [
    { label: '₹50 OFF',           emoji: '🎁', color: '#1a3a6b', textColor: '#FFD700',  probability: 0.20, type: 'discount',  value: 50,   couponPrefix: 'CC50'  },
    { label: '₹100 OFF',          emoji: '💰', color: '#FF7A00', textColor: '#fff',      probability: 0.15, type: 'discount',  value: 100,  couponPrefix: 'CC100' },
    { label: 'Free Shipping',     emoji: '🚚', color: '#0f2f5c', textColor: '#4DD0E1',  probability: 0.15, type: 'shipping',  value: 0,    couponPrefix: 'CCSHIP'},
    { label: '5% OFF',            emoji: '⚡', color: '#2d1a6e', textColor: '#FFD700',  probability: 0.18, type: 'percent',   value: 5,    couponPrefix: 'CC5PCT'},
    { label: '₹200 OFF',          emoji: '🏆', color: '#b35900', textColor: '#fff',      probability: 0.07, type: 'discount',  value: 200,  couponPrefix: 'CC200' },
    { label: '10% OFF',           emoji: '🎆', color: '#103a5e', textColor: '#FFD700',  probability: 0.10, type: 'percent',   value: 10,   couponPrefix: 'CC10PC'},
    { label: 'Better Luck',       emoji: '🍀', color: '#1a1a3a', textColor: '#9AA3C0',  probability: 0.10, type: 'none',      value: 0,    couponPrefix: null    },
    { label: 'Surprise Gift 🎉', emoji: '🎊', color: '#6b1a6b', textColor: '#FFD700',  probability: 0.05, type: 'gift',      value: 0,    couponPrefix: 'CCGIFT'},
];

const SPIN_DURATION_MS = 5000;   // 5-second spin
const SPIN_EXTRA_LAPS  = 7;      // full rotations before landing
const STORAGE_KEY      = 'cc_spin_result';
const CANVAS_SIZE      = 380;    // px (desktop)

/* ==========================================================================
   STATE
   ========================================================================== */

let currentAngle  = 0;   // wheel rotation in radians
let isSpinning    = false;

/* ==========================================================================
   DOM REFS
   ========================================================================== */

const canvas     = document.getElementById('spinWheel');
const ctx        = canvas.getContext('2d');
const spinBtn    = document.getElementById('spinBtn');
const statusMsg  = document.getElementById('spinStatusMsg');
const popupOverlay = document.getElementById('popupOverlay');
const popupEmojiEl  = document.getElementById('popupEmoji');
const popupEyebrow  = document.getElementById('popupEyebrow');
const popupTitle    = document.getElementById('popupTitle');
const popupReward   = document.getElementById('popupReward');
const popupDesc     = document.getElementById('popupDesc');
const couponCodeEl  = document.getElementById('couponCode');
const couponBox     = document.getElementById('couponBox');
const copyBtn       = document.getElementById('copyBtn');
const confettiCanvas   = document.getElementById('confettiCanvas');
const fireworksCanvas  = document.getElementById('fireworksCanvas');
const prevRewardsList  = document.getElementById('prevRewardsList');
const prevSection      = document.getElementById('prevRewardsSection');
const alreadySpunNotice = document.getElementById('alreadySpunNotice');

/* ==========================================================================
   STARS / AMBIENT BACKGROUND
   ========================================================================== */

function initStars () {
    const layer = document.getElementById('starsLayer');
    for (let i = 0; i < 120; i++) {
        const s = document.createElement('div');
        s.className = 'star-dot';
        const size = Math.random() * 2.5 + 0.5;
        s.style.cssText = `
            width:${size}px; height:${size}px;
            top:${Math.random() * 100}%; left:${Math.random() * 100}%;
            --dur:${(Math.random() * 3 + 2).toFixed(1)}s;
            --delay:-${(Math.random() * 5).toFixed(1)}s;
            --bright:${(Math.random() * 0.6 + 0.3).toFixed(2)};
        `;
        layer.appendChild(s);
    }
}

function initFloatingCrackers () {
    const emojis = ['🎆', '🎇', '✨', '🌟', '💥', '🎉'];
    for (let i = 0; i < 10; i++) {
        const el = document.createElement('div');
        el.className = 'floating-cracker';
        el.textContent = emojis[i % emojis.length];
        el.style.cssText = `
            left:${Math.random() * 100}%;
            --sz:${(Math.random() * 1 + 1).toFixed(1)}rem;
            --dur:${(Math.random() * 10 + 10).toFixed(1)}s;
            --delay:-${(Math.random() * 12).toFixed(1)}s;
            --drift:${(Math.random() * 80 - 40).toFixed(0)}px;
        `;
        document.body.appendChild(el);
    }
}

/* ==========================================================================
   WHEEL RENDERING
   ========================================================================== */

function drawWheel (rotation) {
    const size    = canvas.width;
    const cx      = size / 2;
    const cy      = size / 2;
    const radius  = size / 2 - 4;
    const total   = SEGMENTS.length;
    const arc     = (2 * Math.PI) / total;

    ctx.clearRect(0, 0, size, size);

    SEGMENTS.forEach((seg, i) => {
        const startAngle = rotation + i * arc;
        const endAngle   = startAngle + arc;

        /* Segment fill */
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();

        /* Segment border */
        ctx.strokeStyle = 'rgba(255,215,0,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        /* Subtle inner gradient sheen */
        const midAngle = startAngle + arc / 2;
        const gx = cx + Math.cos(midAngle) * (radius * 0.5);
        const gy = cy + Math.sin(midAngle) * (radius * 0.5);
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius * 0.5);
        grad.addColorStop(0, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        /* Text */
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(midAngle);

        /* Emoji */
        const emojiSize = Math.max(14, size * 0.052);
        ctx.font = `${emojiSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(seg.emoji, radius * 0.65, 0);

        /* Label */
        const labelSize = Math.max(9, size * 0.034);
        ctx.font = `700 ${labelSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = seg.textColor;
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur  = 4;
        ctx.fillText(seg.label, radius * 0.35, 0);
        ctx.shadowBlur  = 0;

        ctx.restore();
    });

    /* Outer ring decoration */
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,215,0,0.55)';
    ctx.lineWidth = 5;
    ctx.stroke();

    /* Inner circle (hub) shadow placeholder */
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, 2 * Math.PI);
    ctx.fillStyle = '#0B1F3A';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
}

/* ==========================================================================
   RESPONSIVE CANVAS SIZE
   ========================================================================== */

function setCanvasSize () {
    const maxSize = Math.min(window.innerWidth - 48, CANVAS_SIZE);
    const size = maxSize < 300 ? 300 : maxSize;
    canvas.width  = size;
    canvas.height = size;
    drawWheel(currentAngle);
}

/* ==========================================================================
   WEIGHTED RANDOM SEGMENT SELECTION
   ========================================================================== */

function pickSegment () {
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < SEGMENTS.length; i++) {
        cumulative += SEGMENTS[i].probability;
        if (rand <= cumulative) return i;
    }
    return SEGMENTS.length - 1;
}

/* ==========================================================================
   COUPON GENERATION
   ========================================================================== */

function generateCoupon (prefix) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix + '-';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/* ==========================================================================
   EASING
   ========================================================================== */

function easeOut (t) {
    return 1 - Math.pow(1 - t, 4);
}

/* ==========================================================================
   SPIN ANIMATION
   ========================================================================== */

function spin () {
    if (isSpinning) return;

    const stored = getStoredResult();
    if (stored) return;

    isSpinning = true;
    spinBtn.disabled = true;
    canvas.classList.add('spinning');
    statusMsg.textContent = '🎡 Spinning…';
    statusMsg.className = 'spin-status-msg';

    const segIdx    = pickSegment();
    const arc       = (2 * Math.PI) / SEGMENTS.length;

    /* Target angle: pointer is at top (angle = -π/2).
       We want segIdx segment's midpoint to be at the top. */
    const targetMid = segIdx * arc + arc / 2;
    const totalSpin = SPIN_EXTRA_LAPS * 2 * Math.PI + (2 * Math.PI - targetMid - currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    const startAngle = currentAngle;
    const finalAngle = startAngle + totalSpin;
    let startTime    = null;

    function step (timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed  = timestamp - startTime;
        const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);
        const eased    = easeOut(progress);

        currentAngle = startAngle + eased * totalSpin;
        drawWheel(currentAngle);

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            currentAngle = finalAngle;
            isSpinning = false;
            canvas.classList.remove('spinning');
            onSpinComplete(segIdx);
        }
    }

    requestAnimationFrame(step);
}

/* ==========================================================================
   ON SPIN COMPLETE
   ========================================================================== */

function onSpinComplete (segIdx) {
    const seg    = SEGMENTS[segIdx];
    const coupon = seg.couponPrefix ? generateCoupon(seg.couponPrefix) : null;
    const result = { seg: segIdx, coupon, ts: Date.now() };

    saveResult(result);
    showPopup(seg, coupon);
    updateAfterSpunUI(seg, coupon);

    /* Animations based on reward */
    if (seg.type === 'none') {
        // No confetti for "Better Luck"
    } else if (seg.type === 'discount' && seg.value >= 200 || seg.type === 'gift') {
        launchConfetti();
        launchFireworks();
    } else {
        launchConfetti();
    }

    /* Store previous reward for display */
    addToPrevRewards(seg, coupon);
}

/* ==========================================================================
   POPUP
   ========================================================================== */

function showPopup (seg, coupon) {
    popupEmojiEl.textContent  = seg.emoji;
    popupEyebrow.textContent  = seg.type === 'none' ? 'Better luck next time!' : '🎉 Congratulations!';
    popupTitle.textContent    = seg.type === 'none' ? 'Oops, Not This Time' : 'You Won!';
    popupReward.textContent   = seg.label;

    if (seg.type === 'none') {
        popupDesc.textContent = "Don't worry — every spin is an adventure. Come back tomorrow for another chance!";
        couponBox.style.display = 'none';
        document.querySelector('.popup-card').classList.add('no-win');
    } else {
        document.querySelector('.popup-card').classList.remove('no-win');
        const descs = {
            discount: `Use coupon code below to get ₹${seg.value} off on your next order. Valid for 7 days.`,
            percent:  `Use coupon code below to get ${seg.value}% off on your next order. Valid for 7 days.`,
            shipping: `Enjoy free shipping on your next order! Use the coupon code below at checkout.`,
            gift:     `🎊 You've unlocked a surprise gift! Use the coupon code below. Our team will reach out with details.`,
        };
        popupDesc.textContent = descs[seg.type] || 'Apply this coupon at checkout.';
        couponCodeEl.textContent = coupon;
        couponBox.style.display  = 'flex';
    }

    popupOverlay.classList.add('active');
}

function closePopup () {
    popupOverlay.classList.remove('active');
}

/* ==========================================================================
   COPY COUPON
   ========================================================================== */

copyBtn.addEventListener('click', () => {
    const code = couponCodeEl.textContent;
    navigator.clipboard.writeText(code).then(() => {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        }, 2000);
    });
});

/* ==========================================================================
   LOCAL STORAGE
   ========================================================================== */

function saveResult (result) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

function getStoredResult () {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/* ==========================================================================
   UPDATE UI AFTER SPIN
   ========================================================================== */

function updateAfterSpunUI (seg, coupon) {
    spinBtn.disabled = true;
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#FFD700"></i> You have already used today's spin.`;
    statusMsg.className = 'spin-status-msg used';

    if (alreadySpunNotice) {
        alreadySpunNotice.style.display = 'flex';
        const noticeReward = alreadySpunNotice.querySelector('.asn-reward');
        if (noticeReward) noticeReward.textContent = seg.label;
        const noticeCoupon = alreadySpunNotice.querySelector('.asn-coupon');
        if (noticeCoupon && coupon) noticeCoupon.textContent = coupon;
    }
}

function initAlreadySpunState () {
    const stored = getStoredResult();
    if (!stored) return;

    spinBtn.disabled = true;
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#FFD700"></i> You have already used today's spin.`;
    statusMsg.className = 'spin-status-msg used';

    const seg = SEGMENTS[stored.seg];
    if (alreadySpunNotice) {
        alreadySpunNotice.style.display = 'flex';
        const noticeReward = alreadySpunNotice.querySelector('.asn-reward');
        if (noticeReward && seg) noticeReward.textContent = seg.label;
        const noticeCoupon = alreadySpunNotice.querySelector('.asn-coupon');
        if (noticeCoupon && stored.coupon) noticeCoupon.textContent = stored.coupon;
    }

    /* Show previous rewards */
    if (stored.coupon && seg) addToPrevRewards(seg, stored.coupon, stored.ts);
}

/* ==========================================================================
   PREVIOUS REWARDS
   ========================================================================== */

function addToPrevRewards (seg, coupon, ts) {
    if (!prevRewardsList) return;
    if (!coupon) return; // don't show "Better Luck" in history

    if (prevSection) prevSection.style.display = 'block';

    const date = ts ? new Date(ts) : new Date();
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const item = document.createElement('div');
    item.className = 'recent-reward-item';
    item.innerHTML = `
        <div class="recent-reward-meta">
            <div class="recent-reward-icon">${seg.emoji}</div>
            <div class="recent-reward-text">
                <strong>${seg.label}</strong>
                <span>Spun on ${dateStr}</span>
            </div>
        </div>
        <div class="recent-reward-code">${coupon}</div>
    `;

    prevRewardsList.prepend(item);
}

/* ==========================================================================
   CONFETTI ANIMATION
   ========================================================================== */

function launchConfetti () {
    confettiCanvas.style.display = 'block';
    const cCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const colors = ['#FFD700','#FF7A00','#FF4D6D','#4DD0E1','#fff','#FFB800','#FF0080','#00FFD1'];
    const particles = [];
    const count = 180;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * -confettiCanvas.height,
            w: Math.random() * 12 + 4,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 4 + 2,
            angle: Math.random() * 360,
            spin: (Math.random() - 0.5) * 8,
            opacity: 1,
        });
    }

    let elapsed = 0;
    const duration = 4500;
    let prev = null;

    function animateConfetti (ts) {
        if (!prev) prev = ts;
        const dt = ts - prev;
        prev = ts;
        elapsed += dt;

        cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.spin;
            p.vy += 0.08; // gravity
            if (elapsed > duration * 0.6) p.opacity -= 0.012;

            cCtx.save();
            cCtx.globalAlpha = Math.max(0, p.opacity);
            cCtx.translate(p.x, p.y);
            cCtx.rotate((p.angle * Math.PI) / 180);
            cCtx.fillStyle = p.color;
            cCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            cCtx.restore();
        });

        if (elapsed < duration) {
            requestAnimationFrame(animateConfetti);
        } else {
            confettiCanvas.style.display = 'none';
            cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    requestAnimationFrame(animateConfetti);
}

/* ==========================================================================
   FIREWORKS ANIMATION
   ========================================================================== */

function launchFireworks () {
    fireworksCanvas.style.display = 'block';
    const fCtx = fireworksCanvas.getContext('2d');
    fireworksCanvas.width  = window.innerWidth;
    fireworksCanvas.height = window.innerHeight;

    const rockets = [];
    const explosions = [];
    const colors = ['#FFD700','#FF7A00','#FF4D6D','#4DD0E1','#FF00FF','#00FFAA','#FFB800'];

    function createExplosion (x, y) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const parts  = 60 + Math.floor(Math.random() * 30);
        for (let i = 0; i < parts; i++) {
            const angle = (i / parts) * 2 * Math.PI;
            const speed = Math.random() * 5 + 2;
            explosions.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                opacity: 1,
                size: Math.random() * 3 + 1.5,
                trail: [],
            });
        }
    }

    let count = 0;
    let last  = 0;
    const totalDuration = 4000;
    let startFw = null;

    function animateFw (ts) {
        if (!startFw) startFw = ts;
        const elapsed = ts - startFw;

        /* Fade out the background slightly so fireworks pop */
        fCtx.fillStyle = 'rgba(0,0,0,0.15)';
        fCtx.fillRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);

        /* Launch new rockets */
        if (elapsed - last > 400 && count < 8 && elapsed < totalDuration * 0.75) {
            last = elapsed;
            count++;
            rockets.push({
                x: Math.random() * fireworksCanvas.width * 0.7 + fireworksCanvas.width * 0.15,
                y: fireworksCanvas.height,
                vy: -(Math.random() * 10 + 14),
                vx: (Math.random() - 0.5) * 3,
                exploded: false,
                targetY: Math.random() * (fireworksCanvas.height * 0.45) + fireworksCanvas.height * 0.05,
            });
        }

        /* Update rockets */
        rockets.forEach(r => {
            if (r.exploded) return;
            r.x += r.vx;
            r.y += r.vy;
            r.vy += 0.3; // gravity

            /* Draw rocket trail */
            fCtx.beginPath();
            fCtx.arc(r.x, r.y, 2.5, 0, 2 * Math.PI);
            fCtx.fillStyle = '#FFD700';
            fCtx.fill();

            if (r.y <= r.targetY) {
                r.exploded = true;
                createExplosion(r.x, r.y);
            }
        });

        /* Update & draw explosion particles */
        for (let i = explosions.length - 1; i >= 0; i--) {
            const p = explosions[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08;
            p.vx *= 0.97;
            p.opacity -= 0.018;

            if (p.opacity <= 0) { explosions.splice(i, 1); continue; }

            fCtx.beginPath();
            fCtx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            fCtx.fillStyle = p.color;
            fCtx.globalAlpha = p.opacity;
            fCtx.fill();
            fCtx.globalAlpha = 1;
        }

        if (elapsed < totalDuration || explosions.length > 0) {
            requestAnimationFrame(animateFw);
        } else {
            fireworksCanvas.style.display = 'none';
            fCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
        }
    }

    requestAnimationFrame(animateFw);
}

/* ==========================================================================
   EVENT LISTENERS
   ========================================================================== */

spinBtn.addEventListener('click', spin);

document.getElementById('popupCloseBtn').addEventListener('click', closePopup);
popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) closePopup();
});

document.getElementById('continueShopping').addEventListener('click', () => {
    window.location.href = '../pages/products.html';
});

document.getElementById('viewCouponAgain').addEventListener('click', () => {
    const stored = getStoredResult();
    if (!stored) return;
    const seg = SEGMENTS[stored.seg];
    showPopup(seg, stored.coupon);
});

/* ==========================================================================
   RESPONSIVE RESIZE
   ========================================================================== */

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setCanvasSize, 150);
});

/* ==========================================================================
   INIT
   ========================================================================== */

(function init () {
    initStars();
    initFloatingCrackers();
    setCanvasSize();
    initAlreadySpunState();
})();
