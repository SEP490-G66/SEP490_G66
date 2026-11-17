import { cx } from "@/utils/cx";

const DoctorPortraitCard = ({ doctor, selected, onSelect }) => {
    return (
        <button
            type="button"
            aria-pressed={selected}
            aria-label={`${doctor.displayTitle} ${doctor.fullName}`}
            onClick={() => onSelect(doctor.id)}
            className={cx(
                "block w-full cursor-pointer overflow-hidden rounded-xl bg-primary-soft shadow-md",
                selected && "ring-2 ring-primary",
            )}
        >
            <img src={doctor.imageUrl} alt="" loading="lazy" className="aspect-3/4 w-full object-cover object-top" />
        </button>
    );
};

export default DoctorPortraitCard;
