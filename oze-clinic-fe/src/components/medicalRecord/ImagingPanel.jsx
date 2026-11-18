import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { loadPicture, releasePictures } from "@/services/imagingPictures";
import { displayText } from "@/utils/medicalRecord";
import { MEDICAL_RECORD_FILM_STATUS, MEDICAL_RECORD_TEXT as TEXT } from "@/utils/messages";
import RecordStatusBadge from "./RecordStatusBadge";

const ToothIcon = () => (
    <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7.5 3.5c-2.5 0-4 2-4 4.5 0 3 1.2 4.5 2 7.5.6 2.4 1 5 2.3 5 1.6 0 1.6-4.5 4.2-4.5s2.6 4.5 4.2 4.5c1.3 0 1.7-2.6 2.3-5 .8-3 2-4.5 2-7.5 0-2.5-1.5-4.5-4-4.5-1.8 0-2.7 1-4.5 1s-2.7-1-4.5-1Z" />
    </svg>
);

const FilmPicture = ({ film }) => {
    const [picture, setPicture] = useState({ key: null, url: null });
    const loaded = picture.key === film.fileUrl;

    useEffect(() => {
        let active = true;
        let current = null;
        loadPicture({ fileUrl: film.fileUrl }).then((result) => {
            current = result;
            if (active) setPicture({ key: film.fileUrl, url: result.url ?? null });
            else releasePictures([result]);
        });
        return () => {
            active = false;
            if (current) releasePictures([current]);
        };
    }, [film.fileUrl]);

    if (loaded && picture.url) {
        return (
            <a href={picture.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg bg-surface-navy">
                <img src={picture.url} alt={`${displayText(film.type)} ${displayText(film.area)}`} className="h-55 w-full object-contain" />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-canvas/90 px-2 py-1 text-caption font-medium text-ink">
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    {TEXT.FILM_OPEN}
                </span>
            </a>
        );
    }
    return (
        <div className="flex h-55 flex-col items-center justify-center gap-2 rounded-lg bg-surface-navy text-caption text-on-navy-soft">
            <ToothIcon />
            <span>{loaded ? TEXT.FILM_FAILED : TEXT.FILM_LOADING}</span>
        </div>
    );
};

const FilmCard = ({ film }) => (
    <section className="card-app p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
                <h2 className="card-title">{[film.type, film.area].filter(Boolean).join(" · ") || "—"}</h2>
                <p className="num text-caption text-muted">{[film.date, film.doctor].filter(Boolean).join(" · ")}</p>
            </div>
            <RecordStatusBadge status={film.status} labels={MEDICAL_RECORD_FILM_STATUS} />
        </div>
        <div className="p-5">
            <FilmPicture film={film} />
            <dl className="mt-3.5 flex gap-2.5 text-body-sm">
                <dt className="w-24 shrink-0 text-muted sm:w-30">{TEXT.FILM_RESULT}</dt>
                <dd className="min-w-0 font-medium text-ink">{film.result || "—"}</dd>
            </dl>
        </div>
    </section>
);

const ImagingPanel = ({ films }) => (
    <div className="@container">
        <div className="grid gap-4 @3xl:grid-cols-2">
            {films.map((film, index) => (
                <FilmCard key={film.id ?? index} film={film} />
            ))}
        </div>
    </div>
);

export default ImagingPanel;
