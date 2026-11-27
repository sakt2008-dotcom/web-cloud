import React from 'react';

interface DriveEmbedProps {
  folderUrl: string;
}

export const DriveEmbed: React.FC<DriveEmbedProps> = ({ folderUrl }) => {
  return (
    <div className="w-full h-96 rounded-2xl overflow-hidden border border-purple-200 shadow-inner bg-slate-50">
      <iframe
        src={folderUrl}
        width="100%"
        height="100%"
        allow="autoplay"
        className="border-none"
        title="Google Drive Folder"
      />
    </div>
  );
};
