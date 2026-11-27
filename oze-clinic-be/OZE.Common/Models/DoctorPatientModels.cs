using OZE.Common.Models.Base;

namespace OZE.Common.Models
{
    /// <summary>
    /// Doctor's "Hồ sơ bệnh án" list: SearchKeyword matches the name, the patient code or the phone number
    /// (typed as 0912…, +84912… or part of it).
    /// </summary>
    public class DoctorPatientQuery : PagedRequestBase
    {
    }

    /// <summary>
    /// A patient whose record the doctor may open (examined by the doctor, or booked with the doctor and confirmed).
    /// </summary>
    public class DoctorPatientResponse
    {
        public int PatientId { get; set; }
        public string PatientCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Gender { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public string? PhoneNumber { get; set; }

        /// <summary>Date of the patient's latest examination (any doctor); null when the patient has never been examined.</summary>
        public DateOnly? LastVisitDate { get; set; }
    }
}
