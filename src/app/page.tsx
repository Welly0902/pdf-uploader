"use client";

import { useState, useRef } from "react";
import dynamic from 'next/dynamic';
import ThemeToggle from '../components/ThemeToggle';

// 動態導入 PdfViewer 組件，避免 SSR 問題
const PdfViewer = dynamic(() => import('../components/PdfViewer'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">正在加載 PDF 查看器...</div>
});

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<{id: string, title: string, content: string, date: string}[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
        setUploadSuccess(false);
      } else {
        alert("請上傳 PDF 文件");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setUploadSuccess(false);
      } else {
        alert("請上傳 PDF 文件");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    
    // 模擬上傳過程
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 創建一個新筆記
    const newNote = {
      id: Date.now().toString(),
      title: file.name.replace('.pdf', ''),
      content: "這是從您的 PDF 文件中提取的筆記內容。您可以在這裡編輯和組織您的想法。",
      date: new Date().toLocaleDateString('zh-TW')
    };
    
    setNotes(prev => [...prev, newNote]);
    setActiveNote(newNote.id);
    setIsUploading(false);
    setUploadSuccess(true);
    // 在實際應用中，這裡會有真正的上傳邏輯和 PDF 內容提取
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className={`notebooklm-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 側邊欄 */}
      <aside className={`notebooklm-sidebar transition-all duration-300 ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            <h1 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">PDF 筆記助手</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">智能筆記工具</p>
          </div>
          <button 
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label={isSidebarCollapsed ? "展開側邊欄" : "收起側邊欄"}
          >
            {isSidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        
        <div className={`p-4 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
          <button 
            onClick={triggerFileInput}
            className="notebooklm-button-primary w-full flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            上傳新 PDF
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange} 
            accept="application/pdf" 
            className="hidden" 
          />
        </div>
        
        <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">我的筆記</h2>
          
          {notes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">尚無筆記</p>
          ) : (
            <ul className="space-y-2">
              {notes.map(note => (
                <li 
                  key={note.id}
                  onClick={() => setActiveNote(note.id)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    activeNote === note.id 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <h3 className="font-medium text-gray-800 dark:text-gray-200">{note.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{note.content}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{note.date}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      
      {/* 頂部導航欄 */}
      <header className="notebooklm-header">
        {isSidebarCollapsed && (
          <button 
            onClick={toggleSidebar}
            className="mr-4 p-1 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="展開側邊欄"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        
        <div className="flex-1">
          {activeNote ? (
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              {notes.find(n => n.id === activeNote)?.title || '筆記'}
            </h2>
          ) : (
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">歡迎使用</h2>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          
          {file && !uploadSuccess && (
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className={`notebooklm-button-primary flex items-center ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  處理中...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  處理 PDF
                </>
              )}
            </button>
          )}
          
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
            U
          </div>
        </div>
      </header>
      
      {/* 主內容區域 */}
      <main className="notebooklm-main">
        <div className="h-full">
          {activeNote ? (
            <div className="notebooklm-card h-full overflow-hidden">
              <h3 className="p-4 text-xl font-medium border-b border-gray-200 dark:border-gray-700">{notes.find(n => n.id === activeNote)?.title}</h3>
              <div className="h-[calc(100%-4rem)] overflow-auto">
                <PdfViewer file={file} />
              </div>
            </div>
          ) : (
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">歡迎使用 PDF 筆記助手</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">上傳 PDF 文件，自動提取內容並創建智能筆記</p>
              
              <div 
                className={`notebooklm-dropzone mb-8 ${
                  isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-300 dark:border-gray-700 hover:border-indigo-400"
                } ${file ? "bg-gray-50 dark:bg-gray-800/50" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
              >
                {!file ? (
                  <div>
                    <div className="mb-4 flex justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-indigo-300 dark:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-2 font-medium">拖放 PDF 文件到這裡或點擊上傳</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">支持單個 PDF 文件</p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
              </div>
              
              {file && !uploadSuccess && (
                <button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className={`notebooklm-button-primary flex items-center mx-auto ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      處理中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      處理 PDF
                    </>
                  )}
                </button>
              )}
              
              {uploadSuccess && (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">PDF 處理完成！</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">您的筆記已創建，可以在側邊欄中查看</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
