let currentUserEmail = null;
let clubsData = [];
let selectedClubId = null;
let hasVoted = false; // ตัวแปรเก็บสถานะว่าโหวตหรือยัง
let votedClubId = null; // เก็บไอดีชมรมที่เคยโหวตไปแล้ว
let isAdmin = false;
let systemConfig = null;

// ตรวจสอบสถานะล็อกอินตอนเปิดหน้าเว็บมา
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("กำลังตรวจสอบสถานะการล็อกอิน...");

        if (typeof db === 'undefined') {
            alert("หาตัวแปร 'db' ไม่เจอ! คุณอาจจะลืมใส่ <script src='supabase-config.js'></script>");
            return;
        }

        const { data: { session }, error } = await db.auth.getSession();

        if (error) {
            console.error("Session Error:", error);
            alert("มีปัญหาในการตรวจสอบล็อกอิน: " + error.message);
        }

        if (!session) {
            document.getElementById('loginScreen').classList.remove('d-none');
            document.getElementById('voteScreen').classList.add('d-none');
            document.getElementById('userDisplay').innerText = "ยังไม่ได้เข้าสู่ระบบ";
        } else {
            currentUserEmail = session.user.email;
            const userDisplayEl = document.getElementById('userDisplay');
            userDisplayEl.innerHTML = `👤 ${escapeHtml(currentUserEmail)}`;
            userDisplayEl.classList.remove('text-white');
            userDisplayEl.classList.add('btn', 'btn-success');
            document.getElementById('logoutBtn').classList.remove('d-none');
            
            document.getElementById('loginScreen').classList.add('d-none');
            document.getElementById('voteScreen').classList.remove('d-none');
            await checkSystemAndAdmin();
            // สเต็ปใหม่: เช็คก่อนเลยว่าคนนี้เคยโหวตหรือยัง?
            await checkUserVoteStatus();
        }
    } catch (err) {
        console.error("Fatal Error:", err);
    }
});

//ฟังก์ชันเช็คว่าเป็นแอดมินหรือไม่ และดึงค่าตั้งค่าระบบ
async function checkSystemAndAdmin() {
    // เช็คแอดมิน
    const { data: adminData } = await db.from('admins').select('email').eq('email', currentUserEmail).maybeSingle();
    if (adminData) isAdmin = true;

    // ดึงค่าตั้งค่าระบบ
    const { data: configData } = await db.from('system_config').select('*').eq('id', 1).single();
    systemConfig = configData;
}

// ฟังก์ชันเช็คประวัติการโหวต
async function checkUserVoteStatus() {
    console.log("กำลังตรวจสอบสิทธิ์การโหวต...");
    
    const { data, error } = await db
        .from('votes')
        .select('club_id')
        .eq('email', currentUserEmail)
        .maybeSingle(); // ดึงมาแค่ 1 แถว ถ้าไม่มีจะคืนค่า null

    if (error) {
        console.error("Check Vote Error:", error);
    }

    if (data) {
        // ถ้ามีข้อมูลแปลว่าเคยโหวตแล้ว
        hasVoted = true;
        votedClubId = data.club_id;
        
        // แสดงแถบแจ้งเตือนหน้าเว็บ (ถ้ามี)
        const alertBox = document.getElementById('votedAlert');
        if (alertBox) alertBox.classList.remove('d-none');
    }

    // เมื่อเช็คเสร็จ ค่อยไปดึงข้อมูลชมรมมาวาดบนหน้าจอ
    fetchClubsForVote();
}

// ฟังก์ชันกดล็อกอินด้วย Google
async function handleGoogleLogin() {
    try {
        const { error } = await db.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/vote.html'
            }
        });
        if (error) alert("เกิดข้อผิดพลาดในการล็อกอิน: " + error.message);
    } catch (err) {
        alert("ระบบล็อกอินขัดข้อง: " + err.message);
    }
}

// ฟังก์ชันออกจากระบบ
async function handleLogout() {
    await db.auth.signOut();
    location.reload();
}

// โหลดข้อมูลชมรมจากฐานข้อมูล
async function fetchClubsForVote() {
    console.log("กำลังดึงรายชื่อชมรม...");
    const { data, error } = await db.from('clubs').select('*').order('id', { ascending: true });
    
    if (!error) {
        clubsData = data;
        renderClubs(clubsData);
    } else {
        console.error("Fetch Error:", error);
        alert("ไม่สามารถดึงข้อมูลชมรมได้: " + error.message);
    }
}

// เรนเดอร์ Card ชมรม
// เรนเดอร์ Card ชมรม
function renderClubs(data) {
    const container = document.getElementById('voteContainer');
    container.innerHTML = '';
    
    if(data.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">ยังไม่มีข้อมูลชมรมในระบบ</div>';
        return;
    }

    data.forEach(club => {
        let buttonHTML = '';
        let cardBorderClass = 'border-primary';
        let titleColorClass = 'text-primary';
        
        // --- 1. โค้ดส่วนที่เพิ่มมาใหม่: เช็คว่าแอดมินปิดโหวต หรือหมดเวลาหรือยัง ---
        const now = new Date();
        // เช็คว่ามีค่า systemConfig ส่งมาไหม ถ้ามีให้เอาเวลามาคำนวณ
        const closeTime = systemConfig && systemConfig.close_time ? new Date(systemConfig.close_time) : null;
        const isTimeOver = closeTime && now > closeTime;
        // ถ้าระบบ voting_open เป็น false หรือ เวลาปัจจุบันเลยเวลาที่ตั้งไว้ ระบบจะถือว่าปิดโหวต
        const isVotingClosed = systemConfig && (!systemConfig.voting_open || isTimeOver);


        // --- 2. ระบบเช็คปุ่ม: จัดลำดับเงื่อนไขใหม่ ---
        if (isVotingClosed && !hasVoted) {
            // กรณีที่ 1: หมดเวลาโหวตหรือแอดมินปิดระบบ (และคนนี้ยังไม่ได้โหวต) ล็อกปุ่มให้กดไม่ได้
            buttonHTML = `<button class="btn btn-secondary mt-auto w-100" disabled style="opacity: 0.7;">⏳ ปิดรับคะแนนโหวตแล้ว</button>`;
            cardBorderClass = 'border-secondary';
            titleColorClass = 'text-secondary';

        } else if (hasVoted) {
            // กรณีที่ 2: โค้ดเดิมของคุณ ถ้าเคยโหวตแล้ว
            if (club.id === votedClubId) {
                // ชมรมที่ผู้ใช้เลือกโหวตไป (เขียว)
                buttonHTML = `<button class="btn btn-success mt-auto w-100" disabled>✅ คุณโหวตชมรมนี้ไปแล้ว</button>`;
                cardBorderClass = 'border-success';
                titleColorClass = 'text-success';
            } else {
                // ชมรมอื่นๆ ที่ไม่ได้เลือก (เทา)
                buttonHTML = `<button class="btn btn-secondary mt-auto w-100" disabled style="opacity: 0.5;">หมดสิทธิ์โหวต</button>`;
                cardBorderClass = 'border-secondary';
                titleColorClass = 'text-secondary';
            }

        } else {
            // กรณีที่ 3: โค้ดเดิมของคุณ (ระบบเปิดอยู่ + ยังไม่เคยโหวต) เป็นปุ่มสีน้ำเงินปกติ
            // ใช้ data-club-id แทนการฝังชื่อ/รายละเอียดชมรมลงใน onclick="" โดยตรง
            // เพราะการฝังข้อความดิบแบบนั้นเสี่ยงต่อ XSS และจะพังทันทีถ้าชื่อชมรมมีเครื่องหมาย ' อยู่
            buttonHTML = `<button class="btn btn-primary mt-auto w-100 vote-btn" data-club-id="${club.id}">โหวตชมรมนี้</button>`;
        }

        // วาดการ์ดออกมา (escapeHtml ป้องกันไม่ให้ชื่อ/คำอธิบายที่มี HTML/สคริปต์ปนมาถูกรันบนหน้าเว็บ)
        container.innerHTML += `
            <div class="col-md-6 col-lg-4">
                <div class="card club-card h-100 shadow-sm ${cardBorderClass}">
                    <div class="card-body text-center d-flex flex-column">
                        <h5 class="fw-bold ${titleColorClass}">#${club.id} ${escapeHtml(club.name)}</h5>
                        <p class="small text-muted">${escapeHtml(club.description || '')}</p>
                        ${buttonHTML}
                    </div>
                </div>
            </div>
        `;
    });
}

// รับคลิกปุ่ม "โหวตชมรมนี้" ทั้งหมดผ่าน event delegation (แทนการใช้ onclick="" ฝังข้อมูลดิบ)
document.getElementById('voteContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('.vote-btn');
    if (!btn) return;
    const clubId = parseInt(btn.dataset.clubId, 10);
    const club = clubsData.find(c => c.id === clubId);
    if (club) prepareVote(club.id, club.name, club.detail_full || '');
});

// ระบบค้นหาแบบ Real-time
document.getElementById('searchInput').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = clubsData.filter(club => 
        club.name.toLowerCase().includes(keyword) || 
        club.id.toString() === keyword
    );
    renderClubs(filtered);
});

// เปิด Modal ยืนยันการโหวต
function prepareVote(id, name, detail) {
    if (hasVoted) return; // ป้องกันการแอบรันฟังก์ชันผ่าน Console

    selectedClubId = id;
    document.getElementById('confirmClubName').innerText = name;
    document.getElementById('confirmClubDetail').innerText = detail || "ไม่มีรายละเอียดเพิ่มเติม";
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmVoteModal'));
    confirmModal.show();
}

// ยิงข้อมูลบันทึกผลโหวต
document.getElementById('confirmVoteBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmVoteBtn');
    btn.disabled = true;
    btn.innerText = 'กำลังบันทึก...';

    const { error } = await db
        .from('votes')
        .insert([{ email: currentUserEmail, club_id: selectedClubId }]);

    if (error) {
        if (error.code === '23505') {
            alert('❌ บัญชี Google นี้เคยใช้สิทธิ์โหวตไปแล้ว!');
        } else {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        }
        btn.disabled = false;
        btn.innerText = 'ยืนยันการโหวต';
    } else {
        alert('✅ โหวตสำเร็จ! ขอบคุณที่ร่วมกิจกรรม');
        window.location.href = 'total.html';
    }
    
    bootstrap.Modal.getInstance(document.getElementById('confirmVoteModal')).hide();
});