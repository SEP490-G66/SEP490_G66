namespace OZE.Common.Models
{
    public class StaffResponse
    {
        public string UserId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? Role { get; set; }
        public string? Specialization { get; set; }
        public string? LicenseNumber { get; set; }
        public DateOnly? HireDate { get; set; }
        public bool IsActive { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }

        /// <summary>
        /// One-time temporary password returned only when creating staff (not emailed).
        /// </summary>
        public string? TemporaryPassword { get; set; }
    }
}
