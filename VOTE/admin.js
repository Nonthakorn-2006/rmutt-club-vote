let currentUserEmail = null;
let systemConfig = null;

// ทำงานอัตโนมัติเมื่อหน้าเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof db === 'undefined') {
            alert("หาตัวแปร 'db' ไม่เจอ! ตรวจสอบว่าได้ลิงก์ไฟล์ supabase-config.js แล้วหรือยัง");
            return;
        }

        // 1. ดึงข้อมูล Session ปัจจุบัน
        const { data: { session }, error } = await db.auth.getSession();

        if (error) {
            console.error("Session Error:", error);
            showAccessDenied("เกิดข้อผิดพลาดในการตรวจสอบ Session");
            return;
        }

        // 2. ตรวจสอบว่าเข้าระบบหรือยัง
        if (!session) {
            showAccessDenied("กรุณาเข้าสู่ระบบผ่านหน้าโหวตก่อนใช้งานหน้านี้");
            return;
        }

        currentUserEmail = session.user.email;
        document.getElementById('userDisplay').innerText = ` Admin: ${currentUserEmail}`;
        document.getElementById('logoutBtn').classList.remove('d-none');

        // 3. ยิงคำสั่งเช็คอีเมลกับตาราง 'admins' ใน Supabase
        const { data: adminData, error: adminError } = await db
            .from('admins')
            .select('email')
            .eq('email', currentUserEmail)
            .maybeSingle();

        if (adminError || !adminData) {
            showAccessDenied("🔒 บัญชีของคุณไม่มีสิทธิ์แอดมิน (Access Denied)");
            return;
        }

        // 4. ผ่านทุกเงื่อนไข -> เปิดหน้าควบคุมและดึงข้อมูล
        document.getElementById('adminScreen').classList.remove('d-none');
        await loadSystemConfig();
        await fetchLiveResults();

        // 5. ผูกปุ่มเข้ากับฟังก์ชันสั่งงาน
        document.getElementById('toggleVoteBtn').addEventListener('click', toggleVotingStatus);
        document.getElementById('toggleResultBtn').addEventListener('click', toggleResultStatus);
        document.getElementById('saveTimeBtn').addEventListener('click', saveCloseTime);

    } catch (err) {
        console.error("Fatal Admin Error:", err);
        showAccessDenied("เกิดข้อผิดพลาดร้ายแรงในระบบ");
    }
});

// ฟังก์ชันซ่อน Dashboard และเปิดหน้าต่างแจ้งเตือนล็อกหน้าจอ
function showAccessDenied(message) {
    document.getElementById('accessDeniedScreen').classList.remove('d-none');
    document.getElementById('accessDeniedMessage').innerText = message;
    document.getElementById('adminScreen').classList.add('d-none');
    document.getElementById('userDisplay').innerText = "ปฏิเสธการเข้าถึง";
}

// ฟังก์ชันออกจากระบบ
async function handleLogout() {
    await db.auth.signOut();
    window.location.href = 'index.html';
}

// ฟังก์ชันดึงค่า Config ปัจจุบันมาแสดงผลบนปุ่ม
async function loadSystemConfig() {
    const { data, error } = await db.from('system_config').select('*').eq('id', 1).single();
    
    if (error) {
        console.error("Load Config Error:", error);
        alert("ไม่สามารถโหลดค่าตั้งค่าระบบจากฐานข้อมูลได้");
        return;
    }

    systemConfig = data;

    // อัปเดตส่วนควบคุมการเปิด-ปิดโหวต
    const voteText = document.getElementById('voteStatusText');
    const toggleVoteBtn = document.getElementById('toggleVoteBtn');
    if (systemConfig.voting_open) {
        voteText.innerText = "🟢 กำลังเปิดให้โหวต";
        voteText.className = "fw-bold text-success";
        toggleVoteBtn.innerText = "🔴 สั่งปิดระบบโหวต";
        toggleVoteBtn.className = "btn btn-sm btn-outline-danger shadow-none";
    } else {
        voteText.innerText = "🔴 ปิดระบบโหวตชั่วคราว";
        voteText.className = "fw-bold text-danger";
        toggleVoteBtn.innerText = "🟢 สั่งเปิดระบบโหวต";
        toggleVoteBtn.className = "btn btn-sm btn-success shadow-none";
    }

    // อัปเดตส่วนเปิด-ปิดหน้า Total สำหรับบุคคลทั่วไป
    const resultText = document.getElementById('resultStatusText');
    const toggleResultBtn = document.getElementById('toggleResultBtn');
    if (systemConfig.show_total) {
        resultText.innerText = "👁️ เปิดให้คนทั่วไปดูผลคะแนน";
        resultText.className = "fw-bold text-success";
        toggleResultBtn.innerText = "🔒 สั่งซ่อนผลคะแนน";
        toggleResultBtn.className = "btn btn-sm btn-outline-danger shadow-none";
    } else {
        resultText.innerText = "🔒 ซ่อนคะแนนอยู่ (ดูได้เฉพาะแอดมิน)";
        resultText.className = "fw-bold text-muted";
        toggleResultBtn.innerText = "👁️ สั่งแสดงผลคะแนน";
        toggleResultBtn.className = "btn btn-sm btn-success shadow-none";
    }

    // จัดฟอร์แมตเวลาเดิมมาใส่ในกล่อง datetime-local
    if (systemConfig.close_time) {
        const localDate = new Date(systemConfig.close_time);
        const tzOffset = localDate.getTimezoneOffset() * 60000;
        const formattedTime = (new Date(localDate.getTime() - tzOffset)).toISOString().slice(0, 16);
        document.getElementById('closeTimeInput').value = formattedTime;
    }
}

// ฟังก์ชันสลับสถานะเปิด-ปิดรับคะแนน
async function toggleVotingStatus() {
    const nextStatus = !systemConfig.voting_open;
    const { error } = await db.from('system_config').update({ voting_open: nextStatus }).eq('id', 1);
    
    if (error) alert("อัปเดตไม่สำเร็จ: " + error.message);
    else await loadSystemConfig();
}

// ฟังก์ชันสลับสถานะแสดงหรือซ่อนผลคะแนนรวม
async function toggleResultStatus() {
    const nextStatus = !systemConfig.show_total;
    const { error } = await db.from('system_config').update({ show_total: nextStatus }).eq('id', 1);
    
    if (error) alert("อัปเดตไม่สำเร็จ: " + error.message);
    else await loadSystemConfig();
}

// ฟังก์ชันเซฟเวลาปิดระบบรับโหวตอัตโนมัติ
async function saveCloseTime() {
    const timeValue = document.getElementById('closeTimeInput').value;
    if (!timeValue) {
        alert("กรุณาเลือกวันและเวลาที่ต้องการก่อนบันทึกครับ");
        return;
    }

    const isoTimestamp = new Date(timeValue).toISOString();
    const { error } = await db.from('system_config').update({ close_time: isoTimestamp }).eq('id', 1);

    if (error) {
        alert("ไม่สามารถบันทึกเวลาได้: " + error.message);
    } else {
        alert("💾 บันทึกกำหนดเวลาปิดโหวตเรียบร้อยแล้ว!");
        await loadSystemConfig();
    }
}

// ฟังก์ชันดึงคะแนนรวมมาคำนวณแบบ Real-time ให้แอดมินดูแบบ Exclusive
async function fetchLiveResults() {
    const container = document.getElementById('adminLeaderboard');
    container.innerHTML = '<div class="text-center p-4">🔄 กำลังคำนวณคะแนนสด...</div>';

    try {
        const { data: clubs, error: clubError } = await db.from('clubs').select('id, name');
        // ใช้ get_vote_counts() แทนการ select ตาราง votes ตรงๆ (RLS จำกัดให้เห็นแค่แถวตัวเอง)
        const { data: voteCountsRaw, error: voteError } = await db.rpc('get_vote_counts');

        if (clubError || voteError) {
            console.error('Live results error:', clubError || voteError);
            container.innerHTML = '<div class="text-center p-4 text-danger">ไม่สามารถคำนวณคะแนนได้เนื่องจาก API ขัดข้อง</div>';
            return;
        }

        // นับจำนวนโหวตจากผลลัพธ์ที่ฟังก์ชันรวมมาให้แล้ว
        const voteCounts = {};
        let totalVotes = 0;
        if (voteCountsRaw && voteCountsRaw.length > 0) {
            voteCountsRaw.forEach(row => {
                voteCounts[row.club_id] = Number(row.vote_count);
                totalVotes += Number(row.vote_count);
            });
        }

        let leaderboard = clubs.map(club => {
            const score = voteCounts[club.id] || 0;
            const percent = totalVotes === 0 ? 0 : Math.round((score / totalVotes) * 100);
            return { ...club, score, percent };
        });

        // เรียงลำดับจากคะแนนมากไปหาน้อย
        leaderboard.sort((a, b) => b.score - a.score);
        container.innerHTML = '';

        leaderboard.forEach((club, index) => {
            let badgeIcon = `#${index + 1}`;
            if (index === 0) badgeIcon = '🥇';
            else if (index === 1) badgeIcon = '🥈';
            else if (index === 2) badgeIcon = '🥉';

            container.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
                    <div class="w-100">
                        <div class="d-flex justify-content-between mb-1">
                            <span class="fw-bold text-dark">${badgeIcon} ID:${club.id} - ${escapeHtml(club.name)}</span>
                            <span class="badge bg-success fs-6">${club.score} โหวต (${club.percent}%)</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar" role="progressbar" style="width: ${club.percent}%; background-color: var(--violet) !important;"></div>
                        </div>
                    </div>
                </div>
            `;
        });

    } catch (err) {
        console.error("Live Results Error:", err);
        container.innerHTML = '<div class="text-center p-4 text-danger">ระบบขัดข้องในการประมวลผล</div>';
    }
}