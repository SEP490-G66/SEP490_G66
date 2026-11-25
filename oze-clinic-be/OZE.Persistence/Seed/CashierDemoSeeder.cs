using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OZE.Application.Helpers;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Seed
{
    // TEMPORARY demo data for the cashier pages (Development only): the 9 patients of the FE mock (utils/data/mockCashier.jsx)
    // with their plans, sessions, walk-in visits and receipts, so every status of the pages can be seen on a real database.
    // Only adds rows (patients BNTN01..BNTN09); runs once. Dates count from the day it runs.
    public static class CashierDemoSeeder
    {
        private const string CodePrefix = "BNTN";

        private record PatientRow(int Key, string Name, string Phone, string Gender);
        private record StageRow(string Name, int Day, decimal Plan, decimal Extra, bool Finished);
        private record PlanRow(int Key, int Patient, string Name, string? Option, StageRow[] Stages);
        private record ServiceRow(string Code, string Name, decimal Price);
        private record VisitRow(int Key, int Patient, int Day, string Time, ServiceRow[] Services);
        private record LineRow(string Kind, int? Plan = null, int? Stage = null, int? Visit = null, decimal Amount = 0);
        private record ReceiptRow(int Key, int Patient, int Day, string Time, string Method, string Status, LineRow[] Lines);

        private static readonly PatientRow[] Patients =
        {
            new(1, "Nguyễn Minh Anh", "+84909000001", "Female"),
            new(2, "Trần Quốc Bảo", "+84909000002", "Male"),
            new(3, "Lê Thu Hà", "+84909000003", "Female"),
            new(4, "Phạm Gia Huy", "+84909000004", "Male"),
            new(5, "Hoàng Thị Mai", "+84909000005", "Female"),
            new(6, "Đỗ Văn Nam", "+84909000006", "Male"),
            new(7, "Vũ Thanh Tâm", "+84909000007", "Male"),
            new(8, "Bùi Ngọc Lan", "+84909000008", "Female"),
            new(9, "Phan Minh Khoa", "+84909000009", "Male"),
        };

        // Stage keys are the period ids of the FE mock (1..18), in order
        private static readonly PlanRow[] Plans =
        {
            // Theo đợt, buổi hôm nay đã xong, chưa thu
            new(101, 1, "Cấy ghép Implant răng 36", CashierConstants.Option.Periods, new[]
            {
                new StageRow("Cắm trụ Implant", 0, 4000000, 0, true),
                new StageRow("Gắn abutment", 14, 14000000, 0, false),
                new StageRow("Lắp mão sứ", 75, 6000000, 0, false),
            }),
            // Đặt cọc, nộp thiếu cọc, đợt 1 có phát sinh, đợt 2 xong hôm nay
            new(102, 2, "Niềng răng mắc cài kim loại", CashierConstants.Option.Deposit, new[]
            {
                new StageRow("Gắn mắc cài", -5, 6000000, 500000, true),
                new StageRow("Siết dây lần 1", 0, 8000000, 0, true),
                new StageRow("Siết dây lần 2", 40, 16000000, 0, false),
            }),
            // Chưa chọn phương án, buổi đầu đã xong
            new(103, 3, "Bọc răng sứ 11, 21", null, new[]
            {
                new StageRow("Mài răng, lấy dấu", 0, 5000000, 0, true),
                new StageRow("Gắn răng sứ", 10, 7000000, 0, false),
            }),
            // Toàn bộ, đã thu một phần, đợt 1 có phát sinh
            new(104, 4, "Điều trị tủy và phục hình răng 46", CashierConstants.Option.Full, new[]
            {
                new StageRow("Điều trị tủy", -3, 4000000, 600000, true),
                new StageRow("Bọc mão sứ", 7, 4000000, 0, false),
            }),
            // Đặt cọc đủ, cọc trừ hết vào phát sinh của đợt 1
            new(106, 6, "Phục hình hàm tháo lắp", CashierConstants.Option.Deposit, new[]
            {
                new StageRow("Lấy dấu hàm", -10, 1000000, 3000000, true),
                new StageRow("Thử hàm", 0, 2000000, 0, true),
                new StageRow("Giao hàm", 20, 7000000, 0, false),
            }),
            // Theo đợt, đợt 2 đang chờ xác nhận chuyển khoản
            new(107, 7, "Trám và điều trị nha chu", CashierConstants.Option.Periods, new[]
            {
                new StageRow("Cạo vôi, xử lý túi nha chu", -20, 3000000, 0, true),
                new StageRow("Trám răng", -1, 3000000, 0, true),
            }),
            // Đặt cọc, các đợt đã trả bằng tiền, cọc thừa cần hoàn
            new(108, 8, "Tẩy trắng và trám thẩm mỹ", CashierConstants.Option.Deposit, new[]
            {
                new StageRow("Tẩy trắng", -30, 2000000, 0, true),
                new StageRow("Trám thẩm mỹ", -2, 3000000, 0, true),
            }),
            // Đã thanh toán hết
            new(109, 9, "Nhổ răng khôn 38", CashierConstants.Option.Periods, new[]
            {
                new StageRow("Nhổ răng khôn", -6, 2000000, 0, true),
            }),
        };

        private static readonly VisitRow[] Visits =
        {
            // Cùng ngày với đợt 1 của kế hoạch Implant, khác lượt
            new(201, 1, 0, "09:30", new[] { new ServiceRow("DV007", "Chụp X-quang toàn cảnh", 400000) }),
            // Không khám hôm nay, còn nợ 300.000 (đã thu 300.000)
            new(202, 5, -2, "14:00", new[] { new ServiceRow("DV002", "Lấy cao răng, đánh bóng", 500000), new ServiceRow("DV001", "Khám tổng quát", 100000) }),
        };

        private static readonly ReceiptRow[] Receipts =
        {
            new(301, 2, -6, "10:15", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Deposit, Plan: 102, Amount: 5000000) }),
            new(302, 4, -12, "09:05", PaymentConstants.BankTransfer, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Full, Plan: 104, Amount: 5000000) }),
            new(303, 5, -2, "14:40", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.VisitService, Visit: 202, Amount: 300000) }),
            new(304, 6, -12, "08:30", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Deposit, Plan: 106, Amount: 3000000) }),
            new(305, 7, -20, "16:00", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Period, Plan: 107, Stage: 1, Amount: 3000000) }),
            new(306, 7, -1, "11:20", PaymentConstants.BankTransfer, PaymentConstants.Pending, new[] { new LineRow(CashierConstants.LineKind.Period, Plan: 107, Stage: 2, Amount: 3000000) }),
            new(307, 8, -30, "15:00", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Period, Plan: 108, Stage: 1, Amount: 2000000) }),
            new(308, 8, -25, "09:40", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Deposit, Plan: 108, Amount: 1500000) }),
            new(309, 8, -2, "10:00", PaymentConstants.QrTransfer, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Period, Plan: 108, Stage: 2, Amount: 3000000) }),
            new(310, 9, -6, "17:10", PaymentConstants.Cash, PaymentConstants.Confirmed, new[] { new LineRow(CashierConstants.LineKind.Period, Plan: 109, Stage: 1, Amount: 2000000) }),
        };

        public static async Task SeedAsync(IServiceProvider serviceProvider)
        {
            var logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("CashierDemoSeeder");
            var db = serviceProvider.GetRequiredService<AppIdentityDbContext>();

            if (await db.Patients.AnyAsync(p => p.PatientCode.StartsWith(CodePrefix)))
            {
                logger.LogInformation("Cashier demo data already seeded, skipped.");
                return;
            }

            var doctor = await StaffOfRoleAsync(db, RoleConstants.DoctorRole);
            var cashier = await StaffOfRoleAsync(db, RoleConstants.ReceptionistRole);
            var codes = Visits.SelectMany(v => v.Services).Select(x => x.Code).Distinct().ToList();
            var services = await db.Services.Where(s => codes.Contains(s.ServiceCode)).ToListAsync();
            if (doctor == null || cashier == null || services.Count == 0)
            {
                logger.LogWarning("Cashier demo data skipped: needs a doctor, a receptionist and services DV001/DV002/DV007.");
                return;
            }

            var offset = TimeSpan.FromHours(ClinicTimeConstants.UtcOffsetHours);
            var today = DateOnly.FromDateTime(DateTime.UtcNow.Add(offset));
            DateTimeOffset At(int day, string time) => new(today.AddDays(day).ToDateTime(TimeOnly.ParseExact(time, "HH:mm")), offset);

            Appointment NewAppointment(Patient patient, int day, string time, string status)
            {
                var start = TimeOnly.ParseExact(time, "HH:mm");
                var done = status == AppointmentConstants.CompletedStatus;
                var appointment = new Appointment
                {
                    Patient = patient,
                    Doctor = doctor,
                    AppointmentType = AppointmentConstants.BookedType,
                    AppointmentDate = today.AddDays(day),
                    TimeSlotStart = start,
                    TimeSlotEnd = start.AddMinutes(30),
                    Status = status,
                    CheckInAt = done ? At(day, time).AddMinutes(-10) : null,
                    Notes = "Dữ liệu mẫu thu ngân",
                    CreatedAt = At(day - 3, "20:00"),
                    UpdatedAt = done ? At(day, time).AddMinutes(40) : null
                };
                db.Appointments.Add(appointment);
                return appointment;
            }

            await using var transaction = await db.Database.BeginTransactionAsync();

            var patients = new Dictionary<int, Patient>();
            foreach (var row in Patients)
            {
                var patient = new Patient
                {
                    PatientCode = $"{CodePrefix}{row.Key:D2}",
                    FullName = row.Name,
                    Gender = row.Gender,
                    PhoneNumber = row.Phone,
                    Notes = "Dữ liệu mẫu thu ngân",
                    CreatedAt = At(-60, "09:00")
                };
                db.Patients.Add(patient);
                patients[row.Key] = patient;
            }

            var plans = new Dictionary<int, (TreatmentPlan Plan, List<TreatmentPlanStage> Stages, Invoice? Invoice)>();
            foreach (var row in Plans)
            {
                var patient = patients[row.Patient];
                var first = row.Stages[0];
                var firstVisit = NewAppointment(patient, first.Day, "08:30", AppointmentConstants.CompletedStatus);
                var exam = new Examination
                {
                    Appointment = firstVisit,
                    Patient = patient,
                    Doctor = doctor,
                    ChiefComplaint = row.Name,
                    ExaminationStatus = ExaminationConstants.Completed,
                    CreatedAt = At(first.Day, "08:30")
                };
                db.Examinations.Add(exam);

                var allDone = row.Stages.All(s => s.Finished);
                var plan = new TreatmentPlan
                {
                    Examination = exam,
                    Patient = patient,
                    CreatedByDoctor = doctor,
                    PlanName = row.Name,
                    TotalStages = row.Stages.Length,
                    EstimatedTotalCost = row.Stages.Sum(s => s.Plan),
                    Status = allDone ? TreatmentPlanConstants.Completed : TreatmentPlanConstants.InProgress,
                    ApprovedAt = At(first.Day, "08:50"),
                    PaymentOption = row.Option,
                    DepositRate = row.Option == CashierConstants.Option.Deposit ? CashierConstants.DefaultDepositRatePercent : null,
                    PaymentOptionChosenAt = row.Option == null ? null : At(first.Day, "09:00"),
                    PaymentOptionChosenByUserId = row.Option == null ? null : cashier.UserId,
                    CreatedAt = At(first.Day, "08:45")
                };

                var stages = new List<TreatmentPlanStage>();
                foreach (var (stageRow, index) in row.Stages.Select((s, i) => (s, i)))
                {
                    var visit = !stageRow.Finished ? null
                        : index == 0 ? firstVisit
                        : NewAppointment(patient, stageRow.Day, "08:30", AppointmentConstants.CompletedStatus);
                    var stage = new TreatmentPlanStage
                    {
                        StageNumber = index + 1,
                        StageName = stageRow.Name,
                        EstimatedCost = stageRow.Plan,
                        ActualCost = stageRow.Finished ? stageRow.Plan + stageRow.Extra : null,
                        StageStatus = stageRow.Finished ? TreatmentPlanConstants.StageStatus.Completed : TreatmentPlanConstants.StageStatus.Scheduled,
                        ScheduledDate = today.AddDays(stageRow.Day),
                        ActualDate = stageRow.Finished ? today.AddDays(stageRow.Day) : null,
                        PerformedByDoctor = stageRow.Finished ? doctor : null,
                        Appointment = visit,
                        CreatedAt = plan.CreatedAt
                    };
                    plan.Stages.Add(stage);
                    stages.Add(stage);
                }
                db.TreatmentPlans.Add(plan);

                // A plan with a payment option has its invoice, one line per session (as CashierService makes it)
                Invoice? invoice = null;
                if (row.Option != null)
                {
                    invoice = new Invoice
                    {
                        InvoiceNumber = $"HD-TN-{row.Key}",
                        Patient = patient,
                        TreatmentPlan = plan,
                        PaymentStatus = InvoiceConstants.Unpaid,
                        Notes = "Hóa đơn kế hoạch điều trị (dữ liệu mẫu thu ngân)",
                        CreatedAt = At(first.Day, "09:00"),
                        CreatedByUserId = cashier.UserId
                    };
                    foreach (var (stage, index) in stages.Select((s, i) => (s, i)))
                    {
                        var amount = stage.EstimatedCost + Math.Max(0m, (stage.ActualCost ?? stage.EstimatedCost) - stage.EstimatedCost);
                        invoice.Items.Add(new InvoiceItem
                        {
                            TreatmentPlanStage = stage,
                            ServiceName = stage.StageName ?? $"Đợt {stage.StageNumber}",
                            Description = $"Đợt {stage.StageNumber}",
                            UnitPrice = amount,
                            Quantity = 1,
                            Amount = amount,
                            SortOrder = index
                        });
                    }
                    invoice.TotalAmount = invoice.Items.Sum(i => i.Amount);
                    invoice.FinalAmount = invoice.TotalAmount;
                    db.Invoices.Add(invoice);
                }
                plans[row.Key] = (plan, stages, invoice);
            }

            var visits = new Dictionary<int, Invoice?>();
            foreach (var row in Visits)
            {
                var patient = patients[row.Patient];
                var appointment = NewAppointment(patient, row.Day, row.Time, AppointmentConstants.CompletedStatus);
                foreach (var item in row.Services)
                {
                    var service = services.First(s => s.ServiceCode == item.Code);
                    appointment.ServiceItems.Add(new AppointmentServiceItem { Service = service, DurationMinutes = 15, PriceAtBooking = item.Price, CreatedAt = appointment.CreatedAt });
                }

                // Visit 201 (today) has no invoice yet: the first collection creates it
                Invoice? invoice = null;
                if (Receipts.Any(r => r.Lines.Any(l => l.Visit == row.Key)))
                {
                    invoice = new Invoice
                    {
                        InvoiceNumber = $"HD-TN-{row.Key}",
                        Appointment = appointment,
                        Patient = patient,
                        PaymentStatus = InvoiceConstants.Unpaid,
                        CreatedAt = At(row.Day, row.Time).AddMinutes(30),
                        CreatedByUserId = cashier.UserId
                    };
                    foreach (var (item, index) in row.Services.Select((s, i) => (s, i)))
                    {
                        invoice.Items.Add(new InvoiceItem
                        {
                            Service = services.First(s => s.ServiceCode == item.Code),
                            ServiceName = item.Name,
                            UnitPrice = item.Price,
                            Quantity = 1,
                            Amount = item.Price,
                            SortOrder = index
                        });
                    }
                    invoice.TotalAmount = invoice.Items.Sum(i => i.Amount);
                    invoice.FinalAmount = invoice.TotalAmount;
                    db.Invoices.Add(invoice);
                }
                visits[row.Key] = invoice;
            }

            foreach (var row in Receipts)
            {
                var createdAt = At(row.Day, row.Time);
                var code = $"{CashierConstants.ReceiptCodePrefix}-{today.AddDays(row.Day):yyMMdd}-900{row.Key}";
                var confirmed = row.Status == PaymentConstants.Confirmed;
                foreach (var (line, index) in row.Lines.Select((l, i) => (l, i)))
                {
                    var invoice = line.Visit is int visitKey ? visits[visitKey]! : plans[line.Plan!.Value].Invoice!;
                    invoice.Payments.Add(new Payment
                    {
                        Amount = line.Amount,
                        PaymentMethod = row.Method,
                        PaymentStatus = row.Status,
                        Purpose = line.Kind == CashierConstants.LineKind.Deposit ? PaymentConstants.PurposeDeposit : PaymentConstants.PurposeRegular,
                        TreatmentPlanStage = line.Stage is int stage ? plans[line.Plan!.Value].Stages[stage - 1] : null,
                        ReceiptCode = code,
                        TransactionReference = index == 0 && row.Method != PaymentConstants.Cash ? $"DEMO-FT{row.Key}0000" : null,
                        CreatedByUserId = cashier.UserId,
                        CreatedAt = createdAt,
                        PaidAt = confirmed ? createdAt : null,
                        ConfirmedByUserId = confirmed ? cashier.UserId : null
                    });
                }
            }

            foreach (var invoice in plans.Values.Select(p => p.Invoice).Concat(visits.Values).Where(i => i != null))
            {
                InvoiceMoneyHelper.Recalculate(invoice!);
            }

            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            logger.LogInformation("Cashier demo data seeded for {Today}: {Patients} patients, {Plans} plans, {Receipts} receipts.",
                today, Patients.Length, Plans.Length, Receipts.Length);
        }

        private static Task<StaffProfile?> StaffOfRoleAsync(AppIdentityDbContext db, string role)
        {
            return db.StaffProfiles
                .Where(s => db.UserRoles.Any(ur => ur.UserId == s.UserId && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == role)))
                .OrderBy(s => s.Id)
                .FirstOrDefaultAsync();
        }
    }
}
