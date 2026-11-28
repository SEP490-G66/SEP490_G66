using System.Security.Cryptography;

namespace OZE.Application.Helpers
{
    public static class PatientCodeHelper
    {
        // Format: BN-yyMMdd-XXXXXX (fits Patients.PatientCode NVARCHAR(20)).
        public static string Generate() =>
            $"BN-{ClinicClock.UtcDateTime:yyMMdd}-{RandomNumberGenerator.GetInt32(0, 1_000_000):D6}";
    }
}
