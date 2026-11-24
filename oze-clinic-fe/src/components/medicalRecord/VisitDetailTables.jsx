import DashboardSection from "@/components/dashboard/DashboardSection";
import DataTable from "@/components/ui/DataTable";
import { cx } from "@/utils/cx";

// The three tables of "Chi tiết lần khám" (Figma). Each is a titled card; an empty list shows a short line.
// A status cell takes { label, badge } where badge is a .badge-* class, e.g. { label: "Hoàn thành", badge: "badge-success" }.

const Badge = ({ value }) => (value ? <span className={cx("badge", value.badge)}>{value.label}</span> : null);

const Section = ({ id, title, columns, rows, empty, rowKey }) => (
    <DashboardSection id={id} title={title}>
        <DataTable columns={columns} rows={rows} rowKey={rowKey} labelledBy={id} empty={empty} />
    </DashboardSection>
);

// diagnoses: [{ icdCode, teeth, description }]
export const DiagnosisTable = ({ diagnoses = [] }) => (
    <Section
        id="visit-diagnosis-title"
        title="Chẩn đoán"
        rowKey={(row, index) => `${row.icdCode}-${index}`}
        rows={diagnoses}
        empty="Chưa có chẩn đoán."
        columns={[
            { key: "icdCode", label: "Mã ICD", primary: true, render: (row) => <span className="font-semibold text-ink">{row.icdCode}</span> },
            { key: "teeth", label: "Răng liên quan", render: (row) => row.teeth || "—" },
            { key: "description", label: "Mô tả", block: true },
        ]}
    />
);

// procedures: [{ tooth, content, result: { label, badge } }]
export const TreatmentDoneTable = ({ procedures = [] }) => (
    <Section
        id="visit-procedures-title"
        title="Nội dung điều trị đã thực hiện"
        rowKey={(row, index) => `${row.tooth}-${index}`}
        rows={procedures}
        empty="Chưa có nội dung điều trị."
        columns={[
            { key: "tooth", label: "Răng", render: (row) => <span className="font-semibold text-ink">{row.tooth || "—"}</span> },
            { key: "content", label: "Nội dung", primary: true },
            { key: "result", label: "Kết quả", align: "right", render: (row) => <Badge value={row.result} /> },
        ]}
    />
);

// prescriptions: [{ name, usage, quantity }]
export const PrescriptionTable = ({ prescriptions = [] }) => (
    <Section
        id="visit-prescription-title"
        title="Đơn thuốc"
        rowKey={(row, index) => `${row.name}-${index}`}
        rows={prescriptions}
        empty="Không kê đơn thuốc."
        columns={[
            { key: "name", label: "Thuốc", primary: true, render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
            { key: "usage", label: "Cách dùng", block: true },
            { key: "quantity", label: "Số lượng", align: "right" },
        ]}
    />
);
