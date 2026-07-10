export function previewCharacterLabel(slotIndex, previewSlotCount) {
  if (previewSlotCount <= 1) return "Preview character";
  return `Preview character · seat ${slotIndex}${
    slotIndex === 0 ? " (left)" : " (right)"
  }`;
}

export default function PreviewCharacterPickers({
  avatars,
  previewAvatarBySlot,
  onPreviewAvatarChange,
  previewSlotCount,
  className = "fl-avatar-under-canvas",
}) {
  if (previewSlotCount < 1) return null;

  const rowClass =
    previewSlotCount > 1
      ? `${className} fl-avatar-under-canvas--multi`
      : `${className} fl-avatar-under-canvas--single`;

  return (
    <div className={rowClass}>
      {Array.from({ length: previewSlotCount }, (_, slotIndex) => (
        <label
          key={slotIndex}
          className="fl-field fl-avatar-field fl-avatar-below"
        >
          {previewCharacterLabel(slotIndex, previewSlotCount)}
          <select
            value={previewAvatarBySlot[slotIndex] ?? ""}
            onChange={(e) => onPreviewAvatarChange(slotIndex, e.target.value)}
            disabled={avatars.length === 0}
          >
            {avatars.length === 0 ? (
              <option value="">No avatars</option>
            ) : (
              avatars.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                  {a.isDefault ? " (default)" : ""}
                </option>
              ))
            )}
          </select>
        </label>
      ))}
    </div>
  );
}
