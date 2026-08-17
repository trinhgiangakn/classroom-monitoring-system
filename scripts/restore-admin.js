const db = require('../backend/config/db');

async function restoreAdmin() {
  try {
    const [result] = await db.query(
      "UPDATE users SET role = 'admin' WHERE username = 'baokhanhdtm' OR email = 'baokhanhdtm@gmail.com'"
    );
    console.log('✅ Đã khôi phục quyền Admin cho tài khoản baokhanhdtm thành công! Số dòng ảnh hưởng:', result.affectedRows);
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khôi phục admin:', error.message);
    process.exit(1);
  }
}

restoreAdmin();
