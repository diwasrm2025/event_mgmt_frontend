export type PaymentProofArchiveEntry = {
  bookingId: string;
  name: string;
  transactionId: string | null;
  proof: Blob;
};

function safeFileNamePart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
}

function imageExtension(contentType: string) {
  switch (contentType.split(";")[0].toLowerCase()) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
    default: return "img";
  }
}

export function paymentProofFileName(name: string, transactionId: string | null, bookingId: string, contentType: string) {
  const safeName = safeFileNamePart(name) || "attendee";
  const safeTransactionId = safeFileNamePart(transactionId || bookingId) || "no-transaction-id";
  return `${safeName}-${safeTransactionId}.${imageExtension(contentType)}`;
}

export async function buildPaymentProofArchive(entries: PaymentProofArchiveEntry[]) {
  if (!entries.length) throw new Error("There are no pending QR payment screenshots to download.");

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const entry of entries) {
    if (!entry.proof.size || !entry.proof.type.startsWith("image/")) {
      throw new Error(`The screenshot for ${entry.name} is empty or invalid.`);
    }

    let filename = paymentProofFileName(entry.name, entry.transactionId, entry.bookingId, entry.proof.type);
    if (usedNames.has(filename)) {
      const extension = filename.split(".").pop() || "img";
      const stem = filename.slice(0, -(extension.length + 1));
      filename = `${stem}-${safeFileNamePart(entry.bookingId) || "booking"}.${extension}`;
      let suffix = 2;
      while (usedNames.has(filename)) {
        filename = `${stem}-${safeFileNamePart(entry.bookingId) || "booking"}-${suffix}.${extension}`;
        suffix += 1;
      }
    }
    usedNames.add(filename);
    zip.file(filename, new Uint8Array(await entry.proof.arrayBuffer()));
  }

  return zip.generateAsync({ type: "arraybuffer" });
}
