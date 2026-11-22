using System.ComponentModel.DataAnnotations;

namespace OZE.Common.Models
{
    public class GoogleLoginRequest
    {
        [Required(ErrorMessage = "Please enter Google ID token")]
        public string IdToken { get; set; } = string.Empty;
    }
}
