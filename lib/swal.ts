"use client";
export type SwalIcon = "warning" | "error" | "success" | "info" | "question";
export type SwalOptions = { title: string; text?: string; icon?: SwalIcon; showCancelButton?: boolean; confirmButtonText?: string; cancelButtonText?: string; confirmButtonColor?: string; dangerMode?: boolean; input?: "textarea"; inputValue?: string; inputPlaceholder?: string };
export type SwalResult = { isConfirmed: boolean; isDismissed: boolean; value?: string };
let queue: Promise<unknown> = Promise.resolve();
export function fireSwal(options: SwalOptions): Promise<SwalResult> {
  const task = queue.then(() => new Promise<SwalResult>((resolve) => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const modal = document.createElement("dialog");
    modal.className = `swal-modal swal-dialog swal-${options.icon || "info"}`;
    modal.setAttribute("aria-labelledby", "swal-title");
    modal.setAttribute("aria-describedby", "swal-description");
    const icon = document.createElement("div"); icon.className = "swal-symbol"; icon.setAttribute("aria-hidden", "true");
    icon.textContent = { success: "\u2713", error: "\u00d7", info: "i", warning: "!", question: "?" }[options.icon || "info"];
    const title = document.createElement("h2"); title.id = "swal-title"; title.className = "swal-title"; title.textContent = options.title;
    const description = document.createElement("p"); description.id = "swal-description"; description.className = "swal-text"; description.textContent = options.text || "";
    modal.append(icon, title, description);
    let input: HTMLTextAreaElement | undefined;
    if (options.input) {
      input = document.createElement("textarea"); input.className = "swal-input"; input.maxLength = 1000;
      input.placeholder = options.inputPlaceholder || "Enter the reason for this decision";
      input.setAttribute("aria-label", "Reason"); input.value = options.inputValue || ""; modal.append(input);
    }
    const footer = document.createElement("div"); footer.className = "swal-footer";
    let finished = false;
    const close = (confirmed: boolean) => {
      if (finished) return;
      if (confirmed && input && !input.value.trim()) { input.setCustomValidity("Please provide a reason."); input.reportValidity(); return; }
      finished = true;
      const value = input?.value.trim(); modal.close(); modal.remove(); previousFocus?.focus();
      resolve({ isConfirmed: confirmed, isDismissed: !confirmed, value });
    };
    if (options.showCancelButton) {
      const cancel = document.createElement("button"); cancel.className = "swal-btn swal-btn--cancel";
      cancel.textContent = options.cancelButtonText || "Cancel"; cancel.onclick = () => close(false); footer.append(cancel);
    }
    const confirm = document.createElement("button"); confirm.className = `swal-btn ${options.dangerMode ? "swal-btn--danger" : "swal-btn--confirm"}`;
    confirm.textContent = options.confirmButtonText || "OK"; confirm.onclick = () => close(true); footer.append(confirm);
    input?.addEventListener("input", () => input?.setCustomValidity(""));
    modal.append(footer); modal.addEventListener("cancel", event => { event.preventDefault(); close(false); });
    document.body.append(modal); modal.showModal();
    (input || (options.dangerMode ? footer.querySelector<HTMLButtonElement>("button") : confirm))?.focus();
  }));
  queue = task.catch(() => undefined);
  return task;
}
export function notify(message: string, icon?: SwalIcon) {
  const kind = icon || (/failed|could not|cannot|error|invalid|required|unable/i.test(message) ? "error" : /saved|updated|created|deleted|copied|sent|published|success|removed|approved/i.test(message) ? "success" : "info");
  return fireSwal({ title: kind === "error" ? "Please check" : kind === "success" ? "Success" : "Information", text: message, icon: kind });
}
export const Swal = {
  fire: fireSwal,
  confirm: (title: string, text?: string, confirmButtonText = "Delete") => fireSwal({ title, text, icon: "warning", showCancelButton: true, confirmButtonText, dangerMode: true }),
  logout: (title = "Sign out?", text = "Are you sure you want to end your current session?") => fireSwal({ title, text, icon: "question", showCancelButton: true, confirmButtonText: "Sign out", cancelButtonText: "Stay logged in" }),
};
