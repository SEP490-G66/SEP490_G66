using System.ComponentModel.DataAnnotations;
using OZE.Common.Constants;

namespace OZE.Common.Models
{
    public class UpdateProfileRequest
    {
        [Required(ErrorMessage = ErrorConstants.AuthMessage.FullNameRequired)]
        [MaxLength(100, ErrorMessage = ErrorConstants.AuthMessage.FullNameInvalid)]
        public string FullName { get; set; } = string.Empty;

        // Optional: Google / incomplete profiles may omit these; phone OTP must still work.
        public DateOnly? DateOfBirth { get; set; }

        // Optional; when set must be Male or Female (checked in UserService).
        public string? Gender { get; set; }

        // Optional when the account has no phone yet (e.g. Google login) and only identity/email is updated.
        // A non-empty value must be a valid VN mobile number (checked in UserService).
        public string? PhoneNumber { get; set; }

        // Optional; the format is checked in the service only when a value is given. An empty value removes the email.
        public string? Email { get; set; }

        [MaxLength(500, ErrorMessage = ErrorConstants.ProfileMessage.AddressInvalid)]
        public string? Address { get; set; }
    }
}
