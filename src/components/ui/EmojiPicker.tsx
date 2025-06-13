import React, { lazy, Suspense } from "react";

const Picker = lazy(() => import('@emoji-mart/react'));

interface EmojiPickerProps {
  onEmojiSelect: (emoji: any) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => {
  return (
    <div className="z-50">
      <Suspense fallback={<div>Loading...</div>}>
        <Picker
          data={async () => {
            const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
            return response.json();
          }}
          onEmojiSelect={onEmojiSelect}
          theme="auto"
        />
      </Suspense>
    </div>
  );
}; 