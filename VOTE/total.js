async function fetchLeaderboard() {
    console.log("กำลังพยายามเชื่อมต่อ API ของ Supabase...");
    
    try {
        // 1. ตรวจสอบผู้ใช้ปัจจุบัน
        const { data: { session } } = await db.auth.getSession();
        const userEmail = session ? session.user.email : null;

        // 2. ตรวจสอบว่าเป็นแอดมินหรือไม่
        let isAdmin = false;
        if (userEmail) {
            const { data: adminData } = await db.from('admins').select('email').eq('email', userEmail).maybeSingle();
            if (adminData) isAdmin = true;
        }

        // 2.5 เช็คว่าผู้ใช้คนนี้เคยโหวตชมรมไหนไปแล้ว (เพื่อไฮไลท์ในลีดเดอร์บอร์ด)
        let myVoteClubId = null;
        if (userEmail) {
            const { data: myVote } = await db
                .from('votes')
                .select('club_id')
                .eq('email', userEmail)
                .maybeSingle();
            if (myVote) myVoteClubId = myVote.club_id;
        }

        // 3. ดึงการตั้งค่าระบบ
        const { data: config } = await db.from('system_config').select('show_total').eq('id', 1).single();
        
        // 4. เงื่อนไขการบล็อก
        // ถ้าโหมด show_total ปิดอยู่ (false) และ "ไม่ใช่แอดมิน" ให้บล็อก
        if (config && config.show_total === false && !isAdmin) {
            const container = document.getElementById('leaderboardContainer');
            container.innerHTML = `
                <div class="text-center p-5">
                    <h4 class="text-muted fw-bold">🔒 ผลคะแนนยังไม่เปิดเผย</h4>
                    <p>ระบบจะประกาศผลคะแนนให้ทราบอีกครั้งหลังจากปิดโหวต</p>
                    <a href="index.html" class="btn btn-primary mt-3">กลับหน้าแรก</a>
                </div>
            `;
            return; // หยุดการทำงาน ไม่ต้องไปดึงข้อมูลโหวต
        }
        // เช็คก่อนเลยว่าตัวแปร db (Supabase) ถูกโหลดมาพร้อมไหม
        if (typeof db === 'undefined') {
            throw new Error("หาตัวแปร 'db' ไม่เจอ! คุณอาจจะลืมใส่ <script src='supabase-config.js'></script> ไว้ก่อนไฟล์ total.js ในหน้า HTML");
        }

        // ดึงข้อมูลชมรม
        const { data: clubs, error: clubError } = await db.from('clubs').select('id, name');
        
        // ดึงยอดโหวต — ใช้ฟังก์ชัน get_vote_counts() แทนการ select ตาราง votes ตรงๆ
        // เพราะตาราง votes มี RLS ที่จำกัดให้เห็นแค่แถวของตัวเอง การ select ตรงๆ
        // จะทำให้นับคะแนนรวมได้ไม่ครบ (เห็นแค่โหวตของตัวเอง)
        const { data: voteCountsRaw, error: voteError } = await db.rpc('get_vote_counts');

        // เช็ค Error จากฝั่ง Supabase โดยตรง
        if (clubError) {
            console.error('Error fetching clubs:', clubError);
            alert('❌ API ตาราง Clubs มีปัญหา: ' + clubError.message);
            return;
        }
        
        if (voteError) {
            console.error('Error fetching votes:', voteError);
            alert('❌ API นับคะแนนโหวตมีปัญหา: ' + voteError.message + '\n\nถ้าเจอ error ว่าหาฟังก์ชันไม่เจอ ให้ไปสร้างฟังก์ชัน get_vote_counts() ใน Supabase SQL Editor ก่อน');
            return;
        }

        console.log("✅ ดึงข้อมูลสำเร็จ! ข้อมูลชมรม:", clubs);
        console.log("✅ ดึงข้อมูลสำเร็จ! ยอดโหวตต่อชมรม:", voteCountsRaw);

        // เช็คว่าตารางว่างเปล่าไหม
        const container = document.getElementById('leaderboardContainer');
        if (!clubs || clubs.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-danger fw-bold">เชื่อมต่อ API สำเร็จนะ! แต่ในตาราง clubs ยังไม่มีข้อมูลชมรมเลย ไปเพิ่มข้อมูลใน Supabase ก่อน!</div>';
            return;
        }

        // นับคะแนนโหวต (จัดกลุ่มตาม club_id) จากผลลัพธ์ที่ฟังก์ชันรวมมาให้แล้ว
        const voteCounts = {};
        let totalVotes = 0;
        if (voteCountsRaw && voteCountsRaw.length > 0) {
            voteCountsRaw.forEach(row => {
                voteCounts[row.club_id] = Number(row.vote_count);
                totalVotes += Number(row.vote_count);
            });
        }

        // นำคะแนนไปผูกกับชื่อชมรม และคำนวณ %
        let leaderboard = clubs.map(club => {
            const score = voteCounts[club.id] || 0;
            const percent = totalVotes === 0 ? 0 : Math.round((score / totalVotes) * 100);
            return { ...club, score, percent };
        });

        // เรียงลำดับจากคะแนนมากไปน้อย (อันดับ 1 อยู่บนสุด)
        leaderboard.sort((a, b) => b.score - a.score);

        // แสดงผลหน้าเว็บ
        container.innerHTML = '';
        
        leaderboard.forEach((club, index) => {
            // แจกเหรียญรางวัลให้อันดับ 1-3
            let rankBadge = `#${index + 1}`;
            if (index === 0) rankBadge = '🥇 อันดับ 1';
            else if (index === 1) rankBadge = '🥈 อันดับ 2';
            else if (index === 2) rankBadge = '🥉 อันดับ 3';

            // เช็คว่านี่คือชมรมที่ผู้ใช้คนปัจจุบันโหวตไปหรือไม่ เพื่อไฮไลท์ให้เด่น
            const isMine = myVoteClubId !== null && club.id === myVoteClubId;
            const itemClass = isMine ? 'list-group-item d-flex justify-content-between align-items-center p-3 my-vote-item' : 'list-group-item d-flex justify-content-between align-items-center p-3';
            const myTag = isMine ? '<span class="my-vote-tag">⭐ โหวตของคุณ</span>' : '';

            container.innerHTML += `
                <div class="${itemClass}">
                    <div class="w-100">
                        <div class="d-flex justify-content-between mb-2">
                            <h5 class="mb-0 fw-bold">${rankBadge} : ${escapeHtml(club.name)} ${myTag}</h5>
                            <span class="badge bg-success fs-6">${club.score} โหวต</span>
                        </div>
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${club.percent}%;"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        
    } catch (err) {
        console.error("Critical Error:", err);
        alert("⚠️ เกิดข้อผิดพลาดร้ายแรงของระบบ (ดูรายละเอียดใน Console / F12)\n\n" + err.message);
    }
}

// โหลดครั้งแรกตอนเปิดหน้า
document.addEventListener('DOMContentLoaded', fetchLeaderboard);