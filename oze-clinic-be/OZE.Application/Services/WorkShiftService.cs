using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OZE.Application.Services
{
    public class WorkShiftService : IWorkShipService
    {
        private readonly IWorkShiftRepository _workShipRepository;
        private readonly IStaffRepository _staffRepository;
        private readonly IRoomRepository _roomRepository;
        private readonly INotificationService? _notifications;
        private readonly IAuditLogService? _auditLogService;

        public WorkShiftService(
            IWorkShiftRepository workShipRepository,
            IStaffRepository staffRepository,
            IRoomRepository roomRepository,
            INotificationService? notifications = null,
            IAuditLogService? auditLogService = null)
        {
            _workShipRepository = workShipRepository;
            _staffRepository = staffRepository;
            _roomRepository = roomRepository;
            _notifications = notifications;
            _auditLogService = auditLogService;
        }

        public async Task<WorkShipResponse> CreateWorkShipAsync(CreateWorkShiftRequest request)
        {
            // [Required] has already rejected missing values, so .Value is safe here
            var scheduleDate = request.ScheduleDate!.Value;
            var shiftStart = request.ShiftStart!.Value;
            var shiftEnd = request.ShiftEnd!.Value;

            ConditionGuard.Ensure(shiftStart < shiftEnd, ErrorConstants.WorkShiftMessage.InvalidTimeRange);
            ConditionGuard.Ensure(scheduleDate >= DateOnly.FromDateTime(ClinicClock.Today), ErrorConstants.WorkShiftMessage.PastDate);

            var staff = await _staffRepository.GetByUserIdAsync(request.StaffUserId);
            ConditionGuard.Ensure<NotFoundException>(staff != null, ErrorConstants.WorkShiftMessage.StaffNotFound);
            ConditionGuard.Ensure(staff!.IsActive, ErrorConstants.WorkShiftMessage.StaffInactive);

            Room? room = null;
            if (request.RoomId.HasValue)
            {
                room = await _roomRepository.GetByIdAsync(request.RoomId.Value);
                ConditionGuard.Ensure<NotFoundException>(room != null, ErrorConstants.WorkShiftMessage.RoomNotFound);
                ConditionGuard.Ensure(room!.Status == RoomConstants.ActiveStatus, ErrorConstants.WorkShiftMessage.RoomNotActive);
            }

            var hasOverlap = await _workShipRepository.HasOverlapAsync(staff.Id, scheduleDate, shiftStart, shiftEnd);
            ConditionGuard.ThrowIf(hasOverlap, ErrorConstants.WorkShiftMessage.ShiftOverlap);

            // One room is used by one person at a time
            if (request.RoomId.HasValue)
            {
                var roomTaken = await _workShipRepository.HasRoomOverlapAsync(request.RoomId.Value, scheduleDate, shiftStart, shiftEnd);
                ConditionGuard.ThrowIf(roomTaken, ErrorConstants.WorkShiftMessage.RoomOverlap);
            }

            var schedule = new StaffSchedule
            {
                StaffProfileId = staff.Id,
                RoomId = request.RoomId,
                ScheduleDate = scheduleDate,
                ShiftStart = shiftStart,
                ShiftEnd = shiftEnd,
                Assignment = request.Assignment?.Trim(),
                Notes = request.Note?.Trim(),
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _workShipRepository.AddAsync(schedule);
            await _workShipRepository.SaveChangesAsync();
            await NotifyAsync(n => n.NotifyUsersAsync(new[] { staff.UserId },
                new NotificationContent(NotificationConstants.Text.WorkShiftAssignedTitle,
                    string.Format(NotificationConstants.Text.WorkShiftAssignedMessage, NotificationFormat.Time(schedule.ShiftStart), NotificationFormat.Time(schedule.ShiftEnd), NotificationFormat.Date(schedule.ScheduleDate), RoomText(room)),
                    NotificationConstants.Reference.WorkShift, schedule.Id.ToString())));

            return ToResponse(schedule, staff, room);
        }

        public async Task<BulkWorkShiftPreviewResponse> PreviewBulkWorkShiftsAsync(BulkWorkShiftRequest request)
        {
            var evaluation = await EvaluateBulkAsync(request, applySkippedItems: false);
            return new BulkWorkShiftPreviewResponse
            {
                Items = evaluation.Items,
                ValidCount = evaluation.Valid.Count,
                InvalidCount = evaluation.Invalid.Count
            };
        }

        public async Task<BulkWorkShiftResultResponse> CreateBulkWorkShiftsAsync(BulkWorkShiftRequest request)
        {
            var evaluation = await EvaluateBulkAsync(request, applySkippedItems: true);
            ConditionGuard.Ensure(evaluation.Valid.Count > 0, ErrorConstants.WorkShiftMessage.BulkShiftNothingToCreate);

            var schedules = evaluation.Valid.Select(item => new StaffSchedule
            {
                StaffProfileId = item.Staff.Id,
                RoomId = request.RoomId,
                ScheduleDate = item.Preview.ScheduleDate,
                ShiftStart = item.Preview.ShiftStart,
                ShiftEnd = item.Preview.ShiftEnd,
                Assignment = request.Assignment?.Trim(),
                Notes = request.Note?.Trim(),
                CreatedAt = DateTimeOffset.UtcNow
            }).ToList();

            await _workShipRepository.AddRangeAsync(schedules);
            await _workShipRepository.SaveChangesAsync();

            var createdIds = schedules.Select(s => s.Id).ToList();
            var fromDate = request.FromDate!.Value;
            var toDate = request.ToDate!.Value;
            if (_auditLogService != null)
            {
                await _auditLogService.LogAsync(
                    AuditConstants.ShiftBulkCreated,
                    AuditConstants.StaffScheduleEntity,
                    $"{fromDate:yyyy-MM-dd}_{toDate:yyyy-MM-dd}",
                    null,
                    new
                    {
                        FromDate = fromDate,
                        ToDate = toDate,
                        CreatedCount = createdIds.Count,
                        CreatedIds = createdIds,
                        StaffUserIds = request.StaffUserIds,
                        RoomId = request.RoomId
                    });
            }

            for (var i = 0; i < schedules.Count; i++)
            {
                var schedule = schedules[i];
                var staff = evaluation.Valid[i].Staff;
                var room = evaluation.Room;
                await NotifyAsync(n => n.NotifyUsersAsync(new[] { staff.UserId },
                    new NotificationContent(NotificationConstants.Text.WorkShiftAssignedTitle,
                        string.Format(NotificationConstants.Text.WorkShiftAssignedMessage, NotificationFormat.Time(schedule.ShiftStart), NotificationFormat.Time(schedule.ShiftEnd), NotificationFormat.Date(schedule.ScheduleDate), RoomText(room)),
                        NotificationConstants.Reference.WorkShift, schedule.Id.ToString())));
            }

            return new BulkWorkShiftResultResponse
            {
                CreatedCount = createdIds.Count,
                CreatedIds = createdIds,
                Skipped = evaluation.Invalid.Select(item => new BulkWorkShiftSkippedItem
                {
                    StaffUserId = item.StaffUserId,
                    StaffName = item.StaffName,
                    ScheduleDate = item.ScheduleDate,
                    ShiftStart = item.ShiftStart,
                    ShiftEnd = item.ShiftEnd,
                    RoomId = item.RoomId,
                    Reason = item.Reason ?? ErrorConstants.WorkShiftMessage.BulkShiftNothingToCreate
                }).ToList()
            };
        }

        private async Task<BulkEvaluation> EvaluateBulkAsync(BulkWorkShiftRequest request, bool applySkippedItems)
        {
            var fromDate = request.FromDate!.Value;
            var toDate = request.ToDate!.Value;
            var today = DateOnly.FromDateTime(ClinicClock.Today);

            var staffUserIds = (request.StaffUserIds ?? new List<string>())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToList();
            ConditionGuard.Ensure(
                staffUserIds.Count >= 1 && staffUserIds.Count <= WorkShiftConstants.MaxBulkStaffCount,
                ErrorConstants.WorkShiftMessage.BulkShiftInvalidStaff);

            ConditionGuard.Ensure(
                fromDate >= today && toDate >= fromDate && (toDate.DayNumber - fromDate.DayNumber) <= WorkShiftConstants.MaxBulkRangeDays,
                ErrorConstants.WorkShiftMessage.BulkShiftInvalidRange);

            var daysOfWeek = (request.DaysOfWeek ?? new List<int>()).Distinct().ToList();
            ConditionGuard.Ensure(
                daysOfWeek.Count > 0 && daysOfWeek.All(d => d >= 0 && d <= 6),
                ErrorConstants.WorkShiftMessage.BulkShiftInvalidDaysOfWeek);

            var slots = ValidateAndNormalizeSlots(request.Slots);

            var excluded = new HashSet<DateOnly>(request.ExcludedDates ?? new List<DateOnly>());
            var skippedKeys = applySkippedItems
                ? new HashSet<string>((request.SkippedItems ?? new List<BulkSkippedItem>())
                    .Where(item => !string.IsNullOrWhiteSpace(item.StaffUserId) && item.ScheduleDate.HasValue && item.ShiftStart.HasValue)
                    .Select(item => SkipKey(item.StaffUserId.Trim(), item.ScheduleDate!.Value, item.ShiftStart!.Value)),
                    StringComparer.Ordinal)
                : new HashSet<string>(StringComparer.Ordinal);

            var staffByUserId = new Dictionary<string, StaffProfile>(StringComparer.Ordinal);
            foreach (var staffUserId in staffUserIds)
            {
                var staff = await _staffRepository.GetByUserIdAsync(staffUserId);
                ConditionGuard.Ensure<NotFoundException>(staff != null, ErrorConstants.WorkShiftMessage.StaffNotFound);
                ConditionGuard.Ensure(staff!.IsActive, ErrorConstants.WorkShiftMessage.StaffInactive);
                staffByUserId[staffUserId] = staff;
            }

            Room? room = null;
            if (request.RoomId.HasValue)
            {
                room = await _roomRepository.GetByIdAsync(request.RoomId.Value);
                ConditionGuard.Ensure<NotFoundException>(room != null, ErrorConstants.WorkShiftMessage.RoomNotFound);
                ConditionGuard.Ensure(room!.Status == RoomConstants.ActiveStatus, ErrorConstants.WorkShiftMessage.RoomNotActive);
            }

            var pendingBatch = new List<(int StaffProfileId, DateOnly Date, TimeOnly Start, TimeOnly End, int? RoomId)>();
            var items = new List<BulkWorkShiftPreviewItem>();
            var valid = new List<BulkValidItem>();

            for (var day = fromDate; day <= toDate; day = day.AddDays(1))
            {
                if (!daysOfWeek.Contains((int)day.DayOfWeek) || excluded.Contains(day))
                    continue;

                foreach (var staffUserId in staffUserIds)
                {
                    var staff = staffByUserId[staffUserId];
                    foreach (var slot in slots)
                    {
                        if (skippedKeys.Contains(SkipKey(staffUserId, day, slot.Start)))
                            continue;

                        var preview = new BulkWorkShiftPreviewItem
                        {
                            StaffUserId = staff.UserId,
                            StaffName = staff.FullName,
                            ScheduleDate = day,
                            ShiftStart = slot.Start,
                            ShiftEnd = slot.End,
                            RoomId = request.RoomId,
                            Valid = true
                        };

                        if (day < today)
                        {
                            MarkInvalid(preview, ErrorConstants.WorkShiftMessage.PastDate);
                        }
                        else if (HasBatchOverlap(pendingBatch, staff.Id, day, slot.Start, slot.End, request.RoomId))
                        {
                            MarkInvalid(preview, ErrorConstants.WorkShiftMessage.BulkShiftBatchOverlap);
                        }
                        else if (await _workShipRepository.HasOverlapAsync(staff.Id, day, slot.Start, slot.End))
                        {
                            MarkInvalid(preview, ErrorConstants.WorkShiftMessage.ShiftOverlap);
                        }
                        else if (request.RoomId.HasValue
                            && await _workShipRepository.HasRoomOverlapAsync(request.RoomId.Value, day, slot.Start, slot.End))
                        {
                            MarkInvalid(preview, ErrorConstants.WorkShiftMessage.RoomOverlap);
                        }

                        items.Add(preview);
                        if (preview.Valid)
                        {
                            pendingBatch.Add((staff.Id, day, slot.Start, slot.End, request.RoomId));
                            valid.Add(new BulkValidItem(preview, staff));
                        }
                    }
                }
            }

            return new BulkEvaluation(items, valid, items.Where(i => !i.Valid).ToList(), room);
        }

        private static List<(TimeOnly Start, TimeOnly End)> ValidateAndNormalizeSlots(List<BulkWorkShiftSlot>? requestSlots)
        {
            ConditionGuard.Ensure(
                requestSlots != null
                && requestSlots.Count >= 1
                && requestSlots.Count <= WorkShiftConstants.MaxBulkSlotCount
                && requestSlots.All(s => s.ShiftStart.HasValue && s.ShiftEnd.HasValue),
                ErrorConstants.WorkShiftMessage.BulkShiftInvalidSlots);

            var slots = requestSlots!
                .Select(s => (Start: s.ShiftStart!.Value, End: s.ShiftEnd!.Value))
                .OrderBy(s => s.Start)
                .ToList();

            ConditionGuard.Ensure(slots.All(s => s.Start < s.End), ErrorConstants.WorkShiftMessage.BulkShiftInvalidSlots);
            for (var i = 1; i < slots.Count; i++)
            {
                ConditionGuard.Ensure(slots[i - 1].End <= slots[i].Start, ErrorConstants.WorkShiftMessage.BulkShiftInvalidSlots);
            }

            return slots;
        }

        private static bool HasBatchOverlap(
            List<(int StaffProfileId, DateOnly Date, TimeOnly Start, TimeOnly End, int? RoomId)> pending,
            int staffProfileId,
            DateOnly date,
            TimeOnly start,
            TimeOnly end,
            int? roomId)
        {
            foreach (var item in pending)
            {
                if (item.Date != date || !TimesOverlap(item.Start, item.End, start, end))
                    continue;
                if (item.StaffProfileId == staffProfileId)
                    return true;
                if (roomId.HasValue && item.RoomId == roomId)
                    return true;
            }
            return false;
        }

        private static bool TimesOverlap(TimeOnly startA, TimeOnly endA, TimeOnly startB, TimeOnly endB)
            => startA < endB && startB < endA;

        private static void MarkInvalid(BulkWorkShiftPreviewItem item, string reason)
        {
            item.Valid = false;
            item.Reason = reason;
        }

        private static string SkipKey(string staffUserId, DateOnly date, TimeOnly start)
            => $"{staffUserId}|{date:yyyy-MM-dd}|{start:HH:mm:ss}";

        private sealed record BulkValidItem(BulkWorkShiftPreviewItem Preview, StaffProfile Staff);

        private sealed class BulkEvaluation
        {
            public BulkEvaluation(
                List<BulkWorkShiftPreviewItem> items,
                List<BulkValidItem> valid,
                List<BulkWorkShiftPreviewItem> invalid,
                Room? room)
            {
                Items = items;
                Valid = valid;
                Invalid = invalid;
                Room = room;
            }

            public List<BulkWorkShiftPreviewItem> Items { get; }
            public List<BulkValidItem> Valid { get; }
            public List<BulkWorkShiftPreviewItem> Invalid { get; }
            public Room? Room { get; }
        }

        // In-app notifications are optional so unit tests can build the service without them
        private Task NotifyAsync(Func<INotificationService, Task> send) => _notifications == null ? Task.CompletedTask : send(_notifications);

        private static string RoomText(Room? room) => room == null ? string.Empty : $", {room.RoomName}";

        private static WorkShipResponse ToResponse(StaffSchedule schedule, StaffProfile staff, Room? room)
        {
            return new WorkShipResponse
            {
                Id = schedule.Id,
                StaffUserId = staff.UserId,
                StaffName = staff.FullName,
                RoomId = schedule.RoomId,
                RoomName = room?.RoomName,
                ScheduleDate = schedule.ScheduleDate,
                ShiftStart = schedule.ShiftStart,
                ShiftEnd = schedule.ShiftEnd,
                Assignment = schedule.Assignment,
                IsPresent = schedule.IsPresent,
                AbsenceReason = schedule.AbsenceReason,
                ActualStartTime = schedule.ActualStartTime,
                ActualEndTime = schedule.ActualEndTime,
                Notes = schedule.Notes,
                CreatedAt = schedule.CreatedAt
            };
        }

        public async Task<List<WorkShipResponse>> GetWorkShiftsAsync(WorkShiftQueryRequest query)
        {
            var fromDate = query.FromDate ?? GetStartOfWeek(DateOnly.FromDateTime(ClinicClock.Today));
            var toDate = query.ToDate ?? fromDate.AddDays(WorkShiftConstants.DaysInWeek - 1);

            ConditionGuard.Ensure(fromDate <= toDate, ErrorConstants.WorkShiftMessage.InvalidDateRange);

            var shifts = await _workShipRepository.GetAllAsync(fromDate, toDate, query.StaffUserId, query.RoomId);
            return shifts.Select(x => ToResponse(x, x.StaffProfile, x.Room)).ToList();
        }

        public async Task<WorkShipResponse> GetWorkShiftByIdAsync(long id)
        {   
            var shift = await _workShipRepository.GetByIdAsync(id);
            ConditionGuard.Ensure<NotFoundException>(shift != null, ErrorConstants.WorkShiftMessage.WorkShiftNotFound);
            return ToResponse(shift!, shift!.StaffProfile, shift.Room);
        }

        public async Task DeleteWorkShiftAsync(long id)
        {
            var shift = await _workShipRepository.GetByIdAsync(id);
            ConditionGuard.Ensure<NotFoundException>(shift != null, ErrorConstants.WorkShiftMessage.WorkShiftNotFound);

            // Only future shifts can be deleted; a started or past shift keeps attendance history
            var shiftStartAt = shift!.ScheduleDate.ToDateTime(shift.ShiftStart);
            ConditionGuard.Ensure(shiftStartAt > ClinicClock.Now, ErrorConstants.WorkShiftMessage.ShiftAlreadyStarted);

            var hasAppointments = await _workShipRepository.HasBookedAppointmentsAsync(
                shift.StaffProfileId, shift.ScheduleDate, shift.ShiftStart, shift.ShiftEnd);
            ConditionGuard.ThrowIf(hasAppointments, ErrorConstants.WorkShiftMessage.ShiftHasAppointments);

            var removedStaffId = shift.StaffProfileId;
            var removedText = string.Format(NotificationConstants.Text.WorkShiftRemovedMessage, NotificationFormat.Time(shift.ShiftStart), NotificationFormat.Time(shift.ShiftEnd), NotificationFormat.Date(shift.ScheduleDate));
            _workShipRepository.Remove(shift);
            await _workShipRepository.SaveChangesAsync();
            await NotifyAsync(n => n.NotifyStaffAsync(removedStaffId,
                new NotificationContent(NotificationConstants.Text.WorkShiftRemovedTitle, removedText, NotificationConstants.Reference.WorkShift, null)));
        }

        private static DateOnly GetStartOfWeek(DateOnly date)
        {
            var daysSinceWeekStart = ((int)date.DayOfWeek - (int)WorkShiftConstants.WeekStartDay + WorkShiftConstants.DaysInWeek)
                                     % WorkShiftConstants.DaysInWeek;
            return date.AddDays(-daysSinceWeekStart);
        }

        public async Task<WorkShipResponse> UpdateWorkShiftAsync(long id, UpdateWorkShiftRequest request)
        {
            var shift = await _workShipRepository.GetByIdAsync(id);
            ConditionGuard.Ensure<NotFoundException>(shift != null, ErrorConstants.WorkShiftMessage.WorkShiftNotFound);

            // Only future shifts can be edited; a started or past shift keeps its original schedule
            var currentShiftStartAt = shift!.ScheduleDate.ToDateTime(shift.ShiftStart);
            ConditionGuard.Ensure(currentShiftStartAt > ClinicClock.Now, ErrorConstants.WorkShiftMessage.CannotUpdateStartedShift);

            // [Required] has already rejected missing values, so .Value is safe here
            var scheduleDate = request.ScheduleDate!.Value;
            var shiftStart = request.ShiftStart!.Value;
            var shiftEnd = request.ShiftEnd!.Value;

            ConditionGuard.Ensure(shiftStart < shiftEnd, ErrorConstants.WorkShiftMessage.InvalidTimeRange);
            ConditionGuard.Ensure(scheduleDate >= DateOnly.FromDateTime(ClinicClock.Today), ErrorConstants.WorkShiftMessage.PastDate);

            var staff = await _staffRepository.GetByUserIdAsync(request.StaffUserId);
            ConditionGuard.Ensure<NotFoundException>(staff != null, ErrorConstants.WorkShiftMessage.StaffNotFound);
            ConditionGuard.Ensure(staff!.IsActive, ErrorConstants.WorkShiftMessage.StaffInactive);

            Room? room = null;
            if (request.RoomId.HasValue)
            {
                room = await _roomRepository.GetByIdAsync(request.RoomId.Value);
                ConditionGuard.Ensure<NotFoundException>(room != null, ErrorConstants.WorkShiftMessage.RoomNotFound);
                ConditionGuard.Ensure(room!.Status == RoomConstants.ActiveStatus, ErrorConstants.WorkShiftMessage.RoomNotActive);
            }

            var oldStaffId = shift.StaffProfileId;
            var oldText = string.Format(NotificationConstants.Text.WorkShiftRemovedMessage, NotificationFormat.Time(shift.ShiftStart), NotificationFormat.Time(shift.ShiftEnd), NotificationFormat.Date(shift.ScheduleDate));
            var isStaffOrTimeChanged = staff.Id != shift.StaffProfileId
                || scheduleDate != shift.ScheduleDate
                || shiftStart != shift.ShiftStart
                || shiftEnd != shift.ShiftEnd;

            if (isStaffOrTimeChanged)
            {
                // Check with the OLD shift values, before they are overwritten below
                var hasAppointments = await _workShipRepository.HasBookedAppointmentsAsync(
                    shift.StaffProfileId, shift.ScheduleDate, shift.ShiftStart, shift.ShiftEnd);
                ConditionGuard.ThrowIf(hasAppointments, ErrorConstants.WorkShiftMessage.ShiftHasAppointmentsCannotChange);
            }

            // Exclude the current shift so it does not overlap with itself
            var hasOverlap = await _workShipRepository.HasOverlapAsync(staff.Id, scheduleDate, shiftStart, shiftEnd, id);
            ConditionGuard.ThrowIf(hasOverlap, ErrorConstants.WorkShiftMessage.ShiftOverlap);

            // One room is used by one person at a time (the shift itself is left out)
            if (request.RoomId.HasValue)
            {
                var roomTaken = await _workShipRepository.HasRoomOverlapAsync(request.RoomId.Value, scheduleDate, shiftStart, shiftEnd, id);
                ConditionGuard.ThrowIf(roomTaken, ErrorConstants.WorkShiftMessage.RoomOverlap);
            }

            shift.StaffProfileId = staff.Id;
            shift.RoomId = request.RoomId;
            shift.ScheduleDate = scheduleDate;
            shift.ShiftStart = shiftStart;
            shift.ShiftEnd = shiftEnd;
            shift.Assignment = request.Assignment?.Trim();
            shift.Notes = request.Note?.Trim();
            shift.UpdatedAt = DateTimeOffset.UtcNow;

            _workShipRepository.Update(shift);
            await _workShipRepository.SaveChangesAsync();

            if (oldStaffId != staff.Id)
            {
                // Given to someone else: the old person loses the shift, the new one gets it
                await NotifyAsync(n => n.NotifyStaffAsync(oldStaffId, new NotificationContent(NotificationConstants.Text.WorkShiftRemovedTitle, oldText, NotificationConstants.Reference.WorkShift, null)));
                await NotifyAsync(n => n.NotifyUsersAsync(new[] { staff.UserId },
                    new NotificationContent(NotificationConstants.Text.WorkShiftAssignedTitle,
                        string.Format(NotificationConstants.Text.WorkShiftAssignedMessage, NotificationFormat.Time(shift.ShiftStart), NotificationFormat.Time(shift.ShiftEnd), NotificationFormat.Date(shift.ScheduleDate), RoomText(room)),
                        NotificationConstants.Reference.WorkShift, shift.Id.ToString())));
            }
            else
            {
                await NotifyAsync(n => n.NotifyUsersAsync(new[] { staff.UserId },
                    new NotificationContent(NotificationConstants.Text.WorkShiftChangedTitle,
                        string.Format(NotificationConstants.Text.WorkShiftChangedMessage, NotificationFormat.Date(shift.ScheduleDate), NotificationFormat.Time(shift.ShiftStart), NotificationFormat.Time(shift.ShiftEnd), RoomText(room)),
                        NotificationConstants.Reference.WorkShift, shift.Id.ToString())));
            }

            // Pass the new staff and room; shift.StaffProfile / shift.Room still point to the old ones
            return ToResponse(shift, staff, room);
        }
    }
}

