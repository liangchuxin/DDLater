import { useState, useCallback, useRef } from "react";
import PixelBox from "./PixelBox";
import "../styles/ConfirmModal.css";

// 一个基于 PixelBox 的通用确认弹窗,替代 window.confirm()。
// 支持 title / message / confirmLabel / cancelLabel / variant (primary | danger)。
// 点 backdrop 空白区等于 cancel。
function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <PixelBox
        variant="retro"
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="confirm-modal-title">{title}</div>}
        {message && <div className="confirm-modal-message">{message}</div>}
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-modal-btn ${variant}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </PixelBox>
    </div>
  );
}

// useConfirm: 返回 async confirm() 函数和 modal JSX。
// 用法:
//   const { confirm, modal } = useConfirm();
//   const ok = await confirm({ title, message, variant: "danger", confirmLabel: "Leave" });
//   if (!ok) return;
//   ...
// render 时记得把 {modal} 放进去,不然看不见弹窗。
export function useConfirm() {
  const [state, setState] = useState({ open: false, options: {} });
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const close = (result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState({ open: false, options: {} });
  };

  const modal = state.open ? (
    <ConfirmModal
      {...state.options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return { confirm, modal };
}

export default ConfirmModal;
