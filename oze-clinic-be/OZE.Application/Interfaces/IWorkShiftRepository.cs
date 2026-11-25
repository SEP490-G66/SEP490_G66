using OZE.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OZE.Application.Interfaces
{
    public interface IWorkShiftRepository
    {
        Task<bool> HasOverlapAsync(int staffProfileId, DateOnly scheduleDate, TimeOnly shiftStart, TimeOnly shiftEnd, long? excludeShiftId = null);
        // True when another shift uses the same room at a time that overlaps
        Task<bool> HasRoomOverlapAsync(int roomId, DateOnly scheduleDate, TimeOnly shiftStart, TimeOnly shiftEnd, long? excludeShiftId = null);
        Task<string?> GetConfigValueAsync(string configKey);
        Task AddAsync(StaffSchedule schedule);
        Task AddRangeAsync(IEnumerable<StaffSchedule> schedules);
        Task SaveChangesAsync();
        Task<List<StaffSchedule>> GetAllAsync(DateOnly fromDate, DateOnly toDate, string? staffUserId, int? roomId);
        Task<StaffSchedule?> GetByIdAsync(long id);
        Task<bool> HasBookedAppointmentsAsync(int staffProfileId, DateOnly scheduleDate, TimeOnly shiftStart, TimeOnly shiftEnd);
        // True when another shift of that day in the same room has been started and not ended
        Task<bool> HasRunningShiftInRoomAsync(int roomId, DateOnly scheduleDate, long excludeShiftId);
        // Shifts of active doctors on that day, with staff profile and room
        Task<List<StaffSchedule>> GetDoctorShiftsOnDateAsync(DateOnly date);
        // Doctor (StaffProfile id) -> patients checked in on that day and not examined yet
        Task<Dictionary<int, int>> CountWaitingByDoctorAsync(DateOnly date, CancellationToken cancellationToken = default);
        void Update(StaffSchedule schedule);
        void Remove(StaffSchedule schedule);
    }
}
