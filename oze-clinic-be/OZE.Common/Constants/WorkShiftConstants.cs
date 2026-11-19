using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OZE.Common.Constants
{
    // Static like the other constant classes, so it cannot be instantiated
    public static class WorkShiftConstants
    {
        public const int DaysInWeek = 7;
        public const DayOfWeek WeekStartDay = DayOfWeek.Monday;

        // A doctor can start a shift this long before it is due to begin, until it is over
        public const int ClockInEarlyMinutes = 30;

        // Bulk create (F-ADM-09): max inclusive span between fromDate and toDate
        public const int MaxBulkRangeDays = 62;
        public const int MaxBulkStaffCount = 20;
        public const int MaxBulkSlotCount = 3;
    }
}
