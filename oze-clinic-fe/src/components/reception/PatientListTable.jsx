import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { dmy } from "./receptionUtils";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { ageOf, genderOf, phoneDisplay } from "@/utils/patientRecord";
import { RECEPTION_PATIENT_CREATE_ROUTE, getReceptionPatientRoute } from "@/utils/routes";

const SKELETON_ROWS = [1, 2, 3, 4, 5];
const C = TEXT.COLUMNS;

const PatientListTable = ({ status, data, today, filtered, onRetry, onClearAll, onPage, pager, linkState }) => {
    const items = data?.items ?? [];
    const loading = status === "loading";
    return (
        <div aria-busy={loading ? "true" : undefined}>
            {status === "error" ? (
                <div role="alert" className="alert alert-danger mx-5 mb-4 flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.LIST_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={onRetry}>
                        {TEXT.RETRY}
                    </button>
                </div>
            ) : !loading && items.length === 0 ? (
                <div className="empty-state">
                    <p className="empty-state-text">{filtered ? TEXT.NO_MATCH : TEXT.EMPTY}</p>
                    <div className="mt-4">
                        {filtered ? (
                            <button type="button" className="btn btn-secondary" onClick={onClearAll}>
                                {TEXT.CLEAR_FILTERS}
                            </button>
                        ) : (
                            <Link to={RECEPTION_PATIENT_CREATE_ROUTE} state={linkState} className="btn btn-primary">
                                <UserPlus className="size-4" aria-hidden="true" /> {TEXT.CREATE}
                            </Link>
                        )}
                    </div>
                </div>
            ) : (
                <div className="table-wrap rounded-none border-x-0">
                    <table className="table table-stack">
                        <thead>
                            <tr>
                                <th>{C.CODE}</th>
                                <th>{C.NAME}</th>
                                <th>{C.PHONE}</th>
                                <th>{C.GENDER}</th>
                                <th>{C.DOB}</th>
                                <th>{C.AGE}</th>
                                <th>{C.ADDRESS}</th>
                                <th className="text-right">
                                    <span className="sr-only">{C.ACTIONS}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? SKELETON_ROWS.map((row) => (
                                      <tr key={row}>
                                          <td colSpan={8}>
                                              <span className="skeleton block h-5 w-full" />
                                          </td>
                                      </tr>
                                  ))
                                : items.map((p) => {
                                      const age = ageOf(p.dateOfBirth, today);
                                      return (
                                          <tr key={p.id}>
                                              <td data-label={C.CODE} className="num whitespace-nowrap">
                                                  {p.patientCode}
                                              </td>
                                              <td data-primary className="cell-primary font-semibold">
                                                  {p.fullName}
                                              </td>
                                              <td data-label={C.PHONE} className="num">
                                                  {p.phoneNumber ? phoneDisplay(p.phoneNumber) : TEXT.DASH}
                                              </td>
                                              <td data-label={C.GENDER}>{genderOf(p.gender).label}</td>
                                              <td data-label={C.DOB} className="num">
                                                  {p.dateOfBirth ? dmy(String(p.dateOfBirth).slice(0, 10)) : TEXT.DASH}
                                              </td>
                                              <td data-label={C.AGE} className="num">
                                                  {age == null ? TEXT.DASH : age}
                                              </td>
                                              <td data-label={C.ADDRESS} className="max-w-56">
                                                  <span className="block truncate" title={p.address || undefined}>
                                                      {p.address || TEXT.DASH}
                                                  </span>
                                              </td>
                                              <td data-actions className="text-right">
                                                  <Link to={getReceptionPatientRoute(p.id)} state={linkState} className="btn btn-secondary h-9 w-full sm:w-auto">
                                                      {TEXT.VIEW}
                                                  </Link>
                                              </td>
                                          </tr>
                                      );
                                  })}
                        </tbody>
                    </table>
                </div>
            )}
            {pager && pager.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-3">
                    <Pagination page={pager.page} totalPages={pager.totalPages} onChange={onPage} busy={loading} label={TEXT.TITLE} />
                </div>
            )}
        </div>
    );
};

export default PatientListTable;
