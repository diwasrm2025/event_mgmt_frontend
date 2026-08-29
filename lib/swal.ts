"use client";

export type SwalIcon = "warning" | "error" | "success" | "info" | "question";

export type SwalOptions = {
  title: string;
  text?: string;
  icon?: SwalIcon;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  dangerMode?: boolean;
};

export type SwalResult = {
  isConfirmed: boolean;
  isDismissed: boolean;
};

/**
 * Lightweight, zero-dependency SweetAlert modal implementation
 * matching SweetAlert2 aesthetics, animations, icons, and keyboard/backdrop handling.
 */
export function fireSwal(options: SwalOptions): Promise<SwalResult> {
  return new Promise((resolve) => {
    // Ensure previous Swal is removed if present
    const existing = document.getElementById("custom-swal-container");
    if (existing) existing.remove();

    const {
      title,
      text = "",
      icon = "warning",
      showCancelButton = true,
      confirmButtonText = "Yes, proceed",
      cancelButtonText = "Cancel",
      dangerMode = true,
    } = options;

    // Outer Overlay
    const overlay = document.createElement("div");
    overlay.id = "custom-swal-container";
    overlay.className = "swal-overlay";

    // Modal Box
    const modal = document.createElement("div");
    modal.className = "swal-modal";

    // Icon HTML
    let iconSvg = "";
    if (icon === "warning") {
      iconSvg = `
        <div class="swal-icon swal-icon--warning">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="24" stroke="#f59e0b" stroke-width="3"/>
            <path d="M26 14v16" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
            <circle cx="26" cy="37" r="2.5" fill="#f59e0b"/>
          </svg>
        </div>`;
    } else if (icon === "error") {
      iconSvg = `
        <div class="swal-icon swal-icon--error">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="24" stroke="#ef4444" stroke-width="3"/>
            <path d="M16 16l20 20M36 16L16 36" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>`;
    } else if (icon === "success") {
      iconSvg = `
        <div class="swal-icon swal-icon--success">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="24" stroke="#10b981" stroke-width="3"/>
            <path d="M15 27l7 7 15-15" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;
    } else if (icon === "question") {
      iconSvg = `
        <div class="swal-icon swal-icon--question">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="24" stroke="#6366f1" stroke-width="3"/>
            <path d="M20 20c0-3.3 2.7-6 6-6s6 2.7 6 6c0 3-4 4.5-4 7v2" stroke="#6366f1" stroke-width="3" stroke-linecap="round"/>
            <circle cx="26" cy="37" r="2.5" fill="#6366f1"/>
          </svg>
        </div>`;
    } else {
      iconSvg = `
        <div class="swal-icon swal-icon--info">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="24" stroke="#3b82f6" stroke-width="3"/>
            <path d="M26 24v12" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
            <circle cx="26" cy="17" r="2.5" fill="#3b82f6"/>
          </svg>
        </div>`;
    }

    modal.innerHTML = `
      ${iconSvg}
      <h3 class="swal-title">${title}</h3>
      ${text ? `<p class="swal-text">${text}</p>` : ""}
      <div class="swal-footer">
        ${
          showCancelButton
            ? `<button type="button" class="swal-btn swal-btn--cancel" id="swal-btn-cancel">${cancelButtonText}</button>`
            : ""
        }
        <button type="button" class="swal-btn ${
          dangerMode ? "swal-btn--danger" : "swal-btn--confirm"
        }" id="swal-btn-confirm">${confirmButtonText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger open animation
    requestAnimationFrame(() => {
      overlay.classList.add("swal-overlay--show");
    });

    const cleanup = (confirmed: boolean) => {
      overlay.classList.remove("swal-overlay--show");
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve({ isConfirmed: confirmed, isDismissed: !confirmed });
      }, 180);
    };

    const confirmBtn = modal.querySelector("#swal-btn-confirm");
    const cancelBtn = modal.querySelector("#swal-btn-cancel");

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => cleanup(true));
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => cleanup(false));
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleKeyDown);
        cleanup(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
  });
}

export const Swal = {
  fire: fireSwal,
  confirm: (title: string, text?: string, confirmButtonText = "Delete") =>
    fireSwal({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText,
      dangerMode: true,
    }),
  logout: (title = "Sign out?", text = "Are you sure you want to end your current session?") =>
    fireSwal({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Sign out",
      cancelButtonText: "Stay logged in",
      dangerMode: false,
    }),
};
