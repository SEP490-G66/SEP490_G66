import { Link } from "react-router-dom";

const DoctorCompactCard = ({ doctor, to }) => (
    <Link to={to} className="card-public card-hover group flex items-center gap-4 overflow-hidden p-0">
        <span className="flex w-24 shrink-0 items-end self-stretch bg-primary-soft sm:w-28">
            <img src={doctor.imageUrl} alt="" loading="lazy" className="aspect-2/3 w-full object-contain object-bottom" />
        </span>
        <span className="flex min-w-0 flex-col gap-1 py-4 pr-4">
            <span className="card-title transition-colors group-hover:text-primary">{`${doctor.displayTitle} ${doctor.fullName}`}</span>
            <span className="text-body-sm text-body">{doctor.position}</span>
        </span>
    </Link>
);

export default DoctorCompactCard;
