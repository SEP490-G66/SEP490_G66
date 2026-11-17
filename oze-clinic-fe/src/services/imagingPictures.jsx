import api from "./api";

// Stored pictures (GET api/imaging-results/{id}/file) need the sign-in token, so they are fetched as a blob
// and shown through an object URL. image: { fileUrl, ... }; sample pictures (fileUrl null) have no file:
// the viewer shows its placeholder.
export const loadPicture = async (image) => {
    if (!image.fileUrl) return { ...image };
    try {
        const response = await api.get(image.fileUrl, { responseType: "blob" });
        return { ...image, url: URL.createObjectURL(response.data) };
    } catch {
        return { ...image };
    }
};

export const loadPictures = (images = []) => Promise.all(images.map(loadPicture));

// Frees the object URLs made by loadPicture.
export const releasePictures = (images = []) => {
    images.forEach((image) => image?.url?.startsWith("blob:") && URL.revokeObjectURL(image.url));
};
