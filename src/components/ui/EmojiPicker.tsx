import React from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: any) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => (
  <div className="z-50">
    <Picker data={data} onEmojiSelect={onEmojiSelect} theme="auto" />
  </div>
); 