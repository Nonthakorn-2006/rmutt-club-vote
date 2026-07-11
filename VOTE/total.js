async function fetchLeaderboard() {
    console.log("กำลังพยายามเชื่อมต่อ API ของ Supabase...");
    
    try {
        // เช็คก่อนเลยว่าตัวแปร db (Supabase) ถูกโหลดมาพร้อมไหม
        if (typeof db === 'undefined') {
            throw new Error("หาตัวแปร 'db' ไม่เจอ! คุณอาจจะลืมใส่ <script src='supabase-config.js'></script> ไว้ก่อนไฟล์ total.js ในหน้า HTML");
        }

        // ดึงข้อมูลชมรม
        const { data: clubs, error: clubError } = await db.from('clubs').select('id, name');
        
        // ดึงข้อมูลโหวต
        const { data: votes, error: voteError } = await db.from('votes').select('club_id');

        // เช็ค Error จากฝั่ง Supabase โดยตรง
        if (clubError) {
            console.error('Error fetching clubs:', clubError);
            alert('❌ API ตาราง Clubs มีปัญหา: ' + clubError.message);
            return;
        }
        
        if (voteError) {
            console.error('Error fetching votes:', voteError);
            alert('❌ API ตาราง Votes มีปัญหา: ' + voteError.message);
            return;
        }

        console.log("✅ ดึงข้อมูลสำเร็จ! ข้อมูลชมรม:", clubs);
        console.log("✅ ดึงข้อมูลสำเร็จ! ข้อมูลโหวต:", votes);

        // เช็คว่าตารางว่างเปล่าไหม
        const container = document.getElementById('leaderboardContainer');
        if (!clubs || clubs.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-danger fw-bold">เชื่อมต่อ API สำเร็จนะ! แต่ในตาราง clubs ยังไม่มีข้อมูลชมรมเลย ไปเพิ่มข้อมูลใน Supabase ก่อน!</div>';
            return;
        }

        // นับคะแนนโหวต (จัดกลุ่มตาม club_id)
        const voteCounts = {};
        if (votes && votes.length > 0) {
            votes.forEach(vote => {
                if(vote.club_id) {
                    voteCounts[vote.club_id] = (voteCounts[vote.club_id] || 0) + 1;
                }
            });
        }

        // นำคะแนนไปผูกกับชื่อชมรม และคำนวณ %
        const totalVotes = votes ? votes.length : 0;
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

            container.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center p-3">
                    <div class="w-100">
                        <div class="d-flex justify-content-between mb-2">
                            <h5 class="mb-0 fw-bold">${rankBadge} : ${club.name}</h5>
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