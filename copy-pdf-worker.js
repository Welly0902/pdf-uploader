const fs = require('fs');
const path = require('path');

// 源文件路徑
const workerSrc = path.join(
  __dirname,
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs'
);

// 目標文件路徑
const workerDest = path.join(
  __dirname,
  'public',
  'pdf.worker.min.js'
);

// 確保目標目錄存在
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 複製文件
fs.copyFile(workerSrc, workerDest, (err) => {
  if (err) {
    console.error('Error copying PDF.js worker file:', err);
    process.exit(1);
  }
  console.log('PDF.js worker file copied successfully to public directory');
}); 