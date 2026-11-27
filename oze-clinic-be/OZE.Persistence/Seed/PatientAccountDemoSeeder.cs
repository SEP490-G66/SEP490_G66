using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Seed
{
    // Demo data for one existing patient account, so every page of the patient's menu has something to show:
    // upcoming visits (one booked for a plan session), past visits with diagnoses, doctor's advice and prescriptions,
    // a treatment plan in progress, documents brought from elsewhere (with real files), doctor's document requests,
    // invoices with payments and a debt, and refund requests.
    // The account is the one whose email is set in DemoPatient:Email (empty = nothing is done). Only adds rows and runs
    // once per patient: the invoices are numbered HD-DM{patientId}-n, so a second run sees them and stops.
    public static class PatientAccountDemoSeeder
    {
        public const string EmailConfigKey = "DemoPatient:Email";

        public static async Task SeedAsync(IServiceProvider serviceProvider)
        {
            var logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("PatientAccountDemoSeeder");
            var email = serviceProvider.GetService<IConfiguration>()?[EmailConfigKey]?.Trim();
            if (string.IsNullOrEmpty(email))
            {
                return;
            }

            var db = serviceProvider.GetRequiredService<AppIdentityDbContext>();
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(email);
            var patient = user == null ? null : await db.Patients.FirstOrDefaultAsync(p => p.UserId == user.Id);
            if (patient == null)
            {
                logger.LogWarning("Patient demo data skipped: no patient account has the email set in {Key}.", EmailConfigKey);
                return;
            }

            var invoicePrefix = $"HD-DM{patient.Id}-";
            if (await db.Invoices.AnyAsync(i => i.InvoiceNumber.StartsWith(invoicePrefix)))
            {
                logger.LogInformation("Patient demo data already seeded for patient {PatientId}, skipped.", patient.Id);
                return;
            }

            var doctors = await StaffOfRoleAsync(db, RoleConstants.DoctorRole, 2);
            var cashier = (await StaffOfRoleAsync(db, RoleConstants.ReceptionistRole, 1)).FirstOrDefault();
            var services = await db.Services
                .Where(s => s.ServiceCode == "DV001" || s.ServiceCode == "DV004" || s.ServiceCode == "DV011" || s.ServiceCode == "DV024")
                .ToDictionaryAsync(s => s.ServiceCode);
            if (doctors.Count == 0 || !services.ContainsKey("DV001"))
            {
                logger.LogWarning("Patient demo data skipped: needs a doctor and the service DV001.");
                return;
            }

            var fileStore = serviceProvider.GetService<IImagingFileStore>();
            var builder = new Builder(db, patient, user!.Id, doctors[0], doctors.Count > 1 ? doctors[1] : doctors[0], cashier, services, invoicePrefix);

            await using var transaction = await db.Database.BeginTransactionAsync();
            builder.Build();
            if (fileStore != null)
            {
                await builder.AddDocumentsAsync(fileStore);
            }
            await db.SaveChangesAsync();

            // The upcoming session visit is linked to its plan stage once both have ids
            builder.LinkPlanSession();
            await db.SaveChangesAsync();
            await transaction.CommitAsync();

            logger.LogInformation("Patient demo data seeded for patient {PatientId}: {Appointments} appointments, {Invoices} invoices.",
                patient.Id, builder.AppointmentCount, builder.InvoiceCount);
        }

        private static Task<List<StaffProfile>> StaffOfRoleAsync(AppIdentityDbContext db, string role, int take)
        {
            return db.StaffProfiles
                .Where(s => db.UserRoles.Any(ur => ur.UserId == s.UserId && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == role)))
                .OrderBy(s => s.Id)
                .Take(take)
                .ToListAsync();
        }

        private sealed class Builder
        {
            private static readonly TimeSpan Offset = TimeSpan.FromHours(ClinicTimeConstants.UtcOffsetHours);

            private readonly AppIdentityDbContext _db;
            private readonly Patient _patient;
            private readonly string _patientUserId;
            private readonly StaffProfile _khoa;
            private readonly StaffProfile _ha;
            private readonly StaffProfile? _cashier;
            private readonly Dictionary<string, Service> _services;
            private readonly string _invoicePrefix;
            private readonly DateOnly _today = DateOnly.FromDateTime(ClinicClock.Today);
            private readonly List<Invoice> _invoices = new();

            private int _appointments;
            private Appointment? _sessionVisit;
            private TreatmentPlanStage? _sessionStage;

            public Builder(AppIdentityDbContext db, Patient patient, string patientUserId, StaffProfile khoa, StaffProfile ha,
                StaffProfile? cashier, Dictionary<string, Service> services, string invoicePrefix)
            {
                _db = db;
                _patient = patient;
                _patientUserId = patientUserId;
                _khoa = khoa;
                _ha = ha;
                _cashier = cashier;
                _services = services;
                _invoicePrefix = invoicePrefix;
            }

            public int AppointmentCount => _appointments;
            public int InvoiceCount => _invoices.Count;

            public void Build()
            {
                // 1. Khám định kỳ, lấy cao răng (đã hoàn tiền một phần)
                var scaling = Visit("scaling", -75, "08:30", _ha, new[] { "DV001", "DV024" }, "Khám định kỳ, chảy máu chân răng khi chải răng",
                    "Chải răng 2 lần/ngày bằng bàn chải lông mềm, dùng chỉ nha khoa mỗi tối. Lấy cao răng lại sau 6 tháng.",
                    new[] { ("K03.6", "Cao răng", (string?)null), ("K05.1", "Viêm lợi mạn tính", null) });
                var scalingInvoice = AddInvoice(scaling, 1, new[] { ("Khám tổng quát", "DV001", 150000m), ("Lấy cao răng, đánh bóng", "DV024", 300000m) },
                    new[] { (-75, 450000m, PaymentConstants.Cash, PaymentConstants.Confirmed) });
                Refund(scalingInvoice, -70, 100000, "Phòng khám tính thừa phí đánh bóng đã có trong gói khám định kỳ.", PaymentConstants.RefundRequestStatus.Processed);

                // 2. Đau răng 46: lập kế hoạch điều trị tủy và bọc sứ, làm buổi 1
                var pulp1 = Visit("pulp1", -40, "09:00", _khoa, new[] { "DV001", "DV024" }, "Đau nhức răng hàm dưới bên phải về đêm",
                    "Tránh nhai bên phải đến buổi sau. Uống thuốc giảm đau khi cần, không quá 3 viên/ngày. Sưng hoặc sốt thì gọi phòng khám.",
                    new[] { ("K04.0", "Viêm tủy răng không hồi phục", (string?)"46") });
                AddPrescription(pulp1, new[] { ("Ibuprofen 400mg", "1 viên", "Khi đau, cách nhau ít nhất 6 giờ", "3 ngày", 6, "Uống sau ăn") });
                var plan = new TreatmentPlan
                {
                    Examination = pulp1.Examination!,
                    Patient = _patient,
                    CreatedByDoctor = _khoa,
                    PlanName = "Điều trị tủy và bọc sứ răng 46",
                    Description = "Lấy tủy, trám bít ống tủy rồi bọc mão sứ để bảo vệ răng 46.",
                    TotalStages = 3,
                    EstimatedTotalCost = 5700000,
                    Status = TreatmentPlanConstants.InProgress,
                    ApprovedAt = At(-40, "09:40"),
                    CreatedAt = At(-40, "09:30")
                };
                var stage1 = Stage(plan, 1, "Lấy tủy, đặt thuốc", 1200000, -40, pulp1, _khoa);
                var stage2 = Stage(plan, 2, "Trám bít ống tủy", 1500000, -26, null, _khoa);
                var stage3 = Stage(plan, 3, "Bọc mão sứ răng 46", 3000000, 6, null, null);
                _db.TreatmentPlans.Add(plan);
                AddInvoice(pulp1, 2, new[] { ("Khám tổng quát", "DV001", 150000m), ("Lấy tủy, đặt thuốc răng 46", "DV024", 1200000m) },
                    new[] { (-40, 1350000m, PaymentConstants.BankTransfer, PaymentConstants.Confirmed) }, plan, new[] { (TreatmentPlanStage?)null, stage1 });

                // 3. Buổi 2: trám bít ống tủy, chụp phim kiểm tra; hẹn buổi 3 (còn nợ một phần)
                var pulp2 = Visit("pulp2", -26, "09:30", _khoa, new[] { "DV024", "DV011" }, "Điều trị tủy răng 46 - buổi 2",
                    "Răng có thể ê nhẹ 1-2 ngày. Không nhai đồ cứng bên phải cho đến khi bọc sứ. Súc miệng nước muối ấm sau ăn.",
                    new[] { ("K04.0", "Viêm tủy răng không hồi phục - đã lấy tủy", (string?)"46") });
                AddPrescription(pulp2, new[]
                {
                    ("Paracetamol 500mg", "1 viên", "3 lần/ngày sau ăn", "3 ngày", 9, (string?)null),
                    ("Nước súc miệng Chlorhexidine 0,12%", "15 ml", "2 lần/ngày sau đánh răng", "7 ngày", 1, (string?)"Súc 30 giây rồi nhổ, không nuốt")
                });
                stage2.Appointment = pulp2;
                stage2.ActualDate = _today.AddDays(-26);
                stage2.StageStatus = TreatmentPlanConstants.StageStatus.Completed;
                stage2.PerformedByDoctor = _khoa;
                stage2.CompletedAt = At(-26, "10:30");
                var pulp2Exam = pulp2.Examination!;
                pulp2Exam.FollowUpDate = _today.AddDays(6);
                pulp2Exam.FollowUpNotes = "Bọc mão sứ răng 46 (buổi 3 của kế hoạch)";
                AddInvoice(pulp2, 3, new[] { ("Trám bít ống tủy răng 46", "DV024", 1500000m), ("Chụp X-quang quanh chóp răng 46", "DV011", 100000m) },
                    new[] { (-26, 1000000m, PaymentConstants.Cash, PaymentConstants.Confirmed) }, plan, new[] { stage2, (TreatmentPlanStage?)null });
                plan.Status = TreatmentPlanConstants.InProgress;

                // 4. Nhổ răng khôn 38 (đang chờ hoàn tiền một phần)
                var wisdom = Visit("wisdom", -12, "14:00", _ha, new[] { "DV001", "DV004" }, "Răng khôn hàm dưới bên trái mọc lệch, sưng đau",
                    "Cắn gạc 30 phút. Chườm lạnh ngày đầu, ăn đồ mềm nguội 2-3 ngày. Không súc miệng mạnh, không hút thuốc trong 3 ngày. Uống hết kháng sinh.",
                    new[] { ("K01.1", "Răng khôn mọc lệch", (string?)"38") });
                AddPrescription(wisdom, new[]
                {
                    ("Amoxicillin 500mg", "1 viên", "3 lần/ngày sau ăn", "5 ngày", 15, (string?)"Uống đủ liều, không tự ngưng"),
                    ("Paracetamol 500mg", "1 viên", "Khi đau, cách nhau ít nhất 6 giờ", "3 ngày", 8, (string?)null)
                });
                var wisdomExam = wisdom.Examination!;
                wisdomExam.FollowUpDate = _today.AddDays(-3);
                wisdomExam.FollowUpNotes = "Cắt chỉ sau nhổ răng khôn";
                var wisdomInvoice = AddInvoice(wisdom, 4, new[] { ("Khám tổng quát", "DV001", 150000m), ("Nhổ răng khôn 38", "DV004", 1500000m) },
                    new[] { (-12, 1650000m, PaymentConstants.QrTransfer, PaymentConstants.Confirmed) });
                Refund(wisdomInvoice, -10, 150000, "Đã khám tổng quát trong buổi điều trị tủy, bị tính thêm phí khám.", PaymentConstants.RefundRequestStatus.Pending);

                // 5. Tái khám cắt chỉ, hẹn khám định kỳ 6 tháng
                var check = Visit("check", -3, "10:00", _ha, new[] { "DV001" }, "Tái khám, cắt chỉ sau nhổ răng khôn",
                    "Vết nhổ lành tốt. Chải răng nhẹ nhàng vùng răng 38 thêm 1 tuần. Khám định kỳ sau 6 tháng.",
                    Array.Empty<(string, string, string?)>());
                var checkExam = check.Examination!;
                checkExam.FollowUpDate = _today.AddMonths(6);
                checkExam.FollowUpNotes = "Khám định kỳ, lấy cao răng";
                checkExam.FollowUpIsRecall = true;
                wisdomExam.FollowUpAppointment = check;
                check.ParentAppointment = wisdom;
                AddInvoice(check, 5, new[] { ("Tái khám, cắt chỉ", "DV001", 150000m) },
                    new[] { (-3, 150000m, PaymentConstants.Cash, PaymentConstants.Confirmed) });

                // A visit the patient cancelled
                var cancelled = NewAppointment(-55, "15:00", _ha, new[] { "DV001" }, AppointmentConstants.CancelledStatus, "Khám tổng quát");
                cancelled.CancellationReason = "Bận việc đột xuất";
                cancelled.CancelledByUserId = _patientUserId;

                // Coming: buổi 3 của kế hoạch (đã xác nhận) and a check-up waiting for confirmation
                _sessionVisit = NewAppointment(6, "09:00", _khoa, new[] { "DV024" }, AppointmentConstants.ConfirmedStatus, "Bọc mão sứ răng 46 (buổi 3)");
                _sessionVisit.ParentAppointment = pulp2;
                _sessionStage = stage3;
                pulp2Exam.FollowUpAppointment = _sessionVisit;
                NewAppointment(20, "14:00", _ha, new[] { "DV001" }, AppointmentConstants.PendingStatus, "Kiểm tra lại răng 46 sau bọc sứ");

                // Requests for documents: one sent, one still waiting
                var sent = Request(wisdomExam, _ha, "Xét nghiệm đông máu", "Cần có trước khi nhổ răng khôn.", DocumentRequestConstants.Submitted, -14);
                Request(pulp2Exam, _khoa, "Phim CT Cone Beam vùng răng 46", "Nếu đã chụp ở nơi khác, gửi để bác sĩ đánh giá trước khi bọc sứ.",
                    DocumentRequestConstants.Pending, -26);
                _requestDocument = (sent, "xet_nghiem_dong_mau.pdf", "PHIEU KET QUA XET NGHIEM DONG MAU");

                foreach (var invoice in _invoices)
                {
                    InvoiceMoneyHelper.Recalculate(invoice);
                }
            }

            private (DocumentRequest Request, string FileName, string Title)? _requestDocument;

            // Documents the patient brought from elsewhere ("Cung cấp tài liệu"), plus the file sent for the doctor's request
            public async Task AddDocumentsAsync(IImagingFileStore fileStore)
            {
                await Provided(fileStore, "Phim X-quang toàn cảnh", "Bệnh viện Răng Hàm Mặt Trung ương", -45, -44,
                    ProvidedDocumentConstants.Category.Imaging, "Bác sĩ bên viện nói răng 38 mọc lệch, nên nhổ.", _khoa,
                    ("panorama_toan_canh.pdf", "PHIM X-QUANG TOAN CANH"), ("ket_luan_phim.pdf", "KET LUAN CHAN DOAN HINH ANH"));
                await Provided(fileStore, "Kết quả xét nghiệm công thức máu", "Bệnh viện Bạch Mai", -15, -14,
                    ProvidedDocumentConstants.Category.LabResult, null, null,
                    ("xet_nghiem_cong_thuc_mau.pdf", "PHIEU KET QUA XET NGHIEM HUYET HOC"));
                await Provided(fileStore, "Đơn thuốc huyết áp đang dùng", "Phòng khám Đa khoa Medlatec", null, -5,
                    ProvidedDocumentConstants.Category.Prescription, "Đang uống Amlodipin 5mg mỗi sáng.", _ha,
                    ("don_thuoc_huyet_ap.pdf", "DON THUOC"));

                if (_requestDocument is { } request)
                {
                    var at = At(-13, "20:15");
                    // The request has no id until it is saved: the folder takes a fresh id instead
                    var path = Path(DocumentRequestConstants.FolderPrefix + Guid.NewGuid().ToString("N"), at);
                    var data = Pdf(request.Title, "Benh nhan: " + Ascii(_patient.FullName), "Ngay: " + _today.AddDays(-14).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                        "Thoi gian prothrombin (PT): 12,1 giay", "INR: 1,02", "APTT: 29,5 giay", "Ket luan: Trong gioi han binh thuong");
                    await fileStore.SaveAsync(path, data);
                    request.Request.Documents.Add(new PatientDocument
                    {
                        Patient = _patient,
                        DocumentType = DocumentRequestConstants.DocumentType,
                        FileName = request.FileName,
                        FilePath = path,
                        FileSize = data.LongLength,
                        MimeType = "application/pdf",
                        UploadedByUserId = _patientUserId,
                        CreatedAt = at
                    });
                }
            }

            public void LinkPlanSession()
            {
                if (_sessionVisit != null && _sessionStage != null)
                {
                    _sessionVisit.TreatmentPlanStageId = _sessionStage.Id;
                }
            }

            // seenBy: the doctor who has already opened it (null = still waiting for a doctor)
            private async Task Provided(IImagingFileStore fileStore, string name, string address, int? performedDay, int uploadedDay,
                string category, string? note, StaffProfile? seenBy, params (string FileName, string Title)[] files)
            {
                var group = Guid.NewGuid();
                var at = At(uploadedDay, "21:00");
                foreach (var (fileName, title) in files)
                {
                    var path = Path(ProvidedDocumentConstants.FolderPrefix + group.ToString("N"), at);
                    var data = Pdf(title, "Benh nhan: " + Ascii(_patient.FullName), "Noi thuc hien: " + Ascii(address),
                        performedDay is int day ? "Ngay thuc hien: " + _today.AddDays(day).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : "Ngay thuc hien: khong ghi",
                        "Tai lieu mau de thu chuc nang Cung cap tai lieu.");
                    await fileStore.SaveAsync(path, data);
                    _db.PatientDocuments.Add(new PatientDocument
                    {
                        Patient = _patient,
                        DocumentType = ProvidedDocumentConstants.DocumentType,
                        UploadGroupId = group,
                        Description = name,
                        ProviderAddress = address,
                        PerformedOn = performedDay is int d ? _today.AddDays(d) : null,
                        Category = category,
                        Note = note,
                        SeenAt = seenBy != null ? at.AddHours(12) : null,
                        SeenByDoctor = seenBy,
                        FileName = fileName,
                        FilePath = path,
                        FileSize = data.LongLength,
                        MimeType = "application/pdf",
                        UploadedByUserId = _patientUserId,
                        CreatedAt = at
                    });
                }
            }

            // Same layout as ProvidedDocumentService: documents/{yyyy}/{MM}/{folder}/{random}.pdf
            private static string Path(string folder, DateTimeOffset at) => string.Join('/',
                DocumentRequestConstants.StorageFolder,
                at.ToString("yyyy", CultureInfo.InvariantCulture),
                at.ToString("MM", CultureInfo.InvariantCulture),
                folder,
                $"{Guid.NewGuid():N}.pdf");

            private Appointment Visit(string key, int day, string time, StaffProfile doctor, string[] codes, string complaint, string advice,
                (string Code, string Name, string? Tooth)[] diagnoses)
            {
                var appointment = NewAppointment(day, time, doctor, codes, AppointmentConstants.CompletedStatus, complaint);
                var start = At(day, time);
                var exam = new Examination
                {
                    Patient = _patient,
                    Doctor = doctor,
                    ChiefComplaint = complaint,
                    ClinicalNotes = advice,
                    ExaminationStatus = ExaminationConstants.Completed,
                    CreatedAt = start,
                    UpdatedAt = start.AddMinutes(40)
                };
                foreach (var (diagnosis, index) in diagnoses.Select((d, i) => (d, i)))
                {
                    exam.Diagnoses.Add(new ClinicalDiagnosis
                    {
                        DiagnosisCode = diagnosis.Code,
                        DiagnosisName = diagnosis.Name,
                        Description = diagnosis.Tooth != null ? $"Răng {diagnosis.Tooth}" : null,
                        Teeth = diagnosis.Tooth,
                        IsPrimary = index == 0,
                        DiagnosedByDoctor = doctor,
                        CreatedAt = start.AddMinutes(10)
                    });
                }
                appointment.Examination = exam;

                return appointment;
            }

            private Appointment NewAppointment(int day, string time, StaffProfile doctor, string[] codes, string status, string? notes)
            {
                var start = TimeOnly.ParseExact(time, "HH:mm", CultureInfo.InvariantCulture);
                var createdAt = At(day - 5, "20:00");
                var items = codes.Where(_services.ContainsKey).Select(code => _services[code]).Select(service => new AppointmentServiceItem
                {
                    Service = service,
                    DurationMinutes = service.EstimatedMinutes ?? 30,
                    PriceAtBooking = service.ReferencePrice,
                    CreatedAt = createdAt
                }).ToList();
                var minutes = Math.Max(30, items.Sum(i => i.DurationMinutes));
                var arrived = status == AppointmentConstants.CompletedStatus;
                var appointment = new Appointment
                {
                    Patient = _patient,
                    Doctor = doctor,
                    AppointmentType = AppointmentConstants.BookedType,
                    AppointmentDate = _today.AddDays(day),
                    TimeSlotStart = start,
                    TimeSlotEnd = start.AddMinutes(minutes),
                    Status = status,
                    CheckInAt = arrived ? At(day, time).AddMinutes(-10) : null,
                    Notes = notes,
                    CreatedByUserId = _patientUserId,
                    CreatedAt = createdAt,
                    UpdatedAt = arrived ? At(day, time).AddMinutes(45) : null,
                    ServiceItems = items
                };
                _db.Appointments.Add(appointment);
                _appointments++;
                return appointment;
            }

            private TreatmentPlanStage Stage(TreatmentPlan plan, int number, string name, decimal cost, int day, Appointment? visit, StaffProfile? doctor)
            {
                var done = visit != null;
                var stage = new TreatmentPlanStage
                {
                    StageNumber = number,
                    StageName = name,
                    Service = _services.GetValueOrDefault("DV024"),
                    EstimatedCost = cost,
                    ActualCost = done ? cost : null,
                    StageStatus = done ? TreatmentPlanConstants.StageStatus.Completed : TreatmentPlanConstants.StageStatus.Scheduled,
                    ScheduledDate = _today.AddDays(day),
                    ActualDate = done ? _today.AddDays(day) : null,
                    PerformedByDoctor = done ? doctor : null,
                    Appointment = visit,
                    CompletedAt = done ? At(day, "10:00") : null,
                    CreatedAt = plan.CreatedAt
                };
                plan.Stages.Add(stage);
                return stage;
            }

            private void AddPrescription(Appointment visit, (string Name, string Dosage, string Frequency, string Duration, int Quantity, string? Instructions)[] items)
            {
                var exam = visit.Examination!;
                var prescription = new Prescription
                {
                    Patient = _patient,
                    PrescribedByDoctor = exam.Doctor,
                    Status = PrescriptionConstants.Finalized,
                    CreatedAt = exam.CreatedAt.AddMinutes(30)
                };
                foreach (var (item, index) in items.Select((x, i) => (x, i)))
                {
                    prescription.Items.Add(new PrescriptionItem
                    {
                        MedicationName = item.Name,
                        Dosage = item.Dosage,
                        Frequency = item.Frequency,
                        Duration = item.Duration,
                        Quantity = item.Quantity,
                        Instructions = item.Instructions,
                        SortOrder = index + 1
                    });
                }
                exam.Prescriptions.Add(prescription);
            }

            private Invoice AddInvoice(Appointment visit, int number, (string Name, string Code, decimal Price)[] lines,
                (int Day, decimal Amount, string Method, string Status)[] payments, TreatmentPlan? plan = null, TreatmentPlanStage?[]? stages = null)
            {
                var createdAt = (visit.UpdatedAt ?? At(0, "12:00")).AddMinutes(5);
                var invoice = new Invoice
                {
                    InvoiceNumber = _invoicePrefix + number.ToString(CultureInfo.InvariantCulture),
                    Appointment = visit,
                    Patient = _patient,
                    TreatmentPlan = plan,
                    PaymentStatus = InvoiceConstants.Unpaid,
                    CreatedAt = createdAt,
                    CreatedByUserId = _cashier?.UserId
                };
                foreach (var (line, index) in lines.Select((l, i) => (l, i)))
                {
                    invoice.Items.Add(new InvoiceItem
                    {
                        Service = _services.GetValueOrDefault(line.Code),
                        ServiceName = line.Name,
                        UnitPrice = line.Price,
                        Quantity = 1,
                        Amount = line.Price,
                        TreatmentPlanStage = stages != null && index < stages.Length ? stages[index] : null,
                        SortOrder = index + 1
                    });
                }
                invoice.TotalAmount = invoice.Items.Sum(i => i.Amount);
                invoice.FinalAmount = invoice.TotalAmount;

                foreach (var (pay, index) in payments.Select((p, i) => (p, i)))
                {
                    var paidAt = createdAt.AddMinutes(5 + index);
                    var confirmed = pay.Status == PaymentConstants.Confirmed;
                    invoice.Payments.Add(new Payment
                    {
                        Amount = pay.Amount,
                        PaymentMethod = pay.Method,
                        PaymentStatus = pay.Status,
                        Purpose = PaymentConstants.PurposeRegular,
                        ReceiptCode = $"{CashierConstants.ReceiptCodePrefix}-{_today.AddDays(pay.Day):yyMMdd}-{_patient.Id % 1000:D3}{number}",
                        TransactionReference = pay.Method == PaymentConstants.Cash ? null : $"DEMO-{_patient.Id}-{number}",
                        CreatedByUserId = _cashier?.UserId,
                        CreatedAt = paidAt,
                        PaidAt = confirmed ? paidAt : null,
                        ConfirmedByUserId = confirmed ? _cashier?.UserId : null
                    });
                }

                _db.Invoices.Add(invoice);
                _invoices.Add(invoice);
                return invoice;
            }

            private void Refund(Invoice invoice, int day, decimal amount, string reason, string status)
            {
                var createdAt = At(day, "19:30");
                var reviewed = status != PaymentConstants.RefundRequestStatus.Pending;
                invoice.RefundAdjustmentRequests.Add(new RefundAdjustmentRequest
                {
                    RequestType = PaymentConstants.RefundRequestType.Refund,
                    Amount = amount,
                    Reason = reason,
                    Status = status,
                    RequestedByUserId = _patientUserId,
                    ApprovedByUserId = reviewed ? _cashier?.UserId : null,
                    ApprovedAt = reviewed ? createdAt.AddDays(1) : null,
                    ProcessedAt = status == PaymentConstants.RefundRequestStatus.Processed ? createdAt.AddDays(2) : null,
                    ProcessedByUserId = status == PaymentConstants.RefundRequestStatus.Processed ? _cashier?.UserId : null,
                    CreatedAt = createdAt
                });
            }

            private DocumentRequest Request(Examination exam, StaffProfile doctor, string name, string note, string status, int day)
            {
                var request = new DocumentRequest
                {
                    Examination = exam,
                    Patient = _patient,
                    RequestedByDoctor = doctor,
                    DocumentName = name,
                    Note = note,
                    Status = status,
                    CreatedAt = At(day, "10:15"),
                    UpdatedAt = status == DocumentRequestConstants.Submitted ? At(day + 1, "20:15") : null
                };
                _db.DocumentRequests.Add(request);
                return request;
            }

            private DateTimeOffset At(int day, string time) =>
                new(_today.AddDays(day).ToDateTime(TimeOnly.ParseExact(time, "HH:mm", CultureInfo.InvariantCulture)), Offset);

            // The PDF font only has Latin-1 letters: Vietnamese marks are dropped
            private static string Ascii(string text)
            {
                var normalized = text.Replace('đ', 'd').Replace('Đ', 'D').Normalize(NormalizationForm.FormD);
                var sb = new StringBuilder();
                foreach (var c in normalized)
                {
                    if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && c < 128)
                    {
                        sb.Append(c);
                    }
                }
                return sb.ToString();
            }

            // A one-page PDF with a title and some lines, enough for the viewer to open
            private static byte[] Pdf(string title, params string[] lines)
            {
                static string Escape(string s) => s.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
                var content = new StringBuilder();
                content.Append("BT /F1 18 Tf 60 770 Td (").Append(Escape(Ascii(title))).Append(") Tj ET\n");
                content.Append("BT /F1 12 Tf 60 735 Td 20 TL\n");
                foreach (var line in lines)
                {
                    content.Append('(').Append(Escape(Ascii(line))).Append(") Tj T*\n");
                }
                content.Append("ET\n");
                var stream = content.ToString();

                var objects = new[]
                {
                    "<< /Type /Catalog /Pages 2 0 R >>",
                    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
                    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                    $"<< /Length {Encoding.ASCII.GetByteCount(stream)} >>\nstream\n{stream}endstream"
                };
                var pdf = new StringBuilder("%PDF-1.4\n");
                var offsets = new List<int>();
                for (var i = 0; i < objects.Length; i++)
                {
                    offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));
                    pdf.Append(i + 1).Append(" 0 obj\n").Append(objects[i]).Append("\nendobj\n");
                }
                var xref = Encoding.ASCII.GetByteCount(pdf.ToString());
                pdf.Append("xref\n0 ").Append(objects.Length + 1).Append("\n0000000000 65535 f \n");
                foreach (var offset in offsets)
                {
                    pdf.Append(offset.ToString("D10", CultureInfo.InvariantCulture)).Append(" 00000 n \n");
                }
                pdf.Append("trailer\n<< /Size ").Append(objects.Length + 1).Append(" /Root 1 0 R >>\nstartxref\n").Append(xref).Append("\n%%EOF\n");
                return Encoding.ASCII.GetBytes(pdf.ToString());
            }
        }
    }
}
