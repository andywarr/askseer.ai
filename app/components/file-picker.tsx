'use client';
import { Button, Typography } from "@/MTailwind";
import { useRef, useState } from 'react';

export default function FilePicker() {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState(0);

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFileInputChange = (e) => {
    setFiles(e.target.files.length);
  };

  return (
    <div className="flex">
      <input
        accept="images/*"
        className="hidden"
        multiple={true} 
        name="file"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file" />

        <Button 
          className="flex items-center gap-3 mt-4 mb-6"
          onClick={handleButtonClick}
          variant="gradient">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
          >
              <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
          </svg>
          Upload Flow
        </Button>

        <p className="flex flex-wrap content-end ml-3 gap-3 mt-4 mb-6"><span className="antialiased block font-light text-xs">{files} {files !== 1 ? ' files ' : ' file '} selected.</span></p>
      </div>
  );
}