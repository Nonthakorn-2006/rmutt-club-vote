let currentUserEmail = null;
let clubsData = [];
let selectedClubId = null;
let hasVoted = false; // ตัวแปรเก็บสถานะว่าโหวตหรือยัง
let votedClubId = null; // เก็บไอดีชมรมที่เคยโหวตไปแล้ว

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
            document.getElementById('userDisplay').innerText = ` ${currentUserEmail}`;
            document.getElementById('logoutBtn').classList.remove('d-none');
            
            document.getElementById('loginScreen').classList.add('d-none');
            document.getElementById('voteScreen').classList.remove('d-none');
            
            // สเต็ปใหม่: เช็คก่อนเลยว่าคนนี้เคยโหวตหรือยัง?
            await checkUserVoteStatus();
        }
    } catch (err) {
        console.error("Fatal Error:", err);
    }
});

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
        
        // --- ระบบเช็คปุ่ม: ถ้าเคยโหวตแล้ว ให้ล็อกปุ่มทั้งหมด ---
        if (hasVoted) {
            if (club.id === votedClubId) {
                // ชมรมที่ผู้ใช้เลือกโหวตไป (ทำให้เป็นสีเขียว เพื่อให้รู้ว่าโหวตอันนี้)
                buttonHTML = `<button class="btn btn-success mt-auto w-100" disabled>✅ คุณโหวตชมรมนี้ไปแล้ว</button>`;
                cardBorderClass = 'border-success';
                titleColorClass = 'text-success';
            } else {
                // ชมรมอื่นๆ ที่ไม่ได้เลือก (ทำให้เป็นสีเทา กดไม่ได้)
                buttonHTML = `<button class="btn btn-secondary mt-auto w-100" disabled style="opacity: 0.5;">หมดสิทธิ์โหวต</button>`;
                cardBorderClass = 'border-secondary';
                titleColorClass = 'text-secondary';
            }
        } else {
            // ถ้ายังไม่เคยโหวต เป็นปุ่มสีน้ำเงินปกติ
            buttonHTML = `<button class="btn btn-primary mt-auto w-100" onclick="prepareVote(${club.id}, '${club.name}', '${club.detail_full || ''}')">โหวตชมรมนี้</button>`;
        }

        container.innerHTML += `
            <div class="col-md-6 col-lg-4">
                <div class="card club-card h-100 shadow-sm ${cardBorderClass}">
                    <div class="card-body text-center d-flex flex-column">
                        <h5 class="fw-bold ${titleColorClass}">#${club.id} ${club.name}</h5>
                        <p class="small text-muted">${club.description || ''}</p>
                        ${buttonHTML}
                    </div>
                </div>
            </div>
        `;
    });
}

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