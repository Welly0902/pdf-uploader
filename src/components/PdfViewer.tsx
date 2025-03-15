"use client";

import { useState, useEffect } from 'react';

interface PdfViewerProps {
  file: File | null;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      // 釋放之前的 URL 以避免內存洩漏
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      
      // 創建新的 URL
      const url = URL.createObjectURL(file);
      setFileUrl(url);
    }
    
    // 組件卸載時清理
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [file]);

  if (!fileUrl) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">請上傳 PDF 文件</div>;
  }

  return (
    <div className="w-full h-full">
      <object
        data={fileUrl}
        type="application/pdf"
        className="w-full h-full bg-white dark:bg-gray-900"
      >
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          您的瀏覽器不支持直接查看 PDF。
          <a 
            href={fileUrl} 
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 ml-2"
            target="_blank" 
            rel="noopener noreferrer"
          >
            點擊下載
          </a>
        </div>
      </object>
    </div>
  );
};

export default PdfViewer; 