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
  const [scale, setScale] = useState<number>(2.0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 選中文本相關狀態
  const [selectedText, setSelectedText] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [sidebarPosition, setSidebarPosition] = useState<{top: number, left: number}>({ top: 0, left: 0 });
  const [sidebarSize, setSidebarSize] = useState<{width: number, height: number}>({ width: 300, height: 400 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{x: number, y: number, width: number, height: number}>({ x: 0, y: 0, width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<{id: string, text: string, note: string, color: string, page: number}[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  // 監聽文本選擇事件
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        const text = selection.toString();
        setSelectedText(text);
        
        // 獲取選擇範圍的位置
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 計算側邊欄位置
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          setSidebarPosition({
            top: rect.top - containerRect.top,
            left: rect.right - containerRect.left + 10 // 在選中文本右側顯示
          });
        }
        
        setShowSidebar(true);
      }
    };
    
    document.addEventListener('mouseup', handleTextSelection);
    
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
    };
  }, []);

  // 處理側邊欄拖動
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && sidebarRef.current && containerRef.current) {
        e.preventDefault(); // 防止選中文本
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeft = e.clientX - containerRect.left - dragOffset.x;
        const newTop = e.clientY - containerRect.top - dragOffset.y;
        
        // 確保側邊欄不會被拖出容器
        const maxLeft = containerRect.width - sidebarSize.width;
        const maxTop = containerRect.height - sidebarSize.height;
        
        setSidebarPosition({
          left: Math.max(0, Math.min(newLeft, maxLeft)),
          top: Math.max(0, Math.min(newTop, maxTop))
        });
      } else if (isResizing && sidebarRef.current && containerRef.current) {
        e.preventDefault(); // 防止選中文本
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = resizeStart.width + (e.clientX - resizeStart.x);
        const newHeight = resizeStart.height + (e.clientY - resizeStart.y);
        
        // 設置最小和最大尺寸
        const minWidth = 200;
        const minHeight = 150;
        const maxWidth = containerRect.width - sidebarPosition.left;
        const maxHeight = containerRect.height - sidebarPosition.top;
        
        setSidebarSize({
          width: Math.max(minWidth, Math.min(newWidth, maxWidth)),
          height: Math.max(minHeight, Math.min(newHeight, maxHeight))
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, sidebarPosition, sidebarSize]);

  // 點擊文檔其他地方時隱藏側邊欄
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && 
          textLayerRef.current && !textLayerRef.current.contains(event.target as Node)) {
        // 只有當不是在拖動或調整大小時才隱藏側邊欄
        if (!isDragging && !isResizing) {
          setShowSidebar(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDragging, isResizing]);

  // 開始拖動側邊欄
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sidebarRef.current) {
      // 計算鼠標在拖動區域內的相對位置
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      
      setIsDragging(true);
      setDragOffset({
        x: offsetX,
        y: offsetY
      });
      
      // 防止默認行為和事件冒泡
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 開始調整側邊欄大小
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sidebarRef.current) {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: sidebarSize.width,
        height: sidebarSize.height
      });
      e.preventDefault(); // 防止文本選擇
      e.stopPropagation(); // 防止觸發拖動
    }
  };

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

  // 側邊欄功能
  const handleCopyText = () => {
    navigator.clipboard.writeText(selectedText)
      .then(() => {
        alert('文本已複製到剪貼板');
      })
      .catch(err => {
        console.error('複製失敗:', err);
        alert('複製失敗，請手動複製');
      });
  };
  
  const handleHighlight = (color: string) => {
    const newAnnotation = {
      id: Date.now().toString(),
      text: selectedText,
      note: '',
      color,
      page: currentPage
    };
    
    setAnnotations(prev => [...prev, newAnnotation]);
  };
  
  const handleAddNote = () => {
    const note = prompt('請輸入註釋:', '');
    if (note !== null) {
      const newAnnotation = {
        id: Date.now().toString(),
        text: selectedText,
        note,
        color: 'yellow',
        page: currentPage
      };
      
      setAnnotations(prev => [...prev, newAnnotation]);
    }
  };
  
  const handleSearch = () => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`, '_blank');
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
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center p-4 relative">
        <div className="relative shadow-lg">
          <canvas ref={canvasRef} className="block" />
          <div ref={textLayerRef} className="absolute top-0 left-0 text-layer" />
          
          {/* 選中文本時顯示的側邊欄 */}
          {showSidebar && (
            <div 
              ref={sidebarRef}
              className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-lg z-50 border border-gray-200 dark:border-gray-700 sidebar-animation overflow-hidden"
              style={{ 
                top: `${sidebarPosition.top}px`, 
                left: `${sidebarPosition.left}px`,
                width: `${sidebarSize.width}px`,
                height: `${sidebarSize.height}px`
              }}
            >
              {/* 拖動區域 - 標題欄 */}
              <div 
                className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-between items-center select-none"
                onMouseDown={handleDragStart}
              >
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">選中文本操作</h3>
                <button 
                  onClick={() => setShowSidebar(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 內容區域 */}
              <div className="p-3 overflow-y-auto" style={{ height: 'calc(100% - 45px - 14px)' }}>
                <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                    {selectedText}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <button 
                    onClick={handleCopyText}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    複製文本
                  </button>
                  
                  <div className="px-3 py-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">高亮顏色</p>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleHighlight('yellow')}
                        className="w-6 h-6 rounded-full bg-yellow-200 hover:ring-2 ring-yellow-400"
                        aria-label="黃色高亮"
                      />
                      <button 
                        onClick={() => handleHighlight('green')}
                        className="w-6 h-6 rounded-full bg-green-200 hover:ring-2 ring-green-400"
                        aria-label="綠色高亮"
                      />
                      <button 
                        onClick={() => handleHighlight('blue')}
                        className="w-6 h-6 rounded-full bg-blue-200 hover:ring-2 ring-blue-400"
                        aria-label="藍色高亮"
                      />
                      <button 
                        onClick={() => handleHighlight('pink')}
                        className="w-6 h-6 rounded-full bg-pink-200 hover:ring-2 ring-pink-400"
                        aria-label="粉色高亮"
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleAddNote}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    添加註釋
                  </button>
                  
                  <button 
                    onClick={handleSearch}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Google 搜索
                  </button>
                </div>
                
                {/* 註釋列表 */}
                {annotations.length > 0 && (
                  <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">當前頁面註釋</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {annotations.filter(a => a.page === currentPage).map(annotation => (
                        <div 
                          key={annotation.id} 
                          className="p-2 rounded-md border-l-4 bg-gray-50 dark:bg-gray-700"
                          style={{ borderLeftColor: annotation.color }}
                        >
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{annotation.text}</p>
                          {annotation.note && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{annotation.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 調整大小的手柄 */}
              <div 
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize select-none"
                onMouseDown={handleResizeStart}
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.2) 2px, transparent 2px)',
                  backgroundSize: '4px 4px',
                  backgroundPosition: '0 0',
                  backgroundRepeat: 'no-repeat'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer; 