import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { PUBLIC_DOCTOR_TEXT as TEXT } from "@/utils/messages";

// Large view of a doctor's certificate pictures, with previous / next. index is the picture shown.
const CertificateViewer = ({ doctorName, images, index, onIndexChange, onClose }) => {
    const image = images[index];
    const last = images.length - 1;
    const go = (target) => onIndexChange((target + images.length) % images.length);

    // ← / → change the picture wherever the focus is in the dialog (Esc is handled by Modal)
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
            if (event.key === "ArrowRight") onIndexChange((index + 1) % images.length);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [index, images.length, onIndexChange]);

    return (
        <Modal title={TEXT.CERTIFICATES_OF(doctorName)} description={TEXT.CERTIFICATE_POSITION(index + 1, images.length)} size="lg" onClose={onClose}>
            <div className="mt-4 flex flex-col gap-4">
                <div className="flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                    {image?.imageUrl ? (
                        <img src={image.imageUrl} alt={image.alt} className="size-full object-contain" />
                    ) : (
                        <ImageIcon className="size-12 text-placeholder" aria-hidden="true" />
                    )}
                </div>
                {last > 0 && (
                    <div className="flex justify-between gap-2">
                        <button type="button" className="btn btn-secondary" onClick={() => go(index - 1)}>
                            <ChevronLeft className="size-4" aria-hidden="true" />
                            {TEXT.PREVIOUS}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => go(index + 1)}>
                            {TEXT.NEXT}
                            <ChevronRight className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CertificateViewer;
