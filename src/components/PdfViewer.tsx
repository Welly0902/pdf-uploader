"use client";

import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';

// 設置 PDF.js worker 路徑
// 使用相對路徑，避免 CSP 問題
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PdfViewerProps {
  file: File | null;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 當文件變化時創建 URL
  useEffect(() => {
    if (file) {
      // 釋放之前的 URL 以避免內存洩漏
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      
      // 創建新的 URL
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setCurrentPage(1);
    }
    
    // 組件卸載時清理
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      if (pdfDocument) {
        pdfDocument.destroy();
      }
    };
  }, [file]);

  // 當 URL 變化時加載 PDF
  useEffect(() => {
    if (!fileUrl) return;
    
    setIsLoading(true);
    setError(null);
    
    const loadPdf = async () => {
      try {
        // 加載 PDF 文檔
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('加載 PDF 時出錯');
        setIsLoading(false);
      }
    };
    
    loadPdf();
  }, [fileUrl]);

  // 當頁面或縮放變化時渲染頁面
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;
    
    const renderPage = async () => {
      try {
        // 清空文本層
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = '';
        }
        
        // 獲取頁面
        const page = await pdfDocument.getPage(currentPage);
        
        // 設置縮放
        const viewport = page.getViewport({ scale });
        
        // 準備 canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // 渲染 PDF 頁面到 canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        await renderTask.promise;
        
        // 如果有文本層元素，渲染文本層
        if (textLayerRef.current) {
          try {
            // 設置文本層的大小和位置
            const textLayer = textLayerRef.current;
            textLayer.style.width = `${viewport.width}px`;
            textLayer.style.height = `${viewport.height}px`;
            
            // 獲取文本內容
            const textContent = await page.getTextContent();
            
            // 使用更精確的方法渲染文本
            renderTextLayer(textContent, textLayer, viewport, page);
          } catch (textErr) {
            console.error('Error rendering text layer:', textErr);
            // 文本層渲染失敗不應該阻止整個頁面顯示
          }
        }
      } catch (err) {
        console.error('Error rendering page:', err);
        setError('渲染頁面時出錯');
      }
    };
    
    renderPage();
  }, [pdfDocument, currentPage, scale]);

  // 改進的文本層渲染函數
  const renderTextLayer = (textContent: any, textLayerDiv: HTMLDivElement, viewport: any, page: any) => {
    // 清空文本層
    textLayerDiv.innerHTML = '';
    textLayerDiv.className = 'text-layer';
    
    // 獲取字體信息
    const normalizedViewport = viewport.clone({ dontFlip: false });
    
    // 處理每個文本項
    textContent.items.forEach((item: any) => {
      const tx = pdfjsLib.Util.transform(
        normalizedViewport.transform,
        item.transform
      );
      
      let angle = Math.atan2(tx[1], tx[0]);
      if (angle === 0) {
        angle = 0; // 避免負零
      }
      
      const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
      let fontAscent = fontHeight;
      
      if (item.fontName) {
        // 嘗試獲取字體信息
        const styles = window.getComputedStyle(textLayerDiv);
        const fontFamily = styles.getPropertyValue('font-family') || 'sans-serif';
        fontAscent = fontHeight * 0.8; // 估計值，通常字體上升高度約為總高度的80%
      }
      
      // 創建文本元素
      const textDiv = document.createElement('span');
      
      // 設置樣式
      textDiv.style.left = `${tx[4]}px`;
      textDiv.style.top = `${tx[5] - fontAscent}px`;
      textDiv.style.fontSize = `${fontHeight}px`;
      textDiv.style.fontFamily = item.fontName || 'sans-serif';
      
      // 處理旋轉
      if (angle !== 0) {
        textDiv.style.transform = `rotate(${angle}rad)`;
        textDiv.style.transformOrigin = '0% 0%';
      }
      
      // 設置文本內容
      textDiv.textContent = item.str;
      
      // 確保文本是透明的，但可選擇
      textDiv.style.color = 'transparent';
      
      // 添加到文本層
      textLayerDiv.appendChild(textDiv);
    });
  };

  // 頁面導航函數
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  // 縮放函數
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  };
  
  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  };

  if (!fileUrl) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">請上傳 PDF 文件</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        {error}
        <div className="mt-4">
          <a 
            href={fileUrl} 
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            target="_blank" 
            rel="noopener noreferrer"
          >
            點擊下載 PDF
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">正在加載 PDF...</div>;
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* 工具欄 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {/* 頁面導航 */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={goToPreviousPage} 
            disabled={currentPage <= 1}
            className={`p-1 rounded ${currentPage <= 1 ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            aria-label="上一頁"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {currentPage} / {totalPages}
          </span>
          
          <button 
            onClick={goToNextPage} 
            disabled={currentPage >= totalPages}
            className={`p-1 rounded ${currentPage >= totalPages ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            aria-label="下一頁"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        {/* 縮放控制 */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={zoomOut} 
            className="p-1 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="縮小"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {Math.round(scale * 100)}%
          </span>
          
          <button 
            onClick={zoomIn} 
            className="p-1 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="放大"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        {/* 下載按鈕 */}
        <a 
          href={fileUrl} 
          download={file?.name}
          className="p-1 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="下載 PDF"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
      
      {/* PDF 查看區域 */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center p-4">
        <div className="relative shadow-lg">
          <canvas ref={canvasRef} className="block" />
          <div ref={textLayerRef} className="absolute top-0 left-0 text-layer" />
        </div>
      </div>
    </div>
  );
};

export default PdfViewer; 