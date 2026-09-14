"use client";

import { Tag } from "./model";

type TagPickerProps = {
  tags: Tag[];
  selectedIds: string[];
  onToggle(id: string): void;
};

export function TagPicker({ tags, selectedIds, onToggle }: TagPickerProps) {
  const visibleTags = tags.filter((tag) => !tag.archived);
  if (!visibleTags.length) return <div className="small-muted">还没有可选标签，可先到设置里创建。</div>;
  return <div className="tag-picker" role="group" aria-label="自由标签">
    {visibleTags.map((tag) => {
      const selected = selectedIds.includes(tag.id);
      return <button key={tag.id} type="button" className={`tag-option ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => onToggle(tag.id)}>#{tag.name}</button>;
    })}
  </div>;
}
