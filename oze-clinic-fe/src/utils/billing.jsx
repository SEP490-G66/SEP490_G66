export const COLLECTABLE = ["UNPAID", "PARTIALLY_PAID"];

export const visitItems = (appointment) =>
    (appointment.services ?? []).map((s, index) => ({
        key: `v${index}`,
        serviceId: s.serviceId,
        name: s.variantName ? `${s.serviceName} · ${s.variantName}` : s.serviceName,
        tooth: s.toothPosition ?? null,
        doctor: appointment.doctorName,
        quantity: 1,
        unitPrice: Number(s.priceAtBooking ?? s.price ?? 0),
        sortOrder: index + 1,
    }));

export const invoiceItems = (invoice) =>
    (invoice.items ?? []).map((item) => ({
        key: `i${item.id}`,
        name: item.description ? `${item.serviceName} · ${item.description}` : item.serviceName,
        tooth: item.toothPosition ?? null,
        doctor: item.doctorName ?? invoice.doctorName ?? null,
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
        amount: Number(item.amount ?? Number(item.unitPrice ?? 0) * Number(item.quantity ?? 1)),
    }));

export const lineTotal = (item) => item.amount ?? item.unitPrice * item.quantity;

export const queueOf = (visits, invoices) => [
    ...visits.map((a) => ({
        key: `v${a.id}`,
        kind: "visit",
        id: a.id,
        name: a.patientName,
        status: null,
        amount: visitItems(a).reduce((sum, item) => sum + lineTotal(item), 0),
        at: a.appointmentDate,
    })),
    ...invoices
        .filter((i) => COLLECTABLE.includes(i.paymentStatus))
        .map((i) => ({ key: `i${i.id}`, kind: "invoice", id: i.id, name: i.patientName, status: i.paymentStatus, amount: Number(i.remainingAmount ?? 0), at: i.createdAt })),
];

export const debtAgeTone = (days) => (days > 30 ? "badge-danger" : days >= 7 ? "badge-warning" : "badge-neutral");
