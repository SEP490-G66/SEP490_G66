using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    public class SystemConfigurationResponse
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        // String, Int, Bool, Decimal or Json
        public string DataType { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public string? UpdatedByUserId { get; set; }
    }

    public class UpdateSystemConfigurationRequest
    {
        [Required(ErrorMessage = "Please enter a value.")]
        public string? Value { get; set; }
    }
}
