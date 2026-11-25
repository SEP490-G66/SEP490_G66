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

export const debtAgeTone = (days) => (days > 30 ? "badge-danger" : days >= 7 ? "badge-warning" : "badge-neutral");
